import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { KnowledgeItem } from './entities/knowledge-item.entity';

/** One retrieved chunk, ready to cite. `score` is 1 - cosine distance. */
export interface SearchResult {
  content: string;
  title: string;
  sourceUrl: string | null;
  score: number;
}

interface EmbedResponse {
  embedding: number[];
}

// Local BGE-M3 service (knowledge-base/embedding_service.py). Same model and
// settings as the ingestion script, so query vectors match the stored ones.
const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL ?? 'http://localhost:8001';

/**
 * KnowledgeService — knowledge-base persistence + retrieval.
 *
 * `search()` embeds the query via the local embedding service and runs a
 * pgvector cosine-distance nearest-neighbour lookup over knowledge_chunks.
 * Answer generation is intentionally not here yet.
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(KnowledgeItem)
    private readonly itemRepository: Repository<KnowledgeItem>,
    @InjectRepository(KnowledgeChunk)
    private readonly chunkRepository: Repository<KnowledgeChunk>,
  ) {}

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    const embedding = await this.embedQuery(query);
    const vectorLiteral = `[${embedding.join(',')}]`;

    // knowledge_chunks.embedding is vector(1024); `<=>` is pgvector cosine
    // distance (0 = identical, 2 = opposite). Lower distance = better match.
    const rows = await this.chunkRepository.manager.query<
      { content: string; title: string; sourceUrl: string | null; score: string }[]
    >(
      `
      SELECT c.content                          AS content,
             i.title                            AS title,
             i.source_url                       AS "sourceUrl",
             1 - (c.embedding <=> $1::vector)   AS score
      FROM knowledge_chunks c
      JOIN knowledge_items i ON i.id = c.item_id
      WHERE c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $2
      `,
      [vectorLiteral, topK],
    );

    return rows.map((row) => ({
      content: row.content,
      title: row.title,
      sourceUrl: row.sourceUrl,
      score: Number(row.score),
    }));
  }

  private async embedQuery(query: string): Promise<number[]> {
    let response: Response;
    try {
      response = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query }),
      });
    } catch (cause) {
      this.logger.error(`Embedding service unreachable at ${EMBEDDING_SERVICE_URL}`);
      throw new InternalServerErrorException('Embedding service unreachable', {
        cause,
      });
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Embedding service returned ${response.status}`,
      );
    }

    const body = (await response.json()) as EmbedResponse;
    if (!Array.isArray(body.embedding) || body.embedding.length === 0) {
      throw new InternalServerErrorException('Embedding service returned no vector');
    }
    return body.embedding;
  }
}
