import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LLMProvider } from "@/types";

/**
 * Get an AI SDK model instance for the given provider and model.
 * Uses the user's own API key.
 */
export function getModel(provider: LLMProvider, model: string, apiKey: string) {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model);
    }
    case "openrouter": {
      // OpenRouter uses OpenAI-compatible API
      const openrouter = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": "https://writing-editor.vercel.app",
          "X-Title": "Writing Editor",
        },
      });
      return openrouter(model);
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
