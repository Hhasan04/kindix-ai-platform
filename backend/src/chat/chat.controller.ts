import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AnswerService } from '../answer/answer.service';

/**
 * ChatController — the end-to-end RAG endpoint: retrieve, then generate.
 * Single-turn only. `sessionId` is accepted for forward compatibility with
 * conversation storage but is not used yet.
 */
@Controller('chat')
export class ChatController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly answerService: AnswerService,
  ) {}

  @Post('ask')
  async ask(
    @Body() body: { query?: string; sessionId?: string },
  ): Promise<{
    answer: string;
    sources: { title: string; sourceUrl: string | null }[];
  }> {
    const query = body?.query?.trim();
    if (!query) {
      throw new BadRequestException('body.query is required');
    }

    const chunks = await this.knowledgeService.search(query);
    return this.answerService.generate(query, chunks);
  }
}
