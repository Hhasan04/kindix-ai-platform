import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateUsersTable
 *
 * users — auth accounts for the two roles the platform supports: 'school'
 *   (self-registered, drives the chat UI) and 'admin' (created out-of-band
 *   for customer-service staff, drives the dashboard).
 */
export class CreateUsersTable1788500000000 implements MigrationInterface {
  name = 'CreateUsersTable1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "role" text NOT NULL,
        "school_name" text,
        "phone" text,
        "country" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}
