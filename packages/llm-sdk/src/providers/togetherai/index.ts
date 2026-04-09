/**
 * Together AI Provider
 *
 * Together AI is a high-performance inference platform for open-source models
 * (Llama, DeepSeek, Qwen, Mistral, Gemma, and more).
 *
 * Uses an OpenAI-compatible API — set TOGETHER_API_KEY in your environment.
 *
 * @see https://docs.together.ai/reference
 *
 * @example
 * ```ts
 * import { togetherai } from '@yourgpt/llm-sdk/togetherai';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: togetherai('meta-llama/Llama-3.3-70B-Instruct-Turbo'),
 *   prompt: 'Hello!',
 * });
 * ```
 */

export { togetherai, createTogetherAI } from "./provider";
export type { TogetherAIProviderOptions } from "./provider";
