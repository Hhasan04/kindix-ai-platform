# Installation Guide

This covers getting the full KINDIX AI Knowledge Platform running from a fresh clone: the
containerized services (Postgres, n8n, Adminer, and, once containerized, the backend/frontend/
embedding service), plus whatever still runs as a local process.

## Prerequisites

| Tool | Needed for | Notes |
|---|---|---|
| Docker + Docker Compose | Postgres, n8n, Adminer (and eventually backend/frontend/embedding service) | Docker Desktop on Windows/Mac, or Docker Engine on Linux |
| Node.js 20+ | Backend (NestJS) and frontend (Angular 20) | Angular 20's CLI needs a reasonably current Node — if `ng serve` refuses to start, update Node first |
| Python 3.10+ | The local BGE-M3 embedding service and the one-off KB ingestion scripts | `pip install --break-system-packages` if your system Python is externally managed |
| A Gemini API key | Answer generation | Free tier is enough for development |

## 1. Clone and configure environment variables

```bash
git clone <repo-url> kindix-ai-platform
cd kindix-ai-platform
cp .env.example .env
```

Open `.env` and fill in real values. The important ones:

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — used by the `postgres` container itself
  (docker-compose reads these).
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` — used by the NestJS backend when
  run **locally** (outside Docker) to reach that same Postgres container via its **published host
  port**. The compose file maps the container's internal `5432` to `5433` on your machine, so
  `DB_PORT` must be `5433` here, not `5432`. (`DB_USER`/`DB_PASSWORD`/`DB_NAME` should match the
  `POSTGRES_*` values above — they're separate variables only because TypeORM and the Postgres
  image read different variable names.)
- `N8N_USER` / `N8N_PASSWORD` — basic-auth login for the n8n UI at `localhost:5678`.
- `GEMINI_API_KEY` — your Gemini key. `GEMINI_MODEL` and `LLM_PROVIDER=google` already have
  working defaults.
- `JWT_SECRET` — any long random string for local dev; use a real secret in production.
- `EMBEDDING_SERVICE_URL` — only needs to change from its `http://localhost:8001` default if the
  embedding service is reachable somewhere else (e.g. inside Docker's network).

## 2. Start the infrastructure containers

```bash
docker compose -f infra/docker-compose.yml up -d
```

This brings up:

- **Postgres + pgvector** on host port `5433` (container port `5432`)
- **n8n** on [http://localhost:5678](http://localhost:5678) (log in with `N8N_USER`/`N8N_PASSWORD`)
- **Adminer** on [http://localhost:8080](http://localhost:8080) — a quick DB browser (system:
  PostgreSQL, server: `postgres`, matching the `.env` credentials)

> If `infra/docker-compose.yml` has since been extended to also containerize the backend,
> frontend, and embedding service, `docker compose up --build` alone brings up the entire stack
> and you can skip straight to [Step 6](#6-verify-it-works). The steps below assume the
> not-yet-fully-containerized state, where those three still run as local processes.

## 3. Run database migrations

```bash
cd backend
npm install
npm run migration:run
```

This creates all tables: `users`, `conversations`, `messages`, `knowledge_items`,
`knowledge_chunks` (with the pgvector `vector(1024)` column), `feedback`, and `tickets`.

## 4. Load the knowledge base

The knowledge base is built by an offline pipeline, not by the backend. From `knowledge-base/`:

```bash
cd knowledge-base
python kindix_kb_extractor.py       # pulls raw articles -> articles.json
python extract_transcripts.py       # transcribes video-only articles -> articles_enriched.json
python chunk.py                     # splits articles into chunks -> chunks.json, flagged.json
python embed_and_store.py           # embeds each chunk (BGE-M3) and inserts into Postgres
```

There's no single `requirements.txt` yet — each script documents its own dependencies in its
top-of-file docstring (`embed_and_store.py` needs
`pip install sentence-transformers psycopg2-binary python-dotenv --break-system-packages`, for
example). Read the docstring before running a script you haven't run before.

`embed_and_store.py` is **not idempotent** — re-running it re-inserts everything. If you need to
reload, truncate `knowledge_chunks` and `knowledge_items` first (Adminer is the easiest way).

The first run of any BGE-M3 step downloads the model (~2 GB) into the local HuggingFace cache —
this only happens once.

If you don't want to re-run the whole pipeline, `knowledge-base/chunks.json` and
`articles_enriched.json` already committed to the repo are the real, already-extracted KINDIX
content — you can go straight to `embed_and_store.py`.

## 5. Start the embedding service and the backend

The backend calls a small standalone FastAPI service for query embeddings — it must be running
before you use the chat.

```bash
# Terminal 1 — embedding service
cd knowledge-base
pip install fastapi "uvicorn[standard]" sentence-transformers --break-system-packages
python embedding_service.py
# serves on http://localhost:8001
```

```bash
# Terminal 2 — backend
cd backend
npm run start:dev
# serves on http://localhost:3000
```

```bash
# Terminal 3 — frontend
cd frontend
npm install
ng serve
# serves on http://localhost:4200
```

## 6. Verify it works

1. Open [http://localhost:4200](http://localhost:4200).
2. Register a school account (school name, email, phone, country, password).
3. Ask a question — try one from `testing/kindix-test-set-50.csv` to get a question you know the
   knowledge base actually covers.
4. You should get a grounded answer with real citations within a few seconds.
5. Thumbs-down an answer, then log in to n8n (`localhost:5678`) and confirm the **Collect
   Feedback** and **Escalation** workflows are toggled **Active** — otherwise the webhook silently
   does nothing.
6. Register an admin account via `POST /auth/register-admin` (see `docs/API.md` — there's no UI
   for this on purpose), log in, and confirm the dashboard at `/admin` shows the ticket you just
   created.

## Troubleshooting

- **CORS errors in the browser console**: the backend only allows `http://localhost:4200` by
  default (`main.ts`). If you serve the frontend from a different origin, update
  `app.enableCors(...)`.
- **"Embedding service unreachable"**: the backend logs this and returns a 500 from `/chat/ask`
  or `/knowledge/search`. Confirm `embedding_service.py` is actually running and
  `EMBEDDING_SERVICE_URL` points at it.
- **Wrong DB port**: `ECONNREFUSED` on `5432` almost always means `.env` still has `DB_PORT=5432`
  instead of `5433` for a backend running outside Docker.
- **`LLM_PROVIDER` errors at startup**: it must be exactly `google` — any other value throws
  immediately (see `backend/src/answer/llm-provider.ts`).
