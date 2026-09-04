#!/usr/bin/env python3
"""
KINDIX KB -- Embed & Store
==========================

WHY THIS EXISTS:
One-time bulk ingestion. Takes the chunked KB (chunks.json, from chunk.py)
plus the article metadata (articles_enriched.json), embeds every chunk
locally with BGE-M3, and loads knowledge_items + knowledge_chunks into the
pgvector-backed Postgres the NestJS backend reads from.

This is deliberately NOT part of the NestJS app: it runs once (or after a KB
refresh), pulls in heavy ML dependencies, and would otherwise bloat the API.

INPUT:
    chunks.json             [{ item_id, chunk_index, content, ... }, ...]
    articles_enriched.json  [{ id, title, category, language, source_url,
                              last_updated, ... }, ...]
    flagged.json            articles chunk.py could not chunk -- their ids
                            are excluded from ingestion here too.
    <repo-root>/.env        DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

WHAT IT DOES:
  1. For every article whose id is NOT in flagged.json:
        INSERT INTO knowledge_items
            (title, category, language, source_url, last_updated)
        ... RETURNING id
     and remembers  original numeric id -> returned UUID.
  2. Embeds chunk content with BAAI/bge-m3 (sentence-transformers, batches
     of 32, normalized -> 1024-dim vectors).
  3. For every chunk: looks up its item_id in the map, then
        INSERT INTO knowledge_chunks
            (item_id, chunk_index, content, embedding)
     with the embedding formatted as a pgvector literal '[0.1,0.2,...]'.
     A chunk whose item_id is not in the map is skipped with a warning.

RE-RUNNING:
    Not idempotent -- it always inserts. TRUNCATE knowledge_chunks,
    knowledge_items first if you need to reload.

USAGE:
    pip install sentence-transformers psycopg2-binary python-dotenv
    python embed_and_store.py
    # first run downloads the BGE-M3 model (~2 GB) into the HuggingFace cache

Does not touch chunk.py, the TypeORM entities or the migration.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    import psycopg2
    from dotenv import load_dotenv
    from sentence_transformers import SentenceTransformer
except ImportError as exc:
    print(
        f"Missing dependency ({exc.name}). Run: "
        "pip install sentence-transformers psycopg2-binary python-dotenv",
        file=sys.stderr,
    )
    sys.exit(1)

HERE = Path(__file__).parent
REPO_ROOT = HERE.parent
CHUNKS_FILE = HERE / "chunks.json"
ARTICLES_FILE = HERE / "articles_enriched.json"
FLAGGED_FILE = HERE / "flagged.json"

MODEL_NAME = "BAAI/bge-m3"
EMBED_DIM = 1024
BATCH_SIZE = 32
PROGRESS_EVERY = 20

DB_KEYS = ("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME")


def load_db_env() -> dict:
    # repo-root .env wins over any pre-existing OS vars, matching
    # backend/src/database/data-source.ts (dotenv override=True).
    load_dotenv(REPO_ROOT / ".env", override=True)
    missing = [k for k in DB_KEYS if not os.getenv(k)]
    if missing:
        print(
            f"Missing env vars in {REPO_ROOT / '.env'}: {', '.join(missing)}",
            file=sys.stderr,
        )
        sys.exit(1)
    return {k: os.getenv(k) for k in DB_KEYS}


def to_vector_literal(embedding) -> str:
    """Format an embedding as a pgvector literal, e.g. '[0.12345678,-0.001,...]'."""
    return "[" + ",".join(f"{float(x):.8f}" for x in embedding) + "]"


def parse_timestamp(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return value  # hand the raw string to Postgres and let it try


def insert_items(cur, articles: list[dict]) -> tuple[dict, int, int]:
    """INSERT one knowledge_items row per article; return id_map + counters."""
    id_map: dict[int, str] = {}
    inserted = errored = 0
    for article in articles:
        try:
            cur.execute(
                """
                INSERT INTO knowledge_items
                    (title, category, language, source_url, last_updated)
                VALUES (%s, %s::text[], %s, %s, %s)
                RETURNING id
                """,
                (
                    article.get("title") or "",
                    article.get("category") or [],
                    article.get("language") or "",
                    article.get("source_url"),
                    parse_timestamp(article.get("last_updated")),
                ),
            )
            id_map[article["id"]] = cur.fetchone()[0]
            inserted += 1
        except Exception as exc:  # noqa: BLE001 - report and keep going
            errored += 1
            print(f"  ! item {article.get('id')} failed: {exc}")
    return id_map, inserted, errored


def embed_chunks(model, texts: list[str]) -> list:
    embeddings: list = []
    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]
        embeddings.extend(
            model.encode(batch, normalize_embeddings=True, show_progress_bar=False)
        )
        print(f"  embedded {min(start + BATCH_SIZE, len(texts))}/{len(texts)}")
    return embeddings


def insert_chunks(cur, chunks: list[dict], embeddings: list, id_map: dict):
    inserted = skipped = errored = 0
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings), start=1):
        item_uuid = id_map.get(chunk["item_id"])
        if item_uuid is None:
            skipped += 1
            print(
                f"  ! chunk {chunk['item_id']}#{chunk['chunk_index']} "
                "skipped: item_id not in mapping"
            )
            continue
        try:
            cur.execute(
                """
                INSERT INTO knowledge_chunks
                    (item_id, chunk_index, content, embedding)
                VALUES (%s, %s, %s, %s::vector)
                """,
                (
                    item_uuid,
                    chunk["chunk_index"],
                    chunk["content"],
                    to_vector_literal(embedding),
                ),
            )
            inserted += 1
        except Exception as exc:  # noqa: BLE001
            errored += 1
            print(
                f"  ! chunk {chunk['item_id']}#{chunk['chunk_index']} "
                f"failed: {exc}"
            )
        if i % PROGRESS_EVERY == 0:
            print(f"  chunks {i}/{len(chunks)}")
    return inserted, skipped, errored


def main() -> None:
    env = load_db_env()
    chunks = json.loads(CHUNKS_FILE.read_text(encoding="utf-8"))
    articles = json.loads(ARTICLES_FILE.read_text(encoding="utf-8"))
    flagged_ids = {
        f["item_id"] for f in json.loads(FLAGGED_FILE.read_text(encoding="utf-8"))
    }

    to_ingest = [a for a in articles if a["id"] not in flagged_ids]
    print(
        f"articles: {len(articles)} total, {len(flagged_ids)} flagged, "
        f"{len(to_ingest)} to ingest"
    )
    print(f"chunks:   {len(chunks)}")

    print(f"loading {MODEL_NAME} (first run downloads ~2 GB) ...")
    model = SentenceTransformer(MODEL_NAME)

    conn = psycopg2.connect(
        host=env["DB_HOST"],
        port=env["DB_PORT"],
        user=env["DB_USER"],
        password=env["DB_PASSWORD"],
        dbname=env["DB_NAME"],
    )
    conn.autocommit = True  # one-time bulk load: keep good rows even if some fail
    cur = conn.cursor()

    try:
        print("inserting knowledge_items ...")
        id_map, items_inserted, items_errored = insert_items(cur, to_ingest)
        print(f"  {items_inserted} inserted, {items_errored} errored")

        print("embedding chunks ...")
        embeddings = embed_chunks(model, [c["content"] for c in chunks])
        if embeddings and len(embeddings[0]) != EMBED_DIM:
            print(
                f"FATAL: model produced {len(embeddings[0])}-dim vectors, "
                f"expected {EMBED_DIM} (knowledge_chunks.embedding is vector({EMBED_DIM}))",
                file=sys.stderr,
            )
            sys.exit(1)

        print("inserting knowledge_chunks ...")
        chunks_inserted, chunks_skipped, chunks_errored = insert_chunks(
            cur, chunks, embeddings, id_map
        )
    finally:
        cur.close()
        conn.close()

    print("=" * 52)
    print(f"  articles inserted : {items_inserted}")
    if items_errored:
        print(f"  articles errored  : {items_errored}")
    print(f"  chunks embedded   : {len(embeddings)}")
    print(f"  chunks inserted   : {chunks_inserted}")
    print(f"  chunks skipped    : {chunks_skipped}  (item_id not in mapping)")
    print(f"  chunks errored    : {chunks_errored}")
    print("=" * 52)


if __name__ == "__main__":
    main()
