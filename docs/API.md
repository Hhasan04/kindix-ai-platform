# API Documentation

Base URL (local dev): `http://localhost:3000`

All endpoints accept and return JSON. Authenticated endpoints expect
`Authorization: Bearer <token>`, where `<token>` is the JWT returned by `POST /auth/login`.

## Auth

### `POST /auth/register`

Self-service signup for a school account. Public.

**Body**

```json
{
  "schoolName": "Al Noor School",
  "email": "admin@alnoor.edu",
  "phone": "+970500000000",
  "country": "Palestine",
  "password": "a-real-password"
}
```

**Response**

```json
{ "access_token": "eyJhbGciOi..." }
```

`409 Conflict` if `email`/`password` are missing, or if the email is already registered (the
service uses `ConflictException` for both cases, including the missing-fields case).

### `POST /auth/register-admin`

Creates a KINDIX customer-service (`admin`) account. Public endpoint, but intentionally not
linked from any UI — used out-of-band (e.g. via Postman) by whoever provisions support staff.

**Body**

```json
{ "email": "support@kindix.me", "password": "a-real-password" }
```

**Response**: same `{ "access_token": "..." }` shape as `/auth/login`.

### `POST /auth/login`

**Body**

```json
{ "email": "admin@alnoor.edu", "password": "a-real-password" }
```

**Response**

```json
{ "access_token": "eyJhbGciOi..." }
```

`401` on any missing field or wrong credentials (deliberately not distinguishing "no such user"
from "wrong password"). The JWT payload carries `sub` (user id), `email`, `role`
(`school`\|`admin`), and `schoolName` — `RolesGuard` reads `role` from it.

---

## Chat

### `POST /chat/ask`

The end-to-end RAG endpoint: retrieve → generate → persist. **Requires auth** (any role).

**Body**

```json
{ "query": "How do I add a criteria in Eval?", "sessionId": "optional-existing-session-uuid" }
```

`sessionId` is optional — omit it (or send an unknown one) to start a new conversation; the
response returns the resolved `sessionId` so the client can continue the same conversation on the
next call.

**Response**

```json
{
  "answer": "…",
  "sources": [
    { "title": "كيفية إنشاء معايير", "sourceUrl": "https://support.kindix.me/kb/..." }
  ],
  "sessionId": "3f1b2c4a-...-uuid",
  "messageId": "9a7e1d0c-...-uuid"
}
```

`messageId` is the id of the stored assistant message — used to attach feedback (see below).
`sources` can be an empty array if the model reported it didn't have sufficient context; in that
case `answer` says plainly that the information isn't available rather than guessing (this is
enforced by the system prompt in `AnswerService`, not just requested).

**Errors**: `400` if `query` is missing/empty; `401` if the JWT is missing/invalid; `500` if the
embedding service or Gemini is unreachable.

---

## Conversation

### `GET /conversation/history?sessionId=<uuid>`

Returns the stored turns for one conversation. **Requires auth.** Ownership-checked: a session
belonging to a different user returns `404`, not the other user's messages.

**Errors**: `400` if `sessionId` is missing; `404` if no conversation with that id belongs to the
caller.

### `GET /conversation/list`

Returns the caller's own conversations (for the sidebar chat list). **Requires auth.**
User-scoped — this is the real source of truth the frontend now uses in place of the earlier
localStorage-only chat list.

---

## Knowledge (debug/direct retrieval)

### `POST /knowledge/search`

Runs just the retrieval step (embed query → pgvector nearest-neighbour search) without calling
the LLM. Useful for debugging what the RAG pipeline would retrieve for a given question. **No
auth required** — this is a lower-level debug endpoint, not part of the product surface.

**Body**

```json
{ "query": "attendance report" }
```

**Response**

```json
[
  {
    "content": "…chunk text…",
    "title": "تنزيل تقارير غياب المعلمين",
    "sourceUrl": "https://support.kindix.me/kb/...",
    "score": 0.83
  }
]
```

`score` is `1 - cosine_distance`; higher is a better match. Returns up to 5 results by default.

---

## Dashboard (admin only)

All three endpoints require `Authorization: Bearer <token>` for an `admin`-role user
(`JwtAuthGuard` + `RolesGuard` + `@Roles('admin')`). A `school`-role token gets `403`.

### `GET /dashboard/stats`

```json
{
  "feedbackUp": 12,
  "feedbackDown": 3,
  "ticketsOpen": 2,
  "ticketsResolved": 1,
  "ticketsTotal": 3
}
```

### `GET /dashboard/tickets`

Returns every ticket, newest first, with the reporting school's contact info so support can
follow up correctly.

```json
[
  {
    "id": "…uuid…",
    "reason": "negative feedback on chat answer",
    "status": "open",
    "createdAt": "2026-09-10T12:00:00.000Z",
    "school": {
      "schoolName": "Al Noor School",
      "email": "admin@alnoor.edu",
      "phone": "+970500000000",
      "country": "Palestine"
    }
  }
]
```

`school` is `null` if the ticket's conversation has no linked user (e.g. pre-auth data).

### `PATCH /dashboard/tickets/:id/resolve`

Marks a ticket `resolved`. No body. Returns the updated ticket. `404` if the id doesn't exist.

---

## n8n webhooks (not part of the NestJS API, called directly by the frontend)

These live on the n8n instance (default `http://localhost:5678`), not on the NestJS backend.

### `POST /webhook/kindix/feedback` (Collect Feedback workflow)

```json
{ "messageId": "9a7e1d0c-...-uuid", "rating": "down", "comment": "optional free text" }
```

`rating: "down"` triggers the Escalation workflow internally, which creates a `tickets` row. Both
workflows must be toggled **Active** in the n8n UI or the webhook silently does nothing.

## Auth summary table

| Endpoint | Auth | Roles |
|---|---|---|
| `POST /auth/register` | none | — |
| `POST /auth/register-admin` | none | — |
| `POST /auth/login` | none | — |
| `POST /chat/ask` | JWT | any |
| `GET /conversation/history` | JWT | any (own data only) |
| `GET /conversation/list` | JWT | any (own data only) |
| `POST /knowledge/search` | none | — |
| `GET /dashboard/stats` | JWT | `admin` |
| `GET /dashboard/tickets` | JWT | `admin` |
| `PATCH /dashboard/tickets/:id/resolve` | JWT | `admin` |
