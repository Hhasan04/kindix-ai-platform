#!/usr/bin/env python3
"""
KINDIX KB -- Chunker
====================

WHY THIS EXISTS:
articles_enriched.json holds the KB articles after transcript enrichment
(see extract_transcripts.py / download_and_transcribe.py). Before anything
can be embedded into pgvector, each article's `content` has to be split
into retrieval-sized chunks. This script does that and nothing else.

INPUT:
    articles_enriched.json
        [{ id, title, category, tags, language, content, content_html,
           video_urls, source_url, last_updated, transcript_status,
           extracted_at }, ...]

OUTPUT:
    chunks.json
        [{ item_id, chunk_index, content, title, category, language,
           source_url }, ...]
    flagged.json
        articles that were NOT chunked, for manual review -- the shared
        metadata fields of a chunk record plus the full (short) `content`
        and a `reason` string:
        [{ item_id, title, category, language, source_url, content,
           reason }, ...]

LOGIC:
  1. Any article whose stripped content is under MIN_CONTENT_CHARS is
     skipped and written to flagged.json instead of being silently
     dropped. transcript_status is folded into the reason so a reviewer
     can see *why* it is empty (no_video, download_failed, ...).
  2. The rest are packed into ~TARGET_TOKENS-token chunks (cl100k_base
     count, used purely as a length estimate -- not tied to any model),
     then ~OVERLAP_TOKENS from the tail of each chunk is prepended to the
     next one. Packing is done on paragraph boundaries (blank lines,
     common in the transcript-derived text); a paragraph longer than the
     target is split on sentence boundaries, and only a single sentence
     longer than the target is ever cut mid-text.
  3. Near-identical chunks are de-duplicated by hashing their
     whitespace-collapsed, lower-cased text, in case articles share
     substantial content. Dedup runs on the packed text, before overlap
     is added.

USAGE:
    pip install tiktoken
    python chunk.py

Does not touch kindix_kb_extractor.py, extract_transcripts.py or
download_and_transcribe.py.
"""

import hashlib
import json
import re
import sys
from pathlib import Path

try:
    import tiktoken
except ImportError:
    print("Missing dependency. Run: pip install tiktoken", file=sys.stderr)
    sys.exit(1)

HERE = Path(__file__).parent
INPUT_FILE = HERE / "articles_enriched.json"
CHUNKS_FILE = HERE / "chunks.json"
FLAGGED_FILE = HERE / "flagged.json"

MIN_CONTENT_CHARS = 200
TARGET_TOKENS = 450       # packing ceiling for a chunk's own text
OVERLAP_TOKENS = 50       # tail of each chunk prepended to the next

ENCODING = tiktoken.get_encoding("cl100k_base")

# Sentence-ish boundaries: latin . ! ?  and Arabic ? (U+061F) / . (U+06D4),
# plus any hard newline.
_SENTENCE_RE = re.compile(r"(?<=[.!?؟۔])\s+|\n+")
_PARAGRAPH_RE = re.compile(r"\n\s*\n")

# Fields copied verbatim from an article onto every chunk it produces.
_CARRIED_FIELDS = ("title", "category", "language", "source_url")


def n_tokens(text: str) -> int:
    return len(ENCODING.encode(text))


def tail_tokens(text: str, k: int) -> str:
    """Last k tokens of text, decoded back to a string."""
    return ENCODING.decode(ENCODING.encode(text)[-k:])


def normalize(text: str) -> str:
    """Whitespace-collapsed, lower-cased form used for dedup hashing."""
    return " ".join(text.split()).lower()


