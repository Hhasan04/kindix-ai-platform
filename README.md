# KINDIX AI Knowledge Platform

An internal RAG (Retrieval-Augmented Generation) platform that lets schools using KINDIX ask
natural-language questions about the KINDIX product and get cited, grounded answers instead of
digging through support articles.

**Educational Intelligence — Answers You Can Trust.**

Built end-to-end during a compressed 3-week internship sprint against an original 3-month project
plan (see `docs/DEVELOPER_GUIDE.md` for what that trade-off meant in practice).

## What it does

A school-account user opens the chat, asks a question in Arabic or English, and the system:

1. Embeds the question locally (BGE-M3) and finds the most relevant chunks of the KINDIX
   knowledge base via a pgvector similarity search.
2. Sends the question plus those chunks to Gemini, which is instructed to answer **only** from
   the supplied context and to report which chunks it actually used.
3. Returns the answer together with real source links, and stores the turn so the conversation
   can continue.
4. Lets the user rate the answer 👍/👎. A 👎 opens an escalation ticket that KINDIX's support
   team can see and resolve on an admin dashboard.

## Architecture

```
Angular chat (school user)
      │  POST /chat/ask (JWT)
      ▼
NestJS API ──────────────► pgvector-backed PostgreSQL
      │   embeds query via      (knowledge_items, knowledge_chunks,
      │   local BGE-M3 service   users, conversations, messages,
      │   retrieves top-k        feedback, tickets)
      │   chunks, asks Gemini
      │   to answer + cite
      ▼
Gemini (LangChain.js, structured output)
      │
      ▼
cited answer ──► stored as a Message ──► rendered in the chat


Feedback / escalation side-channel (n8n):
Angular ──POST /feedback──► n8n "Collect Feedback" ──► writes `feedback` row
                                   │ (if rating = down)
                                   ▼
                           n8n "Escalation" ──► writes `tickets` row ──► admin dashboard
```

The original chat turn (retrieve → generate → store) lives entirely inside the NestJS
`/chat/ask` endpoint — it does not go through n8n. n8n only owns the feedback/escalation
side-channel, by design (see `docs/DEVELOPER_GUIDE.md` for why).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20, standalone components |
| Backend API | NestJS + TypeORM |
| Database | PostgreSQL 16 + pgvector (`pgvector/pgvector:pg16`) |
| Embeddings | BGE-M3 (BAAI), local via `sentence-transformers`, 1024-dim, no API key |
| Chat generation | Google Gemini, via LangChain.js (`@langchain/google-genai`) |
| Workflow automation | n8n (feedback collection + escalation only) |
| Auth | JWT (`@nestjs/passport` + `passport-jwt`), `bcryptjs` password hashing |
| Deployment | Docker Compose |

## Repository layout

```
backend/          NestJS API — auth, chat, conversation, knowledge, answer, dashboard modules
frontend/         Angular app — chat UI, login/register, admin dashboard
infra/            docker-compose.yml (all 6 services: Postgres, n8n, Adminer, backend,
                   frontend, embedding service) plus infra/.env for container credentials
knowledge-base/   KB extraction, transcription, chunking, embedding, and the standalone
                   BGE-M3 embedding_service.py the backend calls at query time
n8n/              Exported n8n workflows (Collect Feedback, Escalation)
testing/          The 50-question grounded test set used to evaluate answer quality
docs/             This documentation set
```

## Documentation

- [`docs/INSTALLATION.md`](docs/INSTALLATION.md) — set up and run the full stack locally
- [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) — architecture, modules, database schema,
  n8n workflows, how to extend the system
- [`docs/API.md`](docs/API.md) — every backend endpoint, request/response shapes, auth rules
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — how a school user or a KINDIX admin uses the product

## Known limitations (reported honestly, not swept under the rug)

- The knowledge base currently holds **~141 real articles / ~192 chunks** extracted and
  transcribed from KINDIX's actual support content — well short of the original plan's
  1000+ KPI target, because that target assumed a much larger existing support library than
  KINDIX actually has today. What's there is real, grounded content, not filler.
- The RAG pipeline is single-turn: each answer is generated from the current question alone,
  without the prior turns in the same conversation being fed back into the prompt. Conversation
  history is stored and shown in the UI, but doesn't yet influence generation.
- n8n's escalation workflow creates a ticket but the "notify support team" step is a placeholder
  — no email/Slack notification is wired up yet.
- Roles are `school` and `admin` (not the original plan's Admin/Support/Employee three-way
  split) — schools are KINDIX's actual customers and the only real chat users, so the role model
  was adapted to match reality rather than the original spec. See `docs/DEVELOPER_GUIDE.md`.

## License / ownership

Internal internship project for KINDIX. Not published for external use.
