import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AnswerModule } from '../answer/answer.module';
import { ConversationModule } from '../conversation/conversation.module';
import { ChatController } from './chat.controller';

/**
 * ChatModule — wires retrieval (KnowledgeModule), generation (AnswerModule),
 * and turn storage (ConversationModule) together behind POST /chat/ask.
 */
@Module({
  imports: [KnowledgeModule, AnswerModule, ConversationModule],
  controllers: [ChatController],
})
export class ChatModule {}
