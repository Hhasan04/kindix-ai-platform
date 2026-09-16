import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';

/**
 * ConversationModule — chat session + message persistence. Registers the
 * TypeORM repositories and exposes ConversationService.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
