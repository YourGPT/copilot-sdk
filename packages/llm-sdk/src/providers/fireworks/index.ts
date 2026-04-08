/**
 * Fireworks Provider
 *
 * Fireworks.ai is a high-performance inference platform for open-source models
 * (Llama, DeepSeek, Qwen, Mixtral, Gemma, and more).
 *
 * Uses an OpenAI-compatible API — set FIREWORKS_API_KEY in your environment.
 *
 * @see https://fireworks.ai/docs
 *
 * @example
 * ```ts
 * import { fireworks } from '@yourgpt/llm-sdk/fireworks';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: fireworks('accounts/fireworks/models/llama-v3p1-70b-instruct'),
 *   prompt: 'Hello!',
 * });
 * ```
 */

export { fireworks, createFireworks } from "./provider";
export type { FireworksProviderOptions } from "./provider";
