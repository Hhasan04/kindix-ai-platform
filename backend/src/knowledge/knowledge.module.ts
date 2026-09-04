import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { KnowledgeItem } from './entities/knowledge-item.entity';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

/**
 * KnowledgeModule — the knowledge-base domain: source items and their embedded
 * chunks. Registers the two TypeORM repositories and exposes KnowledgeService.
 */
@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeItem, KnowledgeChunk])],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
