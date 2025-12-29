import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Runtime } from "./runtime";
import type { RuntimeConfig } from "./types";
import { createRuntime } from "./runtime";
import { createSSEResponse } from "./streaming";

/**
 * Create Hono app with chat endpoint
 */
export function createHonoApp(runtime: Runtime): Hono {
  const app = new Hono();

  // Enable CORS
  app.use("*", cors());

  // Health check
  app.get("/", (c) => {
    return c.json({ status: "ok", provider: "yourgpt-copilot" });
  });

  // Chat endpoint at root (for Next.js App Router mounting)
  // e.g., mounted at /api/chat/openai → POST /api/chat/openai works
  app.post("/", async (c) => {
    const request = c.req.raw;
    return runtime.handleRequest(request);
  });

  // Chat endpoint (standard - single turn)
  // Also available at /chat sub-path for flexibility
  app.post("/chat", async (c) => {
    const request = c.req.raw;
    return runtime.handleRequest(request);
  });

  // Chat endpoint with agent loop (multi-turn with tools)
  // Note: With Vercel AI SDK pattern, this is the same as /chat
  // Client sends tool results in messages, server doesn't wait
  app.post("/chat/loop", async (c) => {
    try {
      const body = await c.req.json();
      const signal = c.req.raw.signal;

      // Process with tool support
      const generator = runtime.processChatWithLoop(body, signal);
      return createSSEResponse(generator);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        500,
      );
    }
  });

  // Get available actions (legacy)
  app.get("/actions", (c) => {
    const actions = runtime.getActions().map((a) => ({
      name: a.name,
      description: a.description,
      parameters: a.parameters,
    }));
    return c.json({ actions });
  });

  // Get available tools (new)
  app.get("/tools", (c) => {
    const tools = runtime.getTools().map((t) => ({
      name: t.name,
      description: t.description,
      location: t.location,
      inputSchema: t.inputSchema,
    }));
    return c.json({ tools });
  });

  // Get model capabilities (for UI feature flags)
  app.get("/capabilities", (c) => {
    const provider = runtime.getProvider();
    const model = runtime.getModel();

    if (provider) {
      const capabilities = provider.getCapabilities(model);
      return c.json({
        provider: provider.name,
        model,
        capabilities,
        supportedModels: provider.supportedModels,
      });
    }

    // Fallback for legacy config (no provider instance)
    return c.json({
      provider: "unknown",
      model,
      capabilities: {
        supportsVision: false,
        supportsTools: true,
        supportsThinking: false,
        supportsStreaming: true,
        supportsPDF: false,
        supportsAudio: false,
        supportsVideo: false,
        maxTokens: 8192,
        supportedImageTypes: [],
        supportsJsonMode: false,
        supportsSystemMessages: true,
      },
      supportedModels: [],
    });
  });

  return app;
}

/**
 * Next.js App Router handler
 *
 * @example
 * ```ts
 * // app/api/chat/route.ts
 * import { createNextHandler } from '@yourgpt/copilot-sdk-runtime';
 *
 * const handler = createNextHandler({
 *   llm: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY! },
 * });
 *
 * export const POST = handler;
 * ```
 */
export function createNextHandler(config: RuntimeConfig) {
  const runtime = createRuntime(config);

  return async function handler(request: Request): Promise<Response> {
    return runtime.handleRequest(request);
  };
}

/**
 * Express middleware
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createExpressMiddleware } from '@yourgpt/copilot-sdk-runtime';
 *
 * const app = express();
 *
 * app.use('/api/chat', createExpressMiddleware({
 *   llm: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY! },
 * }));
 * ```
 */
export function createExpressMiddleware(config: RuntimeConfig) {
  const runtime = createRuntime(config);
  const app = createHonoApp(runtime);

  // Return Hono's fetch handler wrapped for Express
  return async (
    req: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body: unknown;
    },
    res: {
      status: (code: number) => { json: (data: unknown) => void };
      setHeader: (name: string, value: string) => void;
      write: (data: string) => void;
      end: () => void;
    },
  ) => {
    try {
      // Convert Express request to Fetch Request
      const url = new URL(req.url, "http://localhost");
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
      });

      // Handle with runtime
      const response = await runtime.handleRequest(request);

      // Set response headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      // Stream response body
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value));
        }
      }

      res.end();
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}

/**
 * Node.js HTTP handler
 *
 * @example
 * ```ts
 * import http from 'http';
 * import { createNodeHandler } from '@yourgpt/copilot-sdk-runtime';
 *
 * const handler = createNodeHandler({
 *   llm: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY! },
 * });
 *
 * const server = http.createServer(handler);
 * server.listen(3001);
 * ```
 */
export function createNodeHandler(config: RuntimeConfig) {
  const runtime = createRuntime(config);
  const app = createHonoApp(runtime);

  return app.fetch;
}
