import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message, MessageRole } from './entities/message.entity';

/**
 * ConversationService — persistence for chat sessions and their turns.
 * Storage only: no history is read back into generation yet.
 */
@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * Resolves the conversation for a session, creating one if `sessionId` is
   * unset or unknown. Generates a new session id when none is given.
   */
  async findOrCreate(
    sessionId?: string,
  ): Promise<{ id: string; sessionId: string }> {
    const resolvedSessionId = sessionId?.trim() || randomUUID();

    const existing = await this.conversationRepository.findOne({
      where: { sessionId: resolvedSessionId },
      order: { createdAt: 'DESC' },
    });
    if (existing) {
      return { id: existing.id, sessionId: existing.sessionId };
    }

    const created = await this.conversationRepository.save(
      this.conversationRepository.create({ sessionId: resolvedSessionId }),
    );
    return { id: created.id, sessionId: created.sessionId };
  }

  /**
   * Inserts the user question, then the assistant answer, for a conversation.
   * Returns the assistant message's id so callers can attach feedback/tickets
   * to it.
   */
  async appendTurn(
    conversationId: string,
    question: string,
    answer: string,
    sources: unknown,
  ): Promise<{ assistantMessageId: string }> {
    await this.messageRepository.save(
      this.messageRepository.create({
        conversation: { id: conversationId } as Conversation,
        role: 'user',
        content: question,
        sources: null,
      }),
    );
    const assistantMessage = await this.messageRepository.save(
      this.messageRepository.create({
        conversation: { id: conversationId } as Conversation,
        role: 'assistant',
        content: answer,
        sources,
      }),
    );
    return { assistantMessageId: assistantMessage.id };
  }

  /**
   * Returns the messages for the conversation matching `sessionId`, ordered
   * oldest-first, or null if no conversation has that session id.
   */
  async getHistory(sessionId: string): Promise<
    | {
        id: string;
        role: MessageRole;
        content: string;
        sources: unknown | null;
        createdAt: Date;
      }[]
    | null
  > {
    const conversation = await this.conversationRepository.findOne({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });
    if (!conversation) {
      return null;
    }

    const messages = await this.messageRepository.find({
      where: { conversation: { id: conversation.id } },
      order: { createdAt: 'ASC' },
    });

    return messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.sources,
      createdAt: message.createdAt,
    }));
  }
}
