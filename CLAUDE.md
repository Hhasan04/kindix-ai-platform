# KINDIX AI Knowledge Platform

## What this is
An internal RAG platform: Angular chat -> NestJS API -> n8n workflows -> Gemini -> pgvector-backed
Postgres knowledge base (BGE-M3 embeddings) -> cited answer. Built during a compressed 3-week
internship sprint; MVP-first, P0/P1/P2 prioritized (see /docs/PLAN.md for the full breakdown).

## Stack
- Backend: NestJS + TypeORM, PostgreSQL 16 + pgvector (`pgvector/pgvector:pg16`)
- Frontend: Angular
- Workflow orchestration: n8n
- Embeddings: BGE-M3 (BAAI), local via sentence-transformers/HuggingFace, no API key required,
  1024 dimensions -- stored as `knowledge_chunks.embedding vector(1024)`. Do NOT assume 1536/OpenAI
  dimensions from older docs or tutorials.
- Chat/generation: Gemini API, free tier -- exact model version not yet finalized, confirm before
  hardcoding
- Deployment: Docker Compose

## Repo layout

- /backend       NestJS API  
- /frontend      Angular app  
- /infra         docker-compose.yml, n8n workflow exports (.json)  
- /knowledge-base  extraction \+ cleaning \+ chunking \+ embedding scripts, articles.json, chunks.json  
- /docs          README, installation guide, developer guide, user guide, test results

## Coding rules (non-negotiable)
- Clean code, SOLID. NestJS: one responsibility per service, controllers stay thin.
- Never hardcode secrets (Gemini API key, DB creds) -- always via .env, and .env is gitignored.
  .env.example must list every required variable with a placeholder value.
- Document every new service and every n8n workflow with a short comment/README at the top of the file.
- Commit after every working increment with a clear message (feat/fix/chore prefix). Don't batch a week
  of work into one commit.

## How to work with me (Claude Code) on this project

- Give scoped tasks: exact objective, which files/modules exist already, expected input/output shape, and explicit "don't touch X" boundaries. Vague requests like "build the RAG system" waste time \-- scope them the way the example prompts in /docs/PLAN.md Section 5 do.  
- After you implement something, I will run it and test it myself before asking for the next step \-- don't chain multiple unrelated features into one response.  
- Prefer editing existing files over creating parallel/duplicate implementations.  
- Ask before introducing a new major dependency.

## Commands

- Backend dev: `cd backend && npm run start:dev`  
- Backend tests: `cd backend && npm run test`  
- Frontend dev: `cd frontend && ng serve`  
- Full stack: `docker compose -f infra/docker-compose.yml up --build`  
- Run KB extractor: `python knowledge-base/kindix_kb_extractor.py`

## Current status

See /docs/PLAN.md and the sprint-review notes in /docs/sprint-reviews/ for what's done, what's in progress, and what's explicitly deprioritized (P2).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
