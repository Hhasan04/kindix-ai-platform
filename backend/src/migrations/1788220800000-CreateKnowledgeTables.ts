import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateKnowledgeTables
 *
 * Initial knowledge-base schema:
 *   - enables the `vector` (pgvector) and `pgcrypto` extensions
 *   - knowledge_items   — source documents
 *   - knowledge_chunks  — embedded text slices; `embedding` is `vector(1024)`
 *     to match the local BGE-M3 embedding model
 *
 * `embedding` is written as raw SQL here because TypeORM has no native pgvector
 * column type.
 */
export class CreateKnowledgeTables1788220800000 implements MigrationInterface {
  name = 'CreateKnowledgeTables1788220800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.query(`
      CREATE TABLE "knowledge_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" text NOT NULL,
        "category" text[] NOT NULL DEFAULT '{}',
        "language" character varying(8) NOT NULL,
        "source_url" text,
        "last_updated" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_knowledge_items" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "knowledge_chunks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "item_id" uuid NOT NULL,
        "chunk_index" integer NOT NULL,
        "content" text NOT NULL,
        "embedding" vector(1024),
        CONSTRAINT "PK_knowledge_chunks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_knowledge_chunks_item" FOREIGN KEY ("item_id")
          REFERENCES "knowledge_items" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_chunks_item_id" ON "knowledge_chunks" ("item_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_knowledge_chunks_item_id";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_chunks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_items";`);
    // Extensions are left installed on purpose — other schemas may use them.
  }
}
