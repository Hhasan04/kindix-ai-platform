import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddUserIdToConversations
 *
 * Adds a nullable owner reference to `conversations`. Nullable because
 * conversations created before auth existed have no owner and stay orphaned.
 */
export class AddUserIdToConversations1788600000000 implements MigrationInterface {
  name = 'AddUserIdToConversations1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations"
        ADD COLUMN "user_id" uuid,
        ADD CONSTRAINT "FK_conversations_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE SET NULL;
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_user_id" ON "conversations" ("user_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_conversations_user_id";`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "FK_conversations_user";`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "user_id";`,
    );
  }
}
