#!/usr/bin/env python3
"""
KINDIX KB — YouTube Transcript Enrichment (v3: unattended watch mode)
=======================================================================

WHY THIS EXISTS:
A dry-run of kindix_kb_extractor.py showed that 139 of 143 KB articles on
support.kindix.me have essentially no text content -- the article body is
literally just a <p><iframe ...youtube.com/embed/VIDEO_ID...></iframe></p>
with no accompanying description. This site is a video tutorial library,
not a text KB. The real knowledge is spoken inside the videos.

This script reads articles.json (produced by kindix_kb_extractor.py),
pulls each embedded video's transcript/captions via YouTube's own
timedtext mechanism (no API key needed), and merges the transcript text
into each article's content so there's something real to chunk and embed.

v3 CHANGES (after observing the block clears roughly once every few
hours -- and persists across different networks, meaning this is NOT a
simple per-IP rate limit, it's YouTube's broader anti-scraping system
imposing a cooldown on this request pattern):
- New --watch mode: instead of you manually re-running the command every
  few hours, the script loops on its own -- tries the remaining videos,
  and if it gets blocked, sleeps for a cooldown period and tries again
  automatically, forever, until every video is resolved. Leave it running
  in a terminal in the background while you work on the backend.
- The cooldown grows over time (30 min, then 60, then 90... capped at 4h)
  since a fixed short wait clearly isn't enough given what you're seeing.
- Everything from v2 (resumable cache, per-video incremental saves) is
  unchanged -- --watch is purely additive.

USAGE:
    pip install youtube-transcript-api
    python kindix_kb_extractor.py            # first, if you haven't already
    python extract_transcripts.py --watch    # recommended: run once, walk away
    python extract_transcripts.py            # or: one manual attempt, then exits (old behavior)

In --watch mode, just leave the terminal window open. It prints a
timestamped line whenever it's sleeping so you can tell it's alive, not
frozen. Ctrl+C at any time is safe -- progress is saved after every
single video, watch mode or not.
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import (
        TranscriptsDisabled,
        NoTranscriptFound,
        VideoUnavailable,
    )
except ImportError:
    print("Missing dependency. Run: pip install youtube-transcript-api", file=sys.stderr)
    sys.exit(1)

PREFERRED_LANGS = ["ar", "ar-SA", "ar-EG", "iw", "he", "en"]
VIDEO_ID_PATTERN = re.compile(r"(?:embed/|v=|youtu\.be/)([A-Za-z0-9_-]{11})")

# Statuses that are worth retrying on a future run (transient / network-side).
RETRYABLE_STATUSES = {"error:IpBlocked", "error:RequestBlocked", "error:TooManyRequests"}
MAX_CONSECUTIVE_BLOCKS = 3


def extract_video_id(url: str) -> str | None:
    m = VIDEO_ID_PATTERN.search(url)
    return m.group(1) if m else None


def fetch_transcript_text(video_id: str) -> tuple[str | None, str]:
    """Returns (transcript_text_or_None, status_string)."""
    try:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=PREFERRED_LANGS)
        raw = fetched.to_raw_data() if hasattr(fetched, "to_raw_data") else fetched
        text = " ".join(seg["text"] for seg in raw if seg.get("text", "").strip())
        return (text.strip() or None), "ok"
    except AttributeError:
        pass
    except (TranscriptsDisabled, VideoUnavailable):
        return None, "disabled_or_unavailable"
    except NoTranscriptFound:
        pass
    except Exception as e:
        return None, f"error:{type(e).__name__}"

    try:
        segments = YouTubeTranscriptApi.get_transcript(video_id, languages=PREFERRED_LANGS)
        text = " ".join(seg["text"] for seg in segments if seg.get("text", "").strip())
        return (text.strip() or None), "ok"
    except NoTranscriptFound:
        pass
    except (TranscriptsDisabled, VideoUnavailable):
        return None, "disabled_or_unavailable"
    except Exception as e:
        return None, f"error:{type(e).__name__}"

    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        for t in transcript_list:
            data = t.fetch()
            raw = data.to_raw_data() if hasattr(data, "to_raw_data") else data
            text = " ".join(seg["text"] for seg in raw if seg.get("text", "").strip())
            if text.strip():
                return text.strip(), f"ok_fallback_lang:{t.language_code}"
    except Exception as e:
        return None, f"error:{type(e).__name__}"

    return None, "no_transcript_found"


def load_cache(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_cache(path: str, cache: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def get_video_ids(articles: list) -> list:
    all_video_ids = []
    for article in articles:
        for url in article.get("video_urls", []):
            vid = extract_video_id(url)
            if vid and vid not in all_video_ids:
                all_video_ids.append(vid)
    return all_video_ids


def run_batch(all_video_ids: list, cache: dict, cache_file: str, delay: float) -> bool:
    """Attempts every unresolved video once. Returns True if it stopped early due to blocking."""
    new_ids = [v for v in all_video_ids if v not in cache or cache[v][1] in RETRYABLE_STATUSES]
    print(f"{len(all_video_ids)} unique videos total, {len(new_ids)} need fetching this pass\n")
    if not new_ids:
        return False

    consecutive_blocks = 0
    for i, vid in enumerate(new_ids, 1):
        text, status = fetch_transcript_text(vid)
        cache[vid] = [text, status]
        save_cache(cache_file, cache)  # persist after EVERY video, not at the end

        print(f"[{i}/{len(new_ids)}] {vid} -> {status}" + (f" ({len(text)} chars)" if text else ""))

        if status in RETRYABLE_STATUSES:
            consecutive_blocks += 1
            if consecutive_blocks >= MAX_CONSECUTIVE_BLOCKS:
                print(f"\n{consecutive_blocks} blocks in a row -- YouTube has rate-limited this pattern.")
                return True
        else:
            consecutive_blocks = 0

        time.sleep(delay)

    return False


def main():
    parser = argparse.ArgumentParser(description="Enrich KINDIX KB articles with YouTube transcripts (resumable)")
    parser.add_argument("--in", dest="infile", default="articles.json")
    parser.add_argument("--out", dest="outfile", default="articles_enriched.json")
    parser.add_argument("--cache", dest="cache_file", default="transcript_cache.json")
    parser.add_argument("--delay", type=float, default=4.0, help="Seconds between NEW video requests (default 4)")
    parser.add_argument("--watch", action="store_true",
                         help="Run forever: on a block, sleep with growing backoff and retry automatically")
    parser.add_argument("--initial-cooldown", type=float, default=30.0,
                         help="Minutes to sleep after the first block in --watch mode (default 30)")
    parser.add_argument("--max-cooldown", type=float, default=240.0,
                         help="Cap on the backoff sleep in --watch mode, in minutes (default 240 = 4h)")
    args = parser.parse_args()

    with open(args.infile, "r", encoding="utf-8") as f:
        articles = json.load(f)

    cache = load_cache(args.cache_file)
    print(f"Loaded {len(cache)} previously-fetched videos from {args.cache_file}")
    all_video_ids = get_video_ids(articles)

    if args.watch:
        cooldown = args.initial_cooldown
        while True:
            blocked = run_batch(all_video_ids, cache, args.cache_file, args.delay)
            remaining = sum(1 for v in all_video_ids if v not in cache or cache[v][1] in RETRYABLE_STATUSES)
            if remaining == 0:
                print(f"\n[{datetime.now():%H:%M:%S}] All videos resolved. Exiting watch mode.")
                break
            if not blocked:
                # Finished the pass without a fresh block, but some videos are still
                # unresolved from an earlier run -- short pause then just try again.
                cooldown = args.initial_cooldown
            print(f"[{datetime.now():%H:%M:%S}] {remaining} videos still unresolved. "
                  f"Sleeping {cooldown:.0f} min before retrying (Ctrl+C to stop -- progress is saved)...")
            time.sleep(cooldown * 60)
            cooldown = min(cooldown * 1.5, args.max_cooldown)
    else:
        blocked = run_batch(all_video_ids, cache, args.cache_file, args.delay)
        if blocked:
            print(f"\nStopped early -- progress is saved in {args.cache_file}.")
            print("Wait 30-60+ min and rerun, or add --watch to have it retry automatically on its own.")

    # Apply whatever is in the cache (from this run and all previous runs) to the articles.
    stats = {"ok": 0, "no_video": 0, "failed": 0, "already_had_text": 0}
    for article in articles:
        existing_text = (article.get("content") or "").strip()
        video_urls = article.get("video_urls", [])

        if not video_urls:
            article["transcript_status"] = "no_video"
            stats["already_had_text" if len(existing_text) >= 200 else "no_video"] += 1
            continue

        transcripts, statuses = [], []
        for url in video_urls:
            vid = extract_video_id(url)
            if vid and vid in cache:
                text, status = cache[vid]
                statuses.append(status)
                if text:
                    transcripts.append(text)

        if transcripts:
            combined = "\n\n".join(transcripts)
            article["content"] = (existing_text + "\n\n" + combined).strip() if existing_text else combined
            article["transcript_status"] = "ok"
            stats["ok"] += 1
        else:
            article["transcript_status"] = ";".join(statuses) or "not_fetched_yet"
            stats["failed"] += 1

    with open(args.outfile, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    print("\n--- SUMMARY (cumulative across all runs so far) ---")
    print(f"Total articles: {len(articles)}")
    print(f"Transcripts successfully attached: {stats['ok']}")
    print(f"Already had real text, no video needed: {stats['already_had_text']}")
    print(f"No video AND thin text (needs manual attention): {stats['no_video']}")
    print(f"Still missing a transcript (blocked/failed/not yet fetched): {stats['failed']}")
    print(f"\nWrote {args.outfile}")


if __name__ == "__main__":
    main()
