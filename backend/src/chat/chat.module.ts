import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AnswerModule } from '../answer/answer.module';
import { ChatController } from './chat.controller';

/**
 * ChatModule — wires retrieval (KnowledgeModule) and generation (AnswerModule)
 * together behind POST /chat/ask.
 */
@Module({
  imports: [KnowledgeModule, AnswerModule],
  controllers: [ChatController],
})
export class ChatModule {}
