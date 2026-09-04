# Graph Report - kindix-ai-platform  (2026-09-02)

## Corpus Check
- 34 files · ~82,828 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 270 nodes · 319 edges · 19 communities (18 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- devDependencies
- KnowledgeChunk
- compilerOptions
- dependencies
- package.json
- app.module.ts
- scripts
- kindix_kb_extractor.py
- README.md
- KINDIX AI Knowledge Platform
- extract_transcripts.py
- exclude
- register-pgvector-type.ts
- download_and_transcribe.py
- nest-cli.json
- CreateKnowledgeTables1788220800000
- chunk.py
- embed_and_store.py

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 22 edges
2. `scripts` - 17 edges
3. `KnowledgeChunk` - 12 edges
4. `KnowledgeItem` - 10 edges
5. `KINDIX AI Knowledge Platform` - 9 edges
6. `jest` - 8 edges
7. `AppService` - 7 edges
8. `AppController` - 6 edges
9. `KnowledgeService` - 6 edges
10. `main()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `KnowledgeChunk` --references--> `KnowledgeItem`  [EXTRACTED]
  backend/src/knowledge/entities/knowledge-chunk.entity.ts → backend/src/knowledge/entities/knowledge-item.entity.ts

## Import Cycles
- None detected.

## Communities (19 total, 1 thin omitted)

### Community 0 - "devDependencies"
Cohesion: 0.04
Nodes (47): devDependencies, eslint, eslint-config-prettier, @eslint/eslintrc, @eslint/js, eslint-plugin-prettier, globals, jest (+39 more)

### Community 1 - "KnowledgeChunk"
Cohesion: 0.14
Nodes (17): KnowledgeChunk, Column, Entity, PrimaryGeneratedColumn, KnowledgeItem, Column, Entity, PrimaryGeneratedColumn (+9 more)

### Community 2 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 3 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @google/genai, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/platform-express, @nestjs/typeorm, pg (+13 more)

### Community 4 - "package.json"
Cohesion: 0.10
Nodes (19): author, description, jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment (+11 more)

### Community 5 - "app.module.ts"
Cohesion: 0.17
Nodes (9): AppController, Controller, AppModule, Module, AppService, Injectable, KnowledgeModule, Module (+1 more)

### Community 6 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, format, lint, migration:generate, migration:revert, migration:run, start (+9 more)

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

### Community 12 - "register-pgvector-type.ts"
Cohesion: 0.29
Nodes (4): AppDataSource, driverModule, PGVECTOR_TYPES, PgVectorPostgresDriver

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

## Knowledge Gaps
- **115 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+110 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _115 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `KnowledgeChunk` be split into smaller, more focused modules?**
  _Cohesion score 0.14492753623188406 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._