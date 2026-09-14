import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateFeedbackAndTicketTables
 *
 * feedback — per-assistant-message rating/comment left by a user; written
 *   and read directly by n8n's Postgres node (no NestJS entity/service).
 * tickets  — a flagged conversation (optionally scoped to one message)
 *   raised for human follow-up; also owned entirely by n8n workflows.
 */
export class CreateFeedbackAndTicketTables1788400000000
  implements MigrationInterface
{
  name = 'CreateFeedbackAndTicketTables1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feedback" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "message_id" uuid NOT NULL,
        "rating" text NOT NULL,
        "comment" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feedback" PRIMARY KEY ("id"),
        CONSTRAINT "FK_feedback_message" FOREIGN KEY ("message_id")
          REFERENCES "messages" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_feedback_message_id" ON "feedback" ("message_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversation_id" uuid NOT NULL,
        "message_id" uuid,
        "reason" text NOT NULL,
        "status" text NOT NULL DEFAULT 'open',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tickets_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "conversations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tickets_message" FOREIGN KEY ("message_id")
          REFERENCES "messages" ("id")
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_conversation_id" ON "tickets" ("conversation_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_conversation_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tickets";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_feedback_message_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback";`);
  }
}
