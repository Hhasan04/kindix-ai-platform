import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateConversationTables
 *
 * Conversation storage schema:
 *   - conversations — one row per chat session (`session_id`)
 *   - messages      — user/assistant turns within a conversation; `sources`
 *     is jsonb, mirroring AnswerService's `{title, sourceUrl}[]` output and
 *     null for user messages
 */
export class CreateConversationTables1788307200000
  implements MigrationInterface
{
  name = 'CreateConversationTables1788307200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "session_id" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_session_id" ON "conversations" ("session_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversation_id" uuid NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "sources" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "conversations" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_messages_conversation_id" ON "messages" ("conversation_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_messages_conversation_id";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "messages";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_conversations_session_id";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations";`);
  }
}
