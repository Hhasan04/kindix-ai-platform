import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message, MessageRole } from './entities/message.entity';

const TITLE_MAX_LENGTH = 40;

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
   * Resolves the caller's conversation for a session, creating one if
   * `sessionId` is unset, unknown, or belongs to a different user. In the
   * "belongs to someone else" case this silently creates a fresh
   * conversation rather than throwing — a mismatched owner is treated the
   * same as an unknown session id, never surfaced as an error.
   */
  async findOrCreate(
    sessionId: string | undefined,
    userId: string,
  ): Promise<{ id: string; sessionId: string }> {
    const resolvedSessionId = sessionId?.trim() || randomUUID();

    const existing = await this.conversationRepository.findOne({
      where: { sessionId: resolvedSessionId, userId },
      order: { createdAt: 'DESC' },
    });
    if (existing) {
      return { id: existing.id, sessionId: existing.sessionId };
    }

    const created = await this.conversationRepository.save(
      this.conversationRepository.create({
        sessionId: resolvedSessionId,
        userId,
      }),
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
   * Returns the messages for the conversation matching `sessionId` and
   * owned by `userId`, ordered oldest-first, or null either when no such
   * conversation exists or when it belongs to someone else — the two cases
   * are indistinguishable to the caller by design.
   */
  async getHistory(
    sessionId: string,
    userId: string,
  ): Promise<
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
      where: { sessionId, userId },
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

  /**
   * Lists the caller's conversations, newest-active first. `title` is the
   * first ~40 characters of the conversation's first user message (empty
   * when it has none yet); `updatedAt` is its last message's timestamp,
   * falling back to the conversation's own `createdAt` when it has no
   * messages.
   */
  async listConversations(
    userId: string,
  ): Promise<{ sessionId: string; title: string; updatedAt: Date }[]> {
    const rows = await this.conversationRepository.manager.query<
      { sessionId: string; title: string; updatedAt: Date }[]
    >(
      `
      SELECT c.session_id                          AS "sessionId",
             COALESCE(fm.content, '')               AS "title",
             COALESCE(lm.created_at, c.created_at)  AS "updatedAt"
      FROM conversations c
      LEFT JOIN LATERAL (
        SELECT content FROM messages
        WHERE conversation_id = c.id AND role = 'user'
        ORDER BY created_at ASC
        LIMIT 1
      ) fm ON TRUE
      LEFT JOIN LATERAL (
        SELECT created_at FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) lm ON TRUE
      WHERE c.user_id = $1
      ORDER BY "updatedAt" DESC
      `,
      [userId],
    );

    return rows.map((row) => ({
      sessionId: row.sessionId,
      title: row.title.slice(0, TITLE_MAX_LENGTH),
      updatedAt: row.updatedAt,
    }));
  }
}
