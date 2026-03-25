/**
 * @yourgpt/llm-sdk/yourgpt
 *
 * Server-side YourGPT session & message persistence adapter.
 * Use this in your backend alongside createRuntime.
 *
 * @example
 * ```ts
 * import { createYourGPTAdapter } from '@yourgpt/llm-sdk/yourgpt'
 *
 * const storage = createYourGPTAdapter({ apiKey, widgetUid })
 *
 * const session = await storage.createSession({ title: 'New chat' })
 * await storage.saveMessages(session.id, [userMessage])
 * stream.on('done', async (result) => {
 *   await storage.saveMessages(session.id, [{ role: 'assistant', content: result.text }])
 * })
 * ```
 */

// ─── Config ───────────────────────────────────────────────────────────────────

export interface YourGPTAdapterConfig {
  /** Your YourGPT API key — server-side only, never expose to browser */
  apiKey: string;
  /** Widget UID — scopes all sessions to this project */
  widgetUid: string;
  /** Override API base URL. Defaults to https://api.yourgpt.ai */
  endpoint?: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YourGPTSession {
  /** Use this as threadId in subsequent chat requests */
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewYourGPTMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: unknown[];
  toolCallId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSessionData {
  title?: string;
  metadata?: Record<string, unknown>;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export interface YourGPTAdapter {
  /** Create a new session. Returns session_uid — store as threadId on frontend. */
  createSession(data?: CreateSessionData): Promise<YourGPTSession>;
  /** Append messages to a session */
  saveMessages(sessionId: string, messages: NewYourGPTMessage[]): Promise<void>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createYourGPTAdapter(
  config: YourGPTAdapterConfig,
): YourGPTAdapter {
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
    console.log(`[yourgpt] POST ${base}${path}`, JSON.stringify(payload));
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
  };
}
