/**
 * Storage Helpers
 *
 * Extract input/output messages from request/response for storage adapters.
 * Used internally by Runtime when `storage` is configured.
 */

import type { StorageMessage } from "../core/types";
import type { DoneEventMessage } from "../core/stream-events";

/**
 * Extract new INPUT messages from a request's message array.
 *
 * The SDK sends the full conversation history on each request. This function
 * picks only the NEW messages the user just added:
 * - New user turn (last meaningful msg = "user"): returns [userMsg]
 * - Tool continuation (last meaningful msg = "tool"): returns tool results after last assistant
 * - Otherwise: returns []
 *
 * Skips empty assistant placeholders the SDK pushes before sending.
 */
export function extractInputMessages(reqMessages: unknown[]): StorageMessage[] {
  if (!reqMessages?.length) return [];

  // Walk backwards — skip empty assistant placeholders
  let lastMeaningful: any = null;
  for (let i = reqMessages.length - 1; i >= 0; i--) {
    const m = reqMessages[i] as any;
    if (m.role === "assistant" && (!m.content || m.content === "")) continue;
    lastMeaningful = m;
    break;
  }
  if (!lastMeaningful) return [];

  if (lastMeaningful.role === "user") {
    const textContent =
      typeof lastMeaningful.content === "string"
        ? lastMeaningful.content
        : JSON.stringify(lastMeaningful.content);

    const attachments = lastMeaningful.attachments as
      | Array<{ type?: string; url?: string; filename?: string }>
      | undefined;
    const imageAtt = attachments?.find((a) => a.type === "image" && a.url);
    const fileAtt = attachments?.find((a) => a.type === "file" && a.url);

    // Single message — text + attachment info combined
    const msg: StorageMessage = { role: "user", content: textContent || "" };

    if (imageAtt?.url) {
      msg.contentType = "image";
      msg.url = imageAtt.url;
    } else if (fileAtt?.url) {
      msg.contentType = "file";
      msg.url = fileAtt.url;
    }

    return [msg];
  }

  if (lastMeaningful.role === "tool" || lastMeaningful.role === "function") {
    const msgs = reqMessages as any[];
    const lastAssistantIdx = msgs
      .map((m: any) => m.role)
      .lastIndexOf("assistant");
    return msgs
      .slice(lastAssistantIdx + 1)
      .filter(
        (m: any) =>
          !(m.role === "assistant" && (!m.content || m.content === "")),
      )
      .map((m: any) => ({
        role: m.role as StorageMessage["role"],
        content:
          typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        toolCallId: m.tool_call_id,
      }));
  }

  return [];
}

/**
 * Map LLM output messages (DoneEventMessage format) to StorageMessage format.
 *
 * Converts from snake_case API format to camelCase storage format.
 */
export function mapOutputMessages(
  resultMessages: DoneEventMessage[],
): StorageMessage[] {
  return resultMessages.map((m) => ({
    role: m.role,
    content: m.content ?? "",
    toolCalls: m.tool_calls,
    toolCallId: m.tool_call_id,
  }));
}
