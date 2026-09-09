import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AnswerService } from '../answer/answer.service';
import { ConversationService } from '../conversation/conversation.service';

/**
 * ChatController — the end-to-end RAG endpoint: retrieve, generate, persist.
 * Still single-turn generation (no history read back into the prompt) — each
 * turn is stored under a conversation so the client can continue the same
 * session by echoing back `sessionId`.
 */
@Controller('chat')
export class ChatController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly answerService: AnswerService,
    private readonly conversationService: ConversationService,
  ) {}

  @Post('ask')
  async ask(
    @Body() body: { query?: string; sessionId?: string },
  ): Promise<{
    answer: string;
    sources: { title: string; sourceUrl: string | null }[];
    sessionId: string;
  }> {
    const query = body?.query?.trim();
    if (!query) {
      throw new BadRequestException('body.query is required');
    }

    const chunks = await this.knowledgeService.search(query);
    const { answer, sources } = await this.answerService.generate(
      query,
      chunks,
    );

    const conversation = await this.conversationService.findOrCreate(
      body?.sessionId,
    );
    await this.conversationService.appendTurn(
      conversation.id,
      query,
      answer,
      sources,
    );

    return { answer, sources, sessionId: conversation.sessionId };
  }
}
