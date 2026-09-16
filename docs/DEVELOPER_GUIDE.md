# Developer Guide

This is the map for anyone picking this codebase up: how the pieces fit together, why some
decisions were made, and where to look when extending it.

## Architecture

```
Angular (frontend/) ──JWT──► NestJS API (backend/) ──► pgvector Postgres
                                    │        ▲
                                    │        │ raw SQL cosine search
                                    │  POST /embed
                                    ▼
                        BGE-M3 embedding service
                        (knowledge-base/embedding_service.py, FastAPI, port 8001)

                                    │
                                    ▼
                          Gemini (LangChain.js structured output)

n8n (Docker) ◄──POST /feedback (webhook)── Angular
   │
   ├─ Collect Feedback workflow: writes `feedback`, and if rating=down,
   │  calls the Escalation workflow
   └─ Escalation workflow: looks up the conversation for the flagged message,
      writes a `tickets` row (support-team notification is still a placeholder)
```

Two independent request paths matter here:

1. **The chat turn** (`POST /chat/ask`): fully inside NestJS. Retrieve → generate → store,
   synchronous, no n8n involved. This was a deliberate scope decision — n8n was originally
   planned to own more of the pipeline (see "Why n8n only owns feedback" below).
2. **Feedback/escalation**: fully inside n8n, triggered by the frontend calling n8n's webhook
   directly (not through the NestJS API). NestJS's `DashboardService` only *reads* the
   `feedback`/`tickets` tables n8n writes to — it never writes to them.

## Why n8n only owns feedback/escalation, not the whole pipeline

The original plan sketched up to 6 n8n workflows, including one that would own retrieve →
generate → store. In practice, most of that logic (embedding the query, running the pgvector
search, calling Gemini with structured output, persisting the turn) is naturally one cohesive
NestJS request handler — moving it into n8n would mean re-implementing typed request/response
handling, error propagation, and the LangChain integration inside n8n's HTTP/Function nodes for
no real benefit, in a 3-week sprint. n8n earns its place where it actually fits the tool: a
webhook-triggered side-effect chain (write feedback → conditionally trigger a second workflow →
write a ticket) that doesn't need to block the chat response.

## Backend modules (`backend/src/`)

| Module | Responsibility |
|---|---|
| `auth/` | Registration (`school` self-signup, `admin` created out-of-band), login, JWT issuing, `JwtAuthGuard`, `RolesGuard`, `@Roles()` decorator |
| `chat/` | `POST /chat/ask` — the single end-to-end RAG endpoint, JWT-guarded |
| `knowledge/` | `KnowledgeService.search()` — embeds the query via the embedding service, runs the pgvector nearest-neighbour query; `POST /knowledge/search` exposes it directly for debugging |
| `answer/` | `AnswerService.generate()` — prompts Gemini with numbered context blocks, gets back structured `{answer, usedBlockIndices, hasSufficientContext}`, resolves indices back to `{title, sourceUrl}` citations |
| `conversation/` | `ConversationService` (find-or-create a session, append a turn, list/read history) and `ConversationController` (`GET /conversation/history`, `GET /conversation/list`, both ownership-checked) |
| `dashboard/` | Admin-only read/resolve view onto `feedback` and `tickets` (written exclusively by n8n) |
| `database/` | TypeORM data source config, `register-pgvector-type.ts` (teaches the driver about the `vector` column type) |
| `migrations/` | One migration per schema change, run with `npm run migration:run` |

Controllers stay thin — they parse/validate the request and delegate to a service. Business logic
lives in services, one responsibility per service, per the project's own coding rules
(`CLAUDE.md`).

## Database schema

| Table | Key columns | Written by |
|---|---|---|
| `users` | `id`, `email` (unique), `password_hash`, `role` (`school`\|`admin`), `school_name`, `phone`, `country` | NestJS `auth` module |
| `conversations` | `id`, `session_id`, `user_id` (nullable FK → users, `ON DELETE SET NULL`) | NestJS `conversation` module |
| `messages` | `id`, `conversation_id` (FK, cascade), `role` (`user`\|`assistant`), `content`, `sources` (jsonb) | NestJS `conversation` module |
| `knowledge_items` | `id`, `title`, `category` (text[]), `language`, `source_url`, `last_updated` | `knowledge-base/embed_and_store.py` (offline) |
| `knowledge_chunks` | `id`, `item_id` (FK, cascade), `chunk_index`, `content`, `embedding` (`vector(1024)`) | `knowledge-base/embed_and_store.py` (offline) |
| `feedback` | `id`, `message_id` (FK → messages, cascade), `rating`, `comment` | n8n "Collect Feedback" workflow only |
| `tickets` | `id`, `conversation_id` (FK → conversations, cascade), `message_id` (FK → messages, nullable), `reason`, `status` (`open`\|`resolved`) | n8n "Escalation" workflow only |

`knowledge_chunks.embedding` is a pgvector `vector(1024)` column. TypeORM has no native pgvector
type, so `database/register-pgvector-type.ts` teaches the Postgres driver the type exists, and the
column itself is created by raw SQL inside its migration rather than via `synchronize` (which
stays off everywhere — schema changes only happen through migrations).

Retrieval is a single raw-SQL query in `KnowledgeService.search()`:

