/**
 * data-source.ts
 *
 * Standalone TypeORM DataSource for the CLI (migration generate / run / revert).
 * The running NestJS app configures TypeORM separately in `app.module.ts` via
 * `TypeOrmModule.forRootAsync`; both must stay in sync.
 *
 * Reads DB_* vars from the repo-root `.env` (same file the app uses).
 *
 * Usage (from /backend):
 *   npm run migration:run
 *   npm run migration:revert
 *   npm run migration:generate -- src/migrations/SomeName
 */

import './register-pgvector-type';

import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

// .env lives at the repo root, one level above /backend.
loadEnv({ path: join(__dirname, '..', '..', '..', '.env'), override: true });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'kindix',
  // pgvector primary keys use gen_random_uuid() (pgcrypto / built-in on PG13+).
  uuidExtension: 'pgcrypto',
  synchronize: false,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
});
