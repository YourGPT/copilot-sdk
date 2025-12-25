import type { Source } from "./message";
import type { ToolResponse, ToolExecutionStatus } from "./tools";

/**
 * Stream event types
 */
export type StreamEventType =
  | "message:start"
  | "message:delta"
  | "message:end"
  | "thinking:start"
  | "thinking:delta"
  | "thinking:end"
  | "source:add"
  | "action:start"
  | "action:args"
  | "action:end"
  | "tool_calls"
  | "tool:status"
  | "tool:result"
  | "loop:iteration"
  | "loop:complete"
  | "error"
  | "done";

/**
 * Base event interface
 */
interface BaseEvent {
  type: StreamEventType;
}

/**
 * Message started streaming
 */
export interface MessageStartEvent extends BaseEvent {
  type: "message:start";
  /** Message ID */
  id: string;
}

/**
 * Message content delta (incremental update)
 */
export interface MessageDeltaEvent extends BaseEvent {
  type: "message:delta";
  /** Content chunk */
  content: string;
}

/**
 * Message finished streaming
 */
export interface MessageEndEvent extends BaseEvent {
  type: "message:end";
}

// ============================================
// Thinking/Reasoning Events
// ============================================

/**
 * Thinking/reasoning started (for models like Claude, DeepSeek)
 */
export interface ThinkingStartEvent extends BaseEvent {
  type: "thinking:start";
}

/**
 * Thinking content delta (incremental update)
 */
export interface ThinkingDeltaEvent extends BaseEvent {
  type: "thinking:delta";
  /** Thinking content chunk */
  content: string;
}

/**
 * Thinking finished
 */
export interface ThinkingEndEvent extends BaseEvent {
  type: "thinking:end";
}

/**
 * Knowledge base source added
 */
export interface SourceAddEvent extends BaseEvent {
  type: "source:add";
  /** Source document */
  source: Source;
}

/**
 * Action/tool execution started
 */
export interface ActionStartEvent extends BaseEvent {
  type: "action:start";
  /** Tool call ID */
  id: string;
  /** Action name */
  name: string;
}

/**
 * Action arguments (streaming)
 */
export interface ActionArgsEvent extends BaseEvent {
  type: "action:args";
  /** Tool call ID */
  id: string;
  /** Partial arguments JSON */
  args: string;
}

/**
 * Action execution completed
 */
export interface ActionEndEvent extends BaseEvent {
  type: "action:end";
  /** Tool call ID */
  id: string;
  /** Action name */
  name?: string;
  /** Result of the action */
  result?: unknown;
  /** Error if failed */
  error?: string;
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseEvent {
  type: "error";
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
}

/**
 * Stream completed
 */
export interface DoneEvent extends BaseEvent {
  type: "done";
  /**
   * True when client needs to execute tools and send results in next request
   * (Vercel AI SDK pattern)
   */
  requiresAction?: boolean;
}

// ============================================
// Tool/Loop Events (Agentic Loop)
// ============================================

/**
 * Tool call information for client execution
 */
export interface ToolCallInfo {
  /** Unique tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments (parsed JSON) */
  args: Record<string, unknown>;
}

/**
 * Assistant message with tool calls (for including in next request)
 */
export interface AssistantToolMessage {
  role: "assistant";
  content: string | null;
  tool_calls: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * Server detected tool calls - client should execute and send results in next request
 * (Vercel AI SDK pattern - replaces tool:execute)
 */
export interface ToolCallsEvent extends BaseEvent {
  type: "tool_calls";
  /** Tool calls to execute */
  toolCalls: ToolCallInfo[];
  /**
   * Assistant message to include in next request's messages
   * This preserves the tool_calls structure for the LLM
   */
  assistantMessage: AssistantToolMessage;
}

/**
 * Tool execution status update
 */
export interface ToolStatusEvent extends BaseEvent {
  type: "tool:status";
  /** Tool call ID */
  id: string;
  /** Execution status */
  status: ToolExecutionStatus;
}

/**
 * Tool result received (from client or server)
 */
export interface ToolResultEvent extends BaseEvent {
  type: "tool:result";
  /** Tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool result */
  result: ToolResponse;
}

/**
 * Loop iteration progress
 */
export interface LoopIterationEvent extends BaseEvent {
  type: "loop:iteration";
  /** Current iteration number (1-based) */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations: number;
}

/**
 * Loop completed
 */
export interface LoopCompleteEvent extends BaseEvent {
  type: "loop:complete";
  /** Total iterations executed */
  iterations: number;
  /** Whether loop was aborted by user */
  aborted?: boolean;
  /** Whether max iterations was reached */
  maxIterationsReached?: boolean;
}

/**
 * Union of all stream events
 */
export type StreamEvent =
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageEndEvent
  | ThinkingStartEvent
  | ThinkingDeltaEvent
  | ThinkingEndEvent
  | SourceAddEvent
  | ActionStartEvent
  | ActionArgsEvent
  | ActionEndEvent
  | ToolCallsEvent
  | ToolStatusEvent
  | ToolResultEvent
  | LoopIterationEvent
  | LoopCompleteEvent
  | ErrorEvent
  | DoneEvent;

/**
 * Parse a stream event from JSON
 */
export function parseStreamEvent(data: string): StreamEvent | null {
  try {
    return JSON.parse(data) as StreamEvent;
  } catch {
    return null;
  }
}

/**
 * Serialize a stream event to JSON
 */
export function serializeStreamEvent(event: StreamEvent): string {
  return JSON.stringify(event);
}

/**
 * Format event for SSE
 */
export function formatSSE(event: StreamEvent): string {
  return `data: ${serializeStreamEvent(event)}\n\n`;
}
