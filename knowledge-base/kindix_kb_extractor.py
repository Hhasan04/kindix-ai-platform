#!/usr/bin/env python3
"""
KINDIX Knowledge Base V1 Extractor
====================================

Pulls every article out of https://support.kindix.me/ via its WordPress
REST API and writes them to a structured articles.json, ready for the
cleaning -> chunking -> embeddings pipeline.

WHY THE REST API AND NOT HTML SCRAPING:
Inspection of the site showed it's WordPress + the Echo Knowledge Base (EPKB)
plugin, and WordPress's REST API is open and exposes the KB articles as a
custom post type. That means we get clean structured JSON (title, full HTML
content, category, tags, dates) directly -- no HTML-scraping / CSS-selector
guessing needed, and no risk of breaking when someone tweaks the theme.

Confirmed endpoints (as of 2026-08-27):
    GET /wp-json/wp/v2/epkb_post_type_1               -> KB articles
    GET /wp-json/wp/v2/epkb_post_type_1_category       -> categories
    GET /wp-json/wp/v2/epkb_post_type_1_tag            -> tags
    Sitemap index: /wp-sitemap.xml (confirms ~113 KB article URLs)
    robots.txt: Crawl-delay: 10  (we respect a polite delay by default)

IMPORTANT - RUN THIS ON YOUR OWN MACHINE / DEV ENV, NOT INSIDE A SANDBOXED
CI CONTAINER: some sandboxed environments (including the one this script
was authored in) only allow outbound network to an allowlist and cannot
reach support.kindix.me directly. Run it from your laptop, your NestJS/n8n
dev box, or anywhere with normal internet access.

USAGE:
    pip install requests beautifulsoup4
    python kindix_kb_extractor.py --dry-run          # just counts, no file written
    python kindix_kb_extractor.py                    # full extraction -> articles.json
    python kindix_kb_extractor.py --out kb_v1.json --delay 1.5
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://support.kindix.me"
API_BASE = f"{BASE_URL}/wp-json/wp/v2"
POST_TYPE = "epkb_post_type_1"
CATEGORY_TAXONOMY = "epkb_post_type_1_category"
TAG_TAXONOMY = "epkb_post_type_1_tag"

HEADERS = {
    "User-Agent": "KindixKBExtractor/1.0 (internal internship RAG project; contact via kindix support)"
}

HEBREW_RE = re.compile(r"[֐-׿]")
ARABIC_RE = re.compile(r"[؀-ۿ]")
LATIN_RE = re.compile(r"[A-Za-z]")


def get_json(url: str, params: dict | None = None, delay: float = 1.0) -> requests.Response:
    resp = requests.get(url, params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    time.sleep(delay)  # polite delay; robots.txt asks for 10s for bulk crawling of arbitrary pages,
    # but we're making a handful of REST calls, not crawling hundreds of HTML pages.
    return resp


def fetch_all(post_type: str, delay: float) -> list[dict]:
    """Fetch every item of a REST collection, following WP pagination via X-WP-TotalPages."""
    items: list[dict] = []
    page = 1
    per_page = 100
    while True:
        url = f"{API_BASE}/{post_type}"
        resp = get_json(url, params={"per_page": per_page, "page": page}, delay=delay)
        batch = resp.json()
        if not batch:
            break
        items.extend(batch)
        total_pages = int(resp.headers.get("X-WP-TotalPages", "1"))
        if page >= total_pages:
            break
        page += 1
    return items


def detect_language(text: str) -> str:
    """Cheap-but-effective per-article language detection by Unicode block counts."""
    if not text:
        return "unknown"
    heb = len(HEBREW_RE.findall(text))
    ar = len(ARABIC_RE.findall(text))
    lat = len(LATIN_RE.findall(text))
    counts = {"he": heb, "ar": ar, "en": lat}
    best = max(counts, key=counts.get)
    if counts[best] == 0:
        return "unknown"
    return best


def html_to_clean_text(html: str) -> tuple[str, list[str]]:
    """Strip an article's rendered HTML down to plain readable text, and separately
    pull out any embedded video URLs (YouTube etc.) since those need special
    handling later (transcript extraction is a P2 item, not needed for MVP)."""
    if not html:
        return "", []
    soup = BeautifulSoup(html, "html.parser")

    video_urls: list[str] = []
    for iframe in soup.find_all("iframe"):
        src = iframe.get("src", "")
        if src:
            video_urls.append(src)
        iframe.decompose()
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()

    # Convert <table> rows into readable pipe-separated lines instead of losing them.
    for table in soup.find_all("table"):
        lines = []
        for row in table.find_all("tr"):
            cells = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
            if cells:
                lines.append(" | ".join(cells))
        table.replace_with(soup.new_string("\n".join(lines)))

    text = soup.get_text(separator="\n")
    # collapse excess blank lines
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    return text, video_urls


def strip_html(html: str) -> str:
    if not html:
        return ""
    return BeautifulSoup(html, "html.parser").get_text(strip=True)


def build_taxonomy_map(post_type_taxonomy: str, delay: float) -> dict[int, str]:
    items = fetch_all(post_type_taxonomy, delay)
    return {item["id"]: strip_html(item.get("name", "")) for item in items}


def main():
    parser = argparse.ArgumentParser(description="Extract KINDIX Knowledge Base V1 from support.kindix.me")
    parser.add_argument("--out", default="articles.json", help="Output JSON path (default: articles.json)")
    parser.add_argument("--dry-run", action="store_true", help="Only report counts, do not write output file")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay in seconds between HTTP requests (default 1.0)")
    args = parser.parse_args()

    print(f"[1/4] Fetching category taxonomy from {BASE_URL} ...")
    categories = build_taxonomy_map(CATEGORY_TAXONOMY, args.delay)
    print(f"      -> {len(categories)} categories")

    print("[2/4] Fetching tag taxonomy ...")
    try:
        tags = build_taxonomy_map(TAG_TAXONOMY, args.delay)
    except requests.HTTPError:
        tags = {}
    print(f"      -> {len(tags)} tags")

    print("[3/4] Fetching KB articles (this may take a minute) ...")
    raw_posts = fetch_all(POST_TYPE, args.delay)
    print(f"      -> {len(raw_posts)} articles found")

    if args.dry_run:
        lang_counts: dict[str, int] = {}
        for p in raw_posts:
            text, _ = html_to_clean_text(p.get("content", {}).get("rendered", ""))
            lang = detect_language(p.get("title", {}).get("rendered", "") + " " + text[:500])
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
        print("\n--- DRY RUN SUMMARY ---")
        print(f"Total articles: {len(raw_posts)}")
        print(f"Categories: {len(categories)}")
        print(f"Tags: {len(tags)}")
        print(f"Language breakdown (rough, by unicode heuristic): {lang_counts}")
        thin = sum(1 for p in raw_posts if len(strip_html(p.get('content', {}).get('rendered',''))) < 200)
        print(f"Articles with <200 chars of text content (likely video-only): {thin}")
        print("\nRun again without --dry-run to write the full articles.json")
        return

    print("[4/4] Cleaning content and writing output ...")
    knowledge_items = []
    for p in raw_posts:
        title = strip_html(p.get("title", {}).get("rendered", ""))
        raw_html = p.get("content", {}).get("rendered", "")
        clean_text, video_urls = html_to_clean_text(raw_html)
        lang = detect_language(title + " " + clean_text[:1000])
        cat_ids = p.get(CATEGORY_TAXONOMY, []) or []
        cat_names = [categories.get(cid, str(cid)) for cid in cat_ids]
        tag_ids = p.get(TAG_TAXONOMY, []) or []
        tag_names = [tags.get(tid, str(tid)) for tid in tag_ids]

        knowledge_items.append({
            "id": p.get("id"),
            "title": title,
            "category": cat_names,
            "tags": tag_names,
            "language": lang,
            "content": clean_text,
            "content_html": raw_html,
            "video_urls": video_urls,
            "source_url": p.get("link"),
            "last_updated": p.get("modified_gmt"),
            "extracted_at": datetime.now(timezone.utc).isoformat(),
        })

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(knowledge_items, f, ensure_ascii=False, indent=2)

    print(f"\nDone. Wrote {len(knowledge_items)} knowledge items to {args.out}")
    thin = sum(1 for k in knowledge_items if len(k["content"]) < 200)
    print(f"Heads up: {thin} of these have <200 chars of extractable text "
          f"(likely video-only articles) -- flag these for manual review / "
          f"transcript extraction later, don't count on them for embeddings as-is.")


if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as e:
        print(f"Network error: {e}", file=sys.stderr)
        print("If you're running this inside a sandboxed/CI container, it likely "
              "can't reach support.kindix.me directly -- run it from a normal dev "
              "machine or your n8n/NestJS host instead.", file=sys.stderr)
        sys.exit(1)
