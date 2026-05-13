/**
 * GenerateResult - Result from non-streaming generation
 *
 * Similar to Vercel AI SDK's generateText() result.
 * Provides both raw access and formatted response methods.
 *
 * @example
 * ```typescript
 * const result = await runtime.generate(body);
 *
 * // Raw access
 * console.log(result.text);
 * console.log(result.toolCalls);
 *
 * // CopilotChat format
 * res.json(result.toResponse());
 * ```
 */

import type { DoneEventMessage } from "../core/stream-events";

export interface GenerateUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateResultData {
  text: string;
  messages: DoneEventMessage[];
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  toolResults: Array<{
    id: string;
    result: unknown;
  }>;
  requiresAction: boolean;
  usage?: GenerateUsage;
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Response format compatible with CopilotChat
 */
export interface CopilotChatResponse {
  success: boolean;
  content: string;
  messages?: DoneEventMessage[];
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    id: string;
    result: unknown;
  }>;
  requiresAction?: boolean;
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * GenerateResult - Non-streaming generation result
 */
export class GenerateResult {
  private data: GenerateResultData;

  constructor(data: GenerateResultData) {
    this.data = data;
  }

  /**
   * Generated text content
   */
  get text(): string {
    return this.data.text;
  }

  /**
   * All messages from the conversation
   */
  get messages(): DoneEventMessage[] {
    return this.data.messages;
  }

  /**
   * Tool calls made during generation
   */
  get toolCalls(): GenerateResultData["toolCalls"] {
    return this.data.toolCalls;
  }

  /**
   * Results from tool executions
   */
  get toolResults(): GenerateResultData["toolResults"] {
    return this.data.toolResults;
  }

  /**
   * Whether client action is required (e.g., tool approval)
   */
  get requiresAction(): boolean {
    return this.data.requiresAction;
  }

  /**
   * Token usage for the call — present when the underlying provider emitted
   * a usage payload on the `done` event. May be undefined for streaming
   * responses that don't yield usage (e.g. mid-stream errors).
   */
  get usage(): GenerateUsage | undefined {
    return this.data.usage;
  }

  /**
   * Error if generation failed
   */
  get error(): GenerateResultData["error"] {
    return this.data.error;
  }

  /**
   * Whether generation was successful
   */
  get success(): boolean {
    return !this.data.error;
  }

  /**
   * Convert to CopilotChat-compatible JSON response
   *
   * @example
   * ```typescript
   * // Express
   * res.json(result.toResponse());
   *
   * // Next.js
   * return Response.json(result.toResponse());
   * ```
   */
  toResponse(): CopilotChatResponse {
    return {
      success: this.success,
      content: this.data.text,
      messages: this.data.messages.length > 0 ? this.data.messages : undefined,
      toolCalls:
        this.data.toolCalls.length > 0 ? this.data.toolCalls : undefined,
      toolResults:
        this.data.toolResults.length > 0 ? this.data.toolResults : undefined,
      requiresAction: this.data.requiresAction || undefined,
      error: this.data.error,
    };
  }

  /**
   * Convert to raw object (without methods)
   */
  toJSON(): GenerateResultData {
    return { ...this.data };
  }
}
