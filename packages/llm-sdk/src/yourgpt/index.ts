/**
 * @yourgpt/llm-sdk/yourgpt
 *
 * YourGPT platform integration — session & message persistence.
 * Implements the generic StorageAdapter interface.
 *
 * @example
 * ```ts
 * import { createRuntime } from '@yourgpt/llm-sdk'
 * import { createYourGPT } from '@yourgpt/llm-sdk/yourgpt'
 *
 * const yourgpt = createYourGPT({ apiKey, widgetUid })
 * const runtime = createRuntime({ provider, model, storage: yourgpt })
 *
 * // That's it — runtime auto-creates sessions and persists messages.
 * app.post('/api/copilot/chat', runtime.expressHandler())
 * ```
 */

import type {
  StorageAdapter,
  StorageMessage,
  StorageFile,
} from "../core/types";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface YourGPTConfig {
  /** Your YourGPT API key — server-side only, never expose to browser */
  apiKey: string;
  /** Widget UID — scopes all sessions to this project */
  widgetUid: string;
  /** Override API base URL. Defaults to https://api.yourgpt.ai */
  endpoint?: string;
}

/** @deprecated Use `YourGPTConfig` instead */
export type YourGPTAdapterConfig = YourGPTConfig;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YourGPTSession {
  /** Use this as threadId in subsequent chat requests */
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** @deprecated Use `StorageMessage` from `@yourgpt/llm-sdk` instead */
export type NewYourGPTMessage = StorageMessage;

export interface CreateSessionData {
  title?: string;
  metadata?: Record<string, unknown>;
}

// ─── YourGPT interface ───────────────────────────────────────────────────────

/**
 * YourGPT platform adapter.
 * Extends StorageAdapter with richer session return type.
 */
export interface YourGPT extends StorageAdapter {
  createSession(data?: CreateSessionData): Promise<YourGPTSession>;
  saveMessages(sessionId: string, messages: StorageMessage[]): Promise<void>;
  uploadFile(file: StorageFile): Promise<{ url: string }>;
}

/** @deprecated Use `YourGPT` instead */
export type YourGPTAdapter = YourGPT;

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createYourGPT(config: YourGPTConfig): YourGPT {
  const base = (config.endpoint ?? "https://api.yourgpt.ai").replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    "api-key": config.apiKey,
  };

  async function call<T = unknown>(
    path: string,
    body: object = {},
  ): Promise<T> {
    const payload = { widget_uid: config.widgetUid, ...body };
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`YourGPT API [${res.status}] ${path}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    async createSession(data = {}) {
      const raw = await call<any>(
        "/chatbot/v1/copilot-sdk/createSession",
        data,
      );
      const d = raw.data ?? raw;
      return {
        id: String(d.session_uid ?? d.id),
        title: d.title ?? undefined,
        createdAt: new Date(d.createdAt ?? d.created_at),
        updatedAt: new Date(d.updatedAt ?? d.updated_at),
      };
    },

    async saveMessages(sessionId, messages) {
      // Keep as string if too large for JS safe integer (avoids precision loss)
      const num = Number(sessionId);
      const sessionUid = Number.isSafeInteger(num) ? num : sessionId;

      // Build a lookup: tool_call_id → tool result content (for merging dispatch + result)
      const toolResults = new Map<string, string>();
      for (const msg of messages) {
        if (msg.role === "tool" && msg.toolCallId) {
          toolResults.set(msg.toolCallId, msg.content ?? "");
        }
      }

      for (const msg of messages) {
        if (msg.role === "tool") {
          // Tool results are merged into the dispatch record below — skip standalone save
          continue;
        } else if (msg.role === "assistant" && msg.toolCalls?.length) {
          // Assistant dispatching tool calls — one completed record per call (cold storage)
          for (const tc of msg.toolCalls as Array<{
            id?: string;
            function?: { name?: string; arguments?: string };
          }>) {
            const toolName = tc.function?.name ?? "unknown";
            let toolArgs: unknown = {};
            try {
              toolArgs =
                typeof tc.function?.arguments === "string"
                  ? JSON.parse(tc.function.arguments)
                  : (tc.function?.arguments ?? {});
            } catch {
              /* leave as empty object */
            }

            // Merge: find matching tool result by call ID
            const response = tc.id ? (toolResults.get(tc.id) ?? null) : null;

            await call("/chatbot/v1/copilot-sdk/createToolMessage", {
              session_uid: sessionUid,
              skill: "copilot-tool",
              extra_data: {
                tool_name: toolName,
                tool_arguments: toolArgs,
                tool_call_id: tc.id ?? null,
                status: "completed",
                tool_response: response,
              },
            });
          }

          // Also save the assistant text content if present alongside tool calls
          if (msg.content) {
            await call("/chatbot/v1/copilot-sdk/createMessage", {
              session_uid: sessionUid,
              message: msg.content,
              send_by: "assistant",
            });
          }
        } else if (msg.role === "user" || msg.role === "assistant") {
          // Regular user / assistant message
          await call("/chatbot/v1/copilot-sdk/createMessage", {
            session_uid: sessionUid,
            message: msg.content,
            send_by: msg.role === "user" ? "user" : "assistant",
          });
        }
        // system messages are skipped — not stored
      }
    },

    async uploadFile(file: StorageFile) {
      // Strip data URI prefix if present (e.g., "data:image/png;base64,...")
      let rawData = file.data;
      const dataUriMatch = rawData.match(/^data:[^;]+;base64,(.+)$/);
      if (dataUriMatch) rawData = dataUriMatch[1];

      const raw = await call<any>("/chatbot/v1/copilot-sdk/uploadMedia", {
        file_data: rawData,
        mime_type: file.mimeType,
        filename: file.filename,
      });
      const url = raw.data?.url ?? raw.url;
      if (!url)
        throw new Error(
          "uploadFile failed: no URL in response — " + JSON.stringify(raw),
        );
      return { url };
    },
  };
}

/** @deprecated Use `createYourGPT` instead */
export const createYourGPTAdapter = createYourGPT;
