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
  /**
   * Error handler — called when any adapter operation fails.
   * Receives the error and the operation name (createSession, saveMessages, uploadFile).
   * If not provided, errors are thrown to the caller.
   *
   * @example
   * ```ts
   * onError: (error, operation, params) => {
   *   logger.error(`[YourGPT] ${operation} failed:`, error, params);
   *   Sentry.captureException(error, { tags: { operation }, extra: params });
   * }
   * ```
   */
  onError?: (
    error: Error,
    operation: string,
    params?: Record<string, unknown>,
  ) => void;
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
  const onError = config.onError;

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

  /** Wrap an operation with onError handler + param logging */
  async function safe<T>(
    operation: string,
    params: Record<string, unknown>,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (onError) {
        onError(error, operation, params);
      }
      throw error;
    }
  }

  return {
    async createSession(data = {}) {
      return safe("createSession", { title: data.title }, async () => {
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
      });
    },

    async saveMessages(sessionId, messages) {
      return safe(
        "saveMessages",
        {
          sessionId,
          messageCount: messages.length,
          roles: messages.map((m) => m.role),
        },
        async () => {
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
              // Save assistant text FIRST (before tool calls) to preserve display order
              if (msg.content) {
                await call("/chatbot/v1/copilot-sdk/createMessage", {
                  session_uid: sessionUid,
                  message: msg.content,
                  send_by: "assistant",
                  content_type: "text",
                });
              }

              // Then save tool calls — one completed record per call (cold storage)
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
                const response = tc.id
                  ? (toolResults.get(tc.id) ?? null)
                  : null;

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
            } else if (msg.role === "user" || msg.role === "assistant") {
              // Regular user / assistant message — include content_type + url if present
              await call("/chatbot/v1/copilot-sdk/createMessage", {
                session_uid: sessionUid,
                message: msg.content,
                send_by: msg.role === "user" ? "user" : "assistant",
                content_type: msg.contentType || "text",
                ...(msg.url ? { url: msg.url } : {}),
              });
            }
            // system messages are skipped — not stored
          }
        },
      );
    },

    async uploadFile(file: StorageFile) {
      return safe(
        "uploadFile",
        {
          filename: file.filename,
          mimeType: file.mimeType,
          dataLength: file.data?.length,
        },
        async () => {
          // Step 1: Get pre-signed upload URL from YourGPT
          const raw = await call<any>("/chatbot/v1/copilot-sdk/getSignedUrl", {
            file_name: file.filename || `upload_${Date.now()}`,
          });
          const signedUrl = raw.data?.upload_url ?? raw.data?.url ?? raw.url;
          const successUrl =
            raw.data?.file_url ?? raw.data?.success_url ?? raw.success_url;
          if (!signedUrl) {
            throw new Error(
              "uploadFile: no signed URL in response — " + JSON.stringify(raw),
            );
          }

          // Step 2: Upload file directly to cloud storage via signed URL
          let body: Blob | Buffer;
          let rawData = file.data;
          // Strip data URI prefix if present
          const dataUriMatch = rawData.match(/^data:[^;]+;base64,(.+)$/);
          if (dataUriMatch) rawData = dataUriMatch[1];

          if (typeof Buffer !== "undefined") {
            // Node.js
            body = Buffer.from(rawData, "base64");
          } else {
            // Browser
            const binary = atob(rawData);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++)
              bytes[i] = binary.charCodeAt(i);
            body = new Blob([bytes], { type: file.mimeType });
          }

          const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": file.mimeType },
            body,
          });

          if (!uploadRes.ok) {
            throw new Error(
              `uploadFile: PUT to signed URL failed with ${uploadRes.status}`,
            );
          }

          // Step 3: Return the CDN/success URL
          const finalUrl = successUrl || signedUrl.split("?")[0];
          return { url: finalUrl };
        },
      );
    },
  };
}

/** @deprecated Use `createYourGPT` instead */
export const createYourGPTAdapter = createYourGPT;