```sql
SELECT c.content, i.title, i.source_url, 1 - (c.embedding <=> $1::vector) AS score
FROM knowledge_chunks c
JOIN knowledge_items i ON i.id = c.item_id
WHERE c.embedding IS NOT NULL
ORDER BY c.embedding <=> $1::vector ASC
LIMIT $2
```

`<=>` is pgvector's cosine-distance operator; `score` is reported as `1 - distance` so higher is
better.

## Role model: `school` / `admin` (not the original Admin/Support/Employee spec)

The original 3-month plan assumed internal company roles (Admin/Support/Employee) using the
chatbot. In reality, KINDIX's actual users are the **schools subscribed to the KINDIX service** —
they're the ones who need answers about the product. So the role model was adapted:

- **`school`** — self-registers via `POST /auth/register` with `schoolName`, `email`, `phone`,
  `country`, `password`. Uses the chat. Can only see their own conversations
  (`conversations.user_id` ownership check in `ConversationService`/`ConversationController` — a
  real fix, not just a frontend convention: an earlier version had no ownership linkage at all,
  and different accounts in the same browser could see each other's chat history).
- **`admin`** — KINDIX's own customer-service staff. Created out-of-band via
  `POST /auth/register-admin` (deliberately not linked from any UI). Sees the dashboard
  (`/dashboard/*`, `@Roles('admin')`-guarded): feedback counts, ticket list with the reporting
  school's contact info, and can mark tickets resolved.

If you're presenting this project against the original spec, this substitution is worth
explicitly calling out as an intentional adaptation to how KINDIX actually operates, not a missed
requirement.

## n8n workflows (`n8n/*.json`, exported)

1. **The original chat wrapper** (Day 6/7, not exported to this repo — lives only in the live
   n8n instance) — historically a thin webhook wrapper around `/chat/ask`. Superseded in practice
   by the frontend calling `/chat/ask` directly; kept for reference/compatibility.
2. **Collect Feedback** — `Webhook (kindix/feedback)` → `insert feedback` (Postgres) →
   `Rating is down?` (IF) → on `down`, calls **Escalation** via Execute Workflow → `Respond to
   Webhook`.
3. **Escalation** — `When Executed by Another Workflow` (the Execute Workflow Trigger node — note
   its canvas title is *not* "Execute Workflow Trigger", that's just the node type) → looks up
   `conversation_id` from `messages` by the given `message_id` → inserts a `tickets` row. The
   "notify support team" step is an intentional placeholder, not yet wired to email/Slack/etc.

Two n8n gotchas worth remembering if you touch these workflows:

- `$json` always refers to the *immediately previous* node's output. Any node more than one hop
  downstream of the trigger must reference the trigger explicitly by its exact canvas title
  (e.g. `$('Webhook')`) to reach the original payload.
- The Postgres "Execute Query" node's Query Parameters field is a single comma-separated
  `{{expr}},{{expr}}` string — it's extremely sensitive to a stray extra brace.

## Frontend structure (`frontend/src/app/`)

Angular 20, standalone components, routed with `@angular/router`:

- `chat/` — `ChatComponent`, `ChatService` (calls `/chat/ask`, `/conversation/history`,
  `/conversation/list`), `SessionStoreService` (10-minute inactivity-based session-id cache in
  `localStorage`, cleared on login/logout)
- `auth/` — `LoginComponent`, `RegisterComponent`, `AuthService`, `AuthInterceptor` (attaches
  `Authorization: Bearer <token>`), `role.guard.ts` (`schoolGuard`/`adminGuard`)
- `admin/` — `AdminDashboardComponent`, `DashboardService`

Routes (`app.routes.ts`): `/login`, `/register`, `/` (chat, `schoolGuard`), `/admin`
(`adminGuard`), everything else redirects to `/`.

The frontend's service files currently hardcode `http://localhost:3000` as the API base (see
`chat.service.ts`, `auth.service.ts`, `dashboard.service.ts`). That's fine as long as the backend
is published on the host at port 3000 — including once it's containerized, since the browser
(where the Angular app actually runs) talks to the host-published port, not the Docker-internal
network. Don't "fix" this to an internal Docker service name; it would break the browser calls.

## Testing

- `backend/`: Jest unit tests (`npm run test`), e2e scaffold (`npm run test:e2e`) — coverage is
  thin; the 3-week timeline prioritized the working pipeline over exhaustive unit tests.
- End-to-end / answer-quality testing: `testing/kindix-test-set-50.csv` — 51 questions grounded in
  real KINDIX content (28 from an internal Eval-module FAQ, 23 derived from real knowledge-base
  article transcripts across the other KB categories). Columns are pre-built for manually logging
  a real test pass: retrieved-chunk relevance, answer correctness, citation correctness, response
  time, and escalation behaviour.

## Extending the knowledge base

Re-running `knowledge-base/embed_and_store.py` is the only way new content reaches the database —
there's no admin UI for KB management. To add content: extend `articles_enriched.json` (or re-run
the extraction pipeline against updated source data), re-run `chunk.py`, truncate
`knowledge_chunks`/`knowledge_items`, and re-run `embed_and_store.py`.

## Known gaps worth knowing about before you extend this

- No conversation history is fed back into generation — each `/chat/ask` call is single-turn.
- No monitoring/logging layer beyond NestJS's default logger.
- No multilingual verification pass has been run despite the KB containing both Arabic and
  English content.
