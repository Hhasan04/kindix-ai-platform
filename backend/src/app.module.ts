// Registers the pgvector `vector` column type before any DataSource is built.
import './database/register-pgvector-type';

import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [
    // Single source of truth for env: the repo-root `.env` — the same file the
    // migration CLI reads in `src/database/data-source.ts`. At runtime
    // `__dirname` is `<repo>/backend/{dist,src}`, so two levels up is the repo
    // root. `override: true` makes those values win over any pre-existing OS
    // environment variables, matching data-source.ts's `dotenv({ override: true })`.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '..', '.env'),
      override: true,
    }),
    // DB connection. Keep in sync with `src/database/data-source.ts` (CLI).
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'kindix'),
        // Primary keys use gen_random_uuid() (pgcrypto / built-in on PG13+).
        uuidExtension: 'pgcrypto',
        autoLoadEntities: true,
        // Never auto-sync: the pgvector column is managed by raw SQL migrations.
        synchronize: false,
      }),
    }),
    KnowledgeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
