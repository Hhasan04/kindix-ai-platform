import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { KnowledgeService, SearchResult } from './knowledge.service';

/**
 * KnowledgeController — HTTP surface for the knowledge base.
 * For now: retrieval only (POST /knowledge/search). Answer generation comes later.
 */
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('search')
  async search(@Body() body: { query?: string }): Promise<SearchResult[]> {
    const query = body?.query?.trim();
    if (!query) {
      throw new BadRequestException('body.query is required');
    }
    return this.knowledgeService.search(query);
  }
}
