# Graph Report - kindix-ai-platform  (2026-09-16)

## Corpus Check
- 89 files · ~92,575 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 683 nodes · 941 edges · 53 communities (26 shown, 27 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1a02eb37`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devDependencies
- KnowledgeChunk
- compilerOptions
- dependencies
- scripts
- app.module.ts
- auth.module.ts
- kindix_kb_extractor.py
- README.md
- KINDIX AI Knowledge Platform
- extract_transcripts.py
- exclude
- frontend
- download_and_transcribe.py
- nest-cli.json
- CreateKnowledgeTables1788220800000
- chunk.py
- embed_and_store.py
- embed
- Conversation
- ChatComponent
- CreateConversationTables1788307200000
- CreateFeedbackAndTicketTables1788400000000
- dependencies
- devDependencies
- Frontend
- AuthService
- dashboard.module.ts
- CreateUsersTable1788500000000
- @eslint/eslintrc
- @eslint/js
- eslint-plugin-prettier
- globals
- jest
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- prettier
- source-map-support
- supertest
- ts-jest
- ts-loader
- ts-node
- tsconfig-paths
- @types/express
- @types/jest
- @types/node
- @types/passport-jwt
- @types/supertest
- typescript
- typescript-eslint
- AddUserIdToConversations1788600000000

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 22 edges
2. `AuthService` - 20 edges
3. `ChatComponent` - 19 edges
4. `scripts` - 17 edges
5. `Conversation` - 16 edges
6. `ConversationService` - 12 edges
7. `Message` - 12 edges
8. `KnowledgeChunk` - 12 edges
9. `AuthService` - 11 edges
10. `User` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Conversation` --references--> `User`  [EXTRACTED]
  backend/src/conversation/entities/conversation.entity.ts → backend/src/auth/entities/user.entity.ts
- `Ticket` --references--> `Conversation`  [EXTRACTED]
  backend/src/dashboard/entities/ticket.entity.ts → backend/src/conversation/entities/conversation.entity.ts
- `DashboardController` --references--> `Roles()`  [EXTRACTED]
  backend/src/dashboard/dashboard.controller.ts → backend/src/auth/decorators/roles.decorator.ts
- `JwtPayload` --references--> `UserRole`  [EXTRACTED]
  backend/src/auth/jwt-payload.interface.ts → backend/src/auth/entities/user.entity.ts
- `Conversation` --references--> `Message`  [EXTRACTED]
  backend/src/conversation/entities/conversation.entity.ts → backend/src/conversation/entities/message.entity.ts

## Import Cycles
- None detected.

## Communities (53 total, 27 thin omitted)

### Community 0 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, eslint, eslint-config-prettier, @types/bcryptjs, eslint, eslint-config-prettier, @types/bcryptjs

### Community 1 - "KnowledgeChunk"
Cohesion: 0.08
Nodes (27): answerSchema, AnswerService, HUMAN_PROMPT, SYSTEM_PROMPT, Injectable, getChatModel(), KnowledgeChunk, Column (+19 more)

### Community 2 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 3 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, bcryptjs, @google/genai, langchain, @langchain/core, @langchain/google-genai, @nestjs/common, @nestjs/config (+29 more)

### Community 4 - "scripts"
Cohesion: 0.05
Nodes (36): author, description, jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment (+28 more)

### Community 5 - "app.module.ts"
Cohesion: 0.07
Nodes (23): AnswerModule, Module, AppController, Controller, Get, AppModule, Module, AppService (+15 more)

### Community 6 - "auth.module.ts"
Cohesion: 0.08
Nodes (23): AuthController, Body, Controller, Post, AuthResponse, AuthService, LoginInput, RegisterAdminInput (+15 more)

### Community 7 - "kindix_kb_extractor.py"
Cohesion: 0.29
Nodes (11): build_taxonomy_map(), detect_language(), fetch_all(), get_json(), html_to_clean_text(), main(), Strip an article's rendered HTML down to plain readable text, and separately…, Fetch every item of a REST collection, following WP pagination via X-WP-… (+3 more)

### Community 8 - "README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 9 - "KINDIX AI Knowledge Platform"
Cohesion: 0.20
Nodes (9): Coding rules (non-negotiable), Commands, Current status, graphify, How to work with me (Claude Code) on this project, KINDIX AI Knowledge Platform, Repo layout, Stack (+1 more)

### Community 10 - "extract_transcripts.py"
Cohesion: 0.36
Nodes (9): extract_video_id(), fetch_transcript_text(), get_video_ids(), load_cache(), main(), Attempts every unresolved video once. Returns True if it stopped early due to…, Returns (transcript_text_or_None, status_string)., run_batch() (+1 more)

### Community 11 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 12 - "frontend"
Cohesion: 0.05
Nodes (44): build, extract-i18n, serve, test, builder, configurations, defaultConfiguration, options (+36 more)

### Community 13 - "download_and_transcribe.py"
Cohesion: 0.52
Nodes (6): download_audio(), extract_video_id(), get_video_ids(), load_cache(), main(), save_cache()

### Community 14 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 17 - "chunk.py"
Cohesion: 0.23
Nodes (13): flag_reason(), main(), n_tokens(), normalize(), pack(), Break content into pieces each <= TARGET_TOKENS, preferring natural boundaries:…, Greedily combine segments without exceeding TARGET_TOKENS per chunk., Prepend ~OVERLAP_TOKENS from the tail of each chunk to the next one. (+5 more)

### Community 18 - "embed_and_store.py"
Cohesion: 0.33
Nodes (9): embed_chunks(), insert_chunks(), insert_items(), load_db_env(), main(), parse_timestamp(), INSERT one knowledge_items row per article; return id_map + counters., Format an embedding as a pgvector literal, e.g. '[0.12345678,-0.001,...]'. (+1 more)

### Community 19 - "embed"
Cohesion: 0.53
Nodes (5): BaseModel, embed(), EmbedRequest, EmbedResponse, post

### Community 20 - "Conversation"
Cohesion: 0.07
Nodes (33): JwtAuthGuard, Injectable, ChatController, Body, Controller, Post, Request, UseGuards (+25 more)

### Community 21 - "ChatComponent"
Cohesion: 0.07
Nodes (15): ChatComponent, ChatMessage, AskResponse, ChatService, ChatSource, ConversationListEntry, FeedbackRating, HistoryMessage (+7 more)

### Community 24 - "dependencies"
Cohesion: 0.06
Nodes (32): @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, dependencies, @angular/common (+24 more)

### Community 25 - "devDependencies"
Cohesion: 0.09
Nodes (23): @angular/build, @angular/cli, @angular/compiler-cli, devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, jasmine-core (+15 more)

### Community 26 - "Frontend"
Cohesion: 0.25
Nodes (7): Additional Resources, Building, Code scaffolding, Development server, Frontend, Running end-to-end tests, Running unit tests

### Community 27 - "AuthService"
Cohesion: 0.06
Nodes (25): AdminDashboardComponent, Component, DashboardService, DashboardStats, Ticket, TicketSchool, Injectable, App (+17 more)

### Community 28 - "dashboard.module.ts"
Cohesion: 0.09
Nodes (21): Roles(), DashboardController, Controller, Get, UseGuards, DashboardService, DashboardStats, Injectable (+13 more)

## Knowledge Gaps
- **205 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+200 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `scripts`, `@eslint/eslintrc`, `@eslint/js`, `eslint-plugin-prettier`, `globals`, `jest`, `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing`, `prettier`, `source-map-support`, `supertest`, `ts-jest`, `ts-loader`, `ts-node`, `tsconfig-paths`, `@types/express`, `@types/jest`, `@types/node`, `@types/passport-jwt`, `@types/supertest`, `typescript`, `typescript-eslint`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `Conversation` connect `Conversation` to `dashboard.module.ts`, `auth.module.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _205 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `KnowledgeChunk` be split into smaller, more focused modules?**
  _Cohesion score 0.07862679955703211 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._