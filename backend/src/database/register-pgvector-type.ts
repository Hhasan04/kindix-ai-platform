/**
 * register-pgvector-type.ts
 *
 * Teaches TypeORM's Postgres driver that pgvector's `vector` column type exists.
 *
 * Why this is needed:
 *   TypeORM has no native pgvector support. Any entity column declared as
 *   `type: 'vector'` is rejected by EntityMetadataValidator with
 *   `DataTypeNotSupportedError`, because `vector` is not in the driver's
 *   `supportedDataTypes` list (nor in `withLengthColumnTypes`, so `vector(1024)`
 *   would also be refused).
 *
 * What this does:
 *   Subclasses `PostgresDriver`, appends `vector` to both lists on every
 *   instance, and swaps the subclass back into the module export that
 *   TypeORM's `DriverFactory` reads at connection time.
 *
 * What this does NOT do:
 *   It only makes the type *declarable*. Reading/writing real embeddings still
 *   needs raw SQL or a `ValueTransformer` (Postgres returns `vector` values as
 *   the string `'[0.1,0.2,...]'`). None is wired yet — see
 *   `KnowledgeChunk.embedding`.
 *
 * Import this module for its side effect BEFORE any DataSource is constructed
 * (it is imported at the top of `app.module.ts` and `database/data-source.ts`).
 */

import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';

// TypeORM ships as CommonJS; grab the live module namespace so the reassignment
// below is visible to `DriverFactory`, which resolves `.PostgresDriver` lazily.
const driverModule = require('typeorm/driver/postgres/PostgresDriver') as {
  PostgresDriver: typeof PostgresDriver;
};

const PGVECTOR_TYPES = ['vector'] as const;

class PgVectorPostgresDriver extends PostgresDriver {
  constructor(...args: ConstructorParameters<typeof PostgresDriver>) {
    super(...args);
    for (const type of PGVECTOR_TYPES) {
      if (!this.supportedDataTypes.includes(type as never)) {
        this.supportedDataTypes.push(type as never);
      }
      if (!this.withLengthColumnTypes.includes(type as never)) {
        this.withLengthColumnTypes.push(type as never);
      }
    }
  }
}

driverModule.PostgresDriver = PgVectorPostgresDriver;