def segments(content: str) -> list[str]:
    """
    Break content into pieces each <= TARGET_TOKENS, preferring natural
    boundaries: paragraphs first, then sentences, and only as a last
    resort a raw token window through an over-long sentence.
    """
    out: list[str] = []
    for para in _PARAGRAPH_RE.split(content):
        para = " ".join(para.split())  # collapse newlines / nbsp inside a paragraph
        if not para:
            continue
        if n_tokens(para) <= TARGET_TOKENS:
            out.append(para)
            continue

        current = ""
        for sentence in _SENTENCE_RE.split(para):
            sentence = sentence.strip()
            if not sentence:
                continue
            candidate = f"{current} {sentence}".strip()
            if current and n_tokens(candidate) > TARGET_TOKENS:
                out.append(current)
                current = sentence
            else:
                current = candidate
            # a lone sentence longer than the target: hard-window it
            while n_tokens(current) > TARGET_TOKENS:
                toks = ENCODING.encode(current)
                out.append(ENCODING.decode(toks[:TARGET_TOKENS]))
                current = ENCODING.decode(toks[TARGET_TOKENS:])
        if current:
            out.append(current)
    return out


def pack(segs: list[str]) -> list[str]:
    """Greedily combine segments without exceeding TARGET_TOKENS per chunk."""
    chunks: list[str] = []
    current: list[str] = []
    for seg in segs:
        trial = current + [seg]
        if current and n_tokens("\n\n".join(trial)) > TARGET_TOKENS:
            chunks.append("\n\n".join(current))
            current = [seg]
        else:
            current = trial
    if current:
        chunks.append("\n\n".join(current))
    return chunks


def with_overlap(chunks: list[str]) -> list[str]:
    """Prepend ~OVERLAP_TOKENS from the tail of each chunk to the next one."""
    if len(chunks) < 2:
        return chunks
    out = [chunks[0]]
    for prev, cur in zip(chunks, chunks[1:]):
        lead = tail_tokens(prev, OVERLAP_TOKENS).strip()
        out.append(f"{lead}\n\n{cur}" if lead else cur)
    return out


def flag_reason(article: dict, content: str) -> str:
    reason = f"content length {len(content)} < {MIN_CONTENT_CHARS} min"
    status = article.get("transcript_status")
    if status and status != "ok":
        reason += f"; transcript_status={status}"
    return reason


def main() -> None:
    articles = json.loads(INPUT_FILE.read_text(encoding="utf-8"))

    chunk_records: list[dict] = []
    flagged_records: list[dict] = []
    seen_hashes: set[str] = set()
    duplicates = 0
    chunked_articles = 0

    for article in articles:
        item_id = article.get("id")
        content = (article.get("content") or "").strip()
        carried = {field: article.get(field) for field in _CARRIED_FIELDS}

        def flag(reason: str) -> None:
            flagged_records.append(
                {"item_id": item_id, **carried, "content": content, "reason": reason}
            )

        if len(content) < MIN_CONTENT_CHARS:
            flag(flag_reason(article, content))
            continue

        packed = pack(segments(content))

        kept: list[str] = []
        for piece in packed:
            digest = hashlib.sha1(normalize(piece).encode("utf-8")).hexdigest()
            if digest in seen_hashes:
                duplicates += 1
                continue
            seen_hashes.add(digest)
            kept.append(piece)

        if not kept:
            flag("no chunkable text after normalization / all chunks duplicated")
            continue

        chunked_articles += 1
        for chunk_index, piece in enumerate(with_overlap(kept)):
            chunk_records.append(
                {"item_id": item_id, "chunk_index": chunk_index,
                 "content": piece, **carried}
            )

    CHUNKS_FILE.write_text(
        json.dumps(chunk_records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    FLAGGED_FILE.write_text(
        json.dumps(flagged_records, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    total = len(articles)
    avg = len(chunk_records) / chunked_articles if chunked_articles else 0.0
    print("=" * 52)
    print(f"  input articles           : {total}")
    print(f"  flagged (not chunked)    : {len(flagged_records)}")
    print(f"  chunks produced          : {len(chunk_records)}")
    print(f"  duplicate chunks dropped : {duplicates}")
    print(f"  avg chunks / article     : {avg:.2f}  (over {chunked_articles} chunked)")
    print("=" * 52)
    print(f"  wrote {CHUNKS_FILE.name} and {FLAGGED_FILE.name}")


if __name__ == "__main__":
    main()
