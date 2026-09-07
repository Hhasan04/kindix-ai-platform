import { Module } from '@nestjs/common';
import { AnswerService } from './answer.service';

/**
 * AnswerModule — LLM answer generation for the RAG pipeline. Exposes
 * AnswerService, which grounds answers in retrieved chunks and returns
 * structured citations. Provider (Gemini now) is selected in `llm-provider.ts`.
 */
@Module({
  providers: [AnswerService],
  exports: [AnswerService],
})
export class AnswerModule {}
