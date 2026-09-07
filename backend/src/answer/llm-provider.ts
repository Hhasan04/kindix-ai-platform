import { ConfigService } from '@nestjs/config';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

/**
 * llm-provider — single place that decides which chat LLM the RAG pipeline uses.
 *
 * AnswerService depends only on the abstract `BaseChatModel` returned here, so
 * swapping providers (or adding a new one) never touches AnswerService. Provider
 * choice is driven by the `LLM_PROVIDER` env var (default: `gemini`).
 */

/** Low temperature: answers should stick closely to the retrieved chunks. */
const DEFAULT_TEMPERATURE = 0.2;

export function getChatModel(config: ConfigService): BaseChatModel {
  const provider = config.get<string>('LLM_PROVIDER', 'google');

  switch (provider) {
    case 'google': {
      const apiKey = config.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set (required for LLM_PROVIDER=google)');
      }
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: config.get<string>('GEMINI_MODEL', 'gemini-3.6-flash'),
        temperature: DEFAULT_TEMPERATURE,
        // This is fact-retrieval (answer strictly from provided context), which
        // doesn't need Gemini 3.x's variable-length internal reasoning — the
        // default "medium" thinking level adds ~20s of latency for no accuracy
        // gain here. "LOW" is the lowest level the API exposes (no "MINIMAL").
        thinkingConfig: {
          thinkingLevel: 'LOW',
        },
      });
    }

    // To add OpenAI later: `npm i @langchain/openai`, then add
    //   case 'openai': return new ChatOpenAI({ apiKey: config.get('OPENAI_API_KEY'),
    //                                          model: config.get('OPENAI_MODEL'),
    //                                          temperature: DEFAULT_TEMPERATURE });
    // No other change anywhere — AnswerService only sees BaseChatModel.

    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${provider}". Supported: "google".`,
      );
  }
}
