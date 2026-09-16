# Installation Guide

The full stack is containerized: Postgres, n8n, Adminer, the NestJS backend, the Angular
frontend, and the BGE-M3 embedding service all run via `infra/docker-compose.yml`. This guide
covers the normal path (`docker compose up --build`) and a manual/local-dev path for anyone who
wants to run a piece outside Docker (e.g. hot-reloading the backend while developing).

## Prerequisites

| Tool | Needed for | Notes |
|---|---|---|
| Docker + Docker Compose | The entire stack | Docker Desktop on Windows/Mac, or Docker Engine on Linux |
| Node.js 20+ | Only if running backend/frontend outside Docker | Angular 20's CLI needs a reasonably current Node |
| Python 3.10+ | Only for the one-off KB ingestion scripts (`knowledge-base/`) — the embedding service itself runs in its own container | `pip install --break-system-packages` if your system Python is externally managed |
| A Gemini API key | Answer generation | Free tier is enough for development |

## 1. Clone and configure environment variables

There are **two separate `.env` files** in this repo — set up both:

```bash
git clone <repo-url> kindix-ai-platform
cd kindix-ai-platform
cp .env.example .env              # backend/application config
cp infra/.env.example infra/.env  # container credentials
```

- **`infra/.env`** — `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` (names and authenticates
  the `postgres` container) and `N8N_USER`/`N8N_PASSWORD` (basic-auth login for the n8n UI at
  `localhost:5678`). Docker Compose reads this one for `${...}` substitution in
  `infra/docker-compose.yml`, because Compose's project directory defaults to wherever the
  compose file lives — it does **not** see the repo-root `.env` for that purpose.
- **repo-root `.env`** — everything the backend application itself needs: `DB_HOST`/`DB_PORT`/
  `DB_USER`/`DB_PASSWORD`/`DB_NAME` (must match `infra/.env`'s `POSTGRES_*` values — same
  credentials, different variable names because TypeORM reads `DB_*`), `GEMINI_API_KEY`,
  `GEMINI_MODEL`, `LLM_PROVIDER=google` (must be exactly `google`), `JWT_SECRET`, and
  `EMBEDDING_SERVICE_URL`. The containerized `backend` service loads this file directly
  (`env_file: ../.env` in `infra/docker-compose.yml`), and overrides `DB_HOST`/`DB_PORT`/
  `EMBEDDING_SERVICE_URL` itself to the Docker-internal values — you don't need to change this
  file between running the backend locally vs. in Docker, it's handled for you either way.

## 2. Bring up the full stack

```bash
docker compose -f infra/docker-compose.yml up --build
```

First run will take a while: it builds the backend/frontend images, and the embedding-service
container downloads the BGE-M3 model (~2 GB) into a cache volume on its first start — that
download only happens once, future restarts reuse the cached model.

This brings up:

| Service | URL | Notes |
|---|---|---|
| Frontend | [http://localhost:4200](http://localhost:4200) | The Angular app |
| Backend API | [http://localhost:3000](http://localhost:3000) | See `docs/API.md` |
| Postgres + pgvector | `localhost:5433` | Container-internal port is `5432` |
| Embedding service | `localhost:8001` | Internal-only in practice; the backend is the real caller |
| n8n | [http://localhost:5678](http://localhost:5678) | Log in with `infra/.env`'s `N8N_USER`/`N8N_PASSWORD` |
| Adminer | [http://localhost:8080](http://localhost:8080) | DB browser — system: PostgreSQL, server: `postgres`, credentials from `infra/.env` |

## 3. Run database migrations

Migrations do **not** run automatically inside the backend container (deliberately — see the
comment at the top of `backend/Dockerfile`). Run them once against the now-running Postgres:

```bash
docker compose -f infra/docker-compose.yml exec backend npm run migration:run
```

This creates all tables: `users`, `conversations`, `messages`, `knowledge_items`,
`knowledge_chunks` (with the pgvector `vector(1024)` column), `feedback`, and `tickets`.

## 4. Load the knowledge base

The knowledge base is built by an offline pipeline, not by the backend, and isn't part of the
container build. `knowledge-base/chunks.json` and `articles_enriched.json` already committed to
the repo are the real, already-extracted KINDIX content, so most of the time you can go straight
to the last step:

```bash
cd knowledge-base
# only needed if you're refreshing the source content:
python kindix_kb_extractor.py       # pulls raw articles -> articles.json
python extract_transcripts.py       # transcribes video-only articles -> articles_enriched.json
python chunk.py                     # splits articles into chunks -> chunks.json, flagged.json

# always needed once, to load the DB:
python embed_and_store.py           # embeds each chunk (BGE-M3) and inserts into Postgres
```

There's no single `requirements.txt` yet — each script documents its own dependencies in its
top-of-file docstring (`embed_and_store.py` needs
`pip install sentence-transformers psycopg2-binary python-dotenv --break-system-packages`, for
example). Read the docstring before running a script you haven't run before. This step runs on
your host (not in a container) and connects to Postgres via its published `localhost:5433`.

`embed_and_store.py` is **not idempotent** — re-running it re-inserts everything. If you need to
reload, truncate `knowledge_chunks` and `knowledge_items` first (Adminer is the easiest way).

## 5. Verify it works

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

## Running a single piece outside Docker (local dev)

Useful for hot-reloading while developing. Each piece just needs the containers it depends on to
be up (`docker compose up -d postgres n8n adminer embedding-service` covers the non-backend/
frontend pieces).

```bash
# backend, with hot reload
cd backend && npm install && npm run start:dev   # serves on http://localhost:3000

# frontend, with hot reload
cd frontend && npm install && ng serve            # serves on http://localhost:4200

# embedding service, if you don't want the container for it
cd knowledge-base
pip install fastapi "uvicorn[standard]" sentence-transformers --break-system-packages
python embedding_service.py                       # serves on http://localhost:8001
```

The repo-root `.env`'s `DB_PORT=5433` and `EMBEDDING_SERVICE_URL=http://localhost:8001` defaults
are exactly right for this case — a backend running outside Docker reaches Postgres and the
embedding service via their host-published ports.

## Troubleshooting

- **CORS errors in the browser console**: the backend only allows `http://localhost:4200` by
  default (`main.ts`). If you serve the frontend from a different origin, update
  `app.enableCors(...)`.
- **"Embedding service unreachable"**: the backend logs this and returns a 500 from `/chat/ask`
  or `/knowledge/search`. Confirm the `embedding-service` container (or local process) is
  actually up and `EMBEDDING_SERVICE_URL` points at it.
- **Wrong DB port when running the backend outside Docker**: `ECONNREFUSED` on `5432` almost
  always means the repo-root `.env` still has `DB_PORT=5432` instead of `5433`.
- **`${POSTGRES_USER}` etc. come out blank in a container**: means `infra/.env` doesn't exist or
  is empty — Compose only reads that file for substitution in `infra/docker-compose.yml`, not the
  repo-root `.env`.
- **`LLM_PROVIDER` errors at startup**: it must be exactly `google` — any other value throws
  immediately (see `backend/src/answer/llm-provider.ts`).
