import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import type { SearchResult } from '../knowledge/knowledge.service';
import { getChatModel } from './llm-provider';

/**
 * AnswerService — turns a question + retrieved chunks into a grounded, cited
 * answer via an LLM (provider chosen by `llm-provider.ts`).
 *
 * Single-turn only: no chat history, query condensation, or follow-up handling.
 * The LLM is asked to answer strictly from the supplied chunks and to report
 * which source URLs it used, via structured output (no regex citation parsing).
 */

/** What we ask the LLM to return. Kept flat/simple so Gemini's responseSchema
 *  accepts it (no min/max/refinements that translate to unsupported keywords). */
const answerSchema = z.object({
  answer: z
    .string()
    .describe(
      'The answer to the question, in the same language as the question. ' +
        'If the context does not cover the question, say plainly that the ' +
        'information is not available instead of guessing.',
    ),
  usedBlockIndices: z
    .array(z.number())
    .describe(
      'The numbers of the context blocks (as labeled [1], [2], ...) actually ' +
        'used to write the answer. Empty if no block was used.',
    ),
  hasSufficientContext: z
    .boolean()
    .describe(
      'False if the context blocks did not contain the answer and you are ' +
        "giving the \"I don't have that information\" reply. True otherwise.",
    ),
});

const SYSTEM_PROMPT = [
  'You are the KINDIX knowledge assistant.',
  'Answer the user question using ONLY the information in the numbered context blocks below.',
  'Do not use any outside knowledge and do not guess.',
  "If the context blocks do not contain the answer, reply plainly that you don't have that information.",
  'Always answer in the same language as the question.',
  'In usedBlockIndices, list the number of every context block you actually relied on.',
].join(' ');

const HUMAN_PROMPT = [
  'Question:',
  '{question}',
  '',
  'Context blocks:',
  '{context}',
].join('\n');

@Injectable()
export class AnswerService {
  private readonly logger = new Logger(AnswerService.name);
  private readonly chatModel: BaseChatModel;
  private readonly prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_PROMPT],
    ['human', HUMAN_PROMPT],
  ]);

  constructor(private readonly config: ConfigService) {
    // Build the model once — not per request.
    this.chatModel = getChatModel(this.config);
  }

  async generate(
    query: string,
    chunks: SearchResult[],
  ): Promise<{
    answer: string;
    sources: { title: string; sourceUrl: string | null }[];
  }> {
    const chain = this.prompt.pipe(
      this.chatModel.withStructuredOutput(answerSchema, { name: 'answer' }),
    );

    const result = await chain.invoke({
      question: query,
      context: this.formatContext(chunks),
    });

    return {
      answer: result.answer,
      sources: this.mapSources(
        result.usedBlockIndices,
        chunks,
        result.hasSufficientContext,
      ),
    };
  }

  /** Numbered context blocks the LLM can cite by block index. */
  private formatContext(chunks: SearchResult[]): string {
    if (chunks.length === 0) {
      return '(no context found)';
    }
    return chunks
      .map((chunk, i) =>
        [
          `[${i + 1}] title: ${chunk.title}`,
          `sourceUrl: ${chunk.sourceUrl ?? '(none)'}`,
          `content: ${chunk.content}`,
        ].join('\n'),
      )
      .join('\n\n');
  }

  /** Resolve the LLM-reported block numbers (1-based, matching the [N] labels
   *  from formatContext) back to {title, sourceUrl} from the inputs,
   *  de-duplicated and preserving retrieval order. Out-of-range indices are
   *  dropped rather than throwing — the model's self-report is untrusted
   *  input. Indices avoid the string-matching fragility of comparing
   *  model-transcribed URLs (e.g. long percent-encoded Arabic URLs can come
   *  back with a dropped/garbled character).
   *
   *  If the model reports hasSufficientContext=true (i.e. it isn't giving the
   *  "I don't have that information" reply) but none of its reported indices
   *  resolved to a chunk, that's a self-report failure, not evidence the
   *  answer is ungrounded — fall back to citing the top-scored retrieved
   *  chunk so the response isn't shown with zero sources, and log it so it
   *  stays visible. */
  private mapSources(
    usedBlockIndices: number[],
    chunks: SearchResult[],
    hasSufficientContext: boolean,
  ): { title: string; sourceUrl: string | null }[] {
    const used = new Set(usedBlockIndices);
    const sources: { title: string; sourceUrl: string | null }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      if (!used.has(i + 1)) continue;
      const chunk = chunks[i];
      if (!chunk.sourceUrl) continue;
      sources.push({ title: chunk.title, sourceUrl: chunk.sourceUrl });
    }

    if (sources.length === 0 && chunks.length > 0 && hasSufficientContext) {
      const topChunk = chunks[0];
      this.logger.warn(
        `mapSources: model reported hasSufficientContext=true but no usedBlockIndices ` +
          `resolved to a chunk (reported: ${JSON.stringify(usedBlockIndices)}); ` +
          `falling back to top-scored chunk "${topChunk.sourceUrl}"`,
      );
      if (topChunk.sourceUrl) {
        sources.push({ title: topChunk.title, sourceUrl: topChunk.sourceUrl });
      }
    }

    return sources;
  }
}
