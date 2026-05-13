/**
 * Fallback Chain Demo
 *
 * Tests FallbackChain across:
 *   - Priority fallback (normal)
 *   - Round-robin load distribution
 *   - 4xx does NOT trigger fallback (bad key)
 *   - Forced fallback (dead primary URL → Anthropic picks up)
 *   - Tools in streaming mode
 *   - Tools in non-streaming (chat) mode
 *
 * Run:
 *   pnpm dev
 *
 * Test:
 *   curl -s -X POST http://localhost:3000/chat/stream/tools \
 *     -H "Content-Type: application/json" \
 *     -d '{"messages":[{"role":"user","content":"What is the weather in Tokyo and what time is it?"}]}'
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { createRuntime, type ToolDefinition } from "@yourgpt/llm-sdk";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";
import {
  createFallbackChain,
  FallbackExhaustedError,
  MemoryRoutingStore,
  type RoutingStore,
  type RetryInfo,
} from "@yourgpt/llm-sdk/fallback";

const app = express();
app.use(cors());
app.use(express.json());

// ─── Providers ────────────────────────────────────────────────────────────────

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const brokenOpenAI = createOpenAI({ apiKey: "sk-INVALID_KEY_FOR_TESTING" }); // gitleaks:allow
const deadOpenAI = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: "http://localhost:19999/v1", // nothing here → ECONNREFUSED
});

// ─── Tools ────────────────────────────────────────────────────────────────────
//
// These are server-side tools. The fallback chain wraps the LLM adapter only —
// tools always run on our server regardless of which provider is active.
// The tool definitions are sent to whichever provider ends up handling the request,
// each formatted in that provider's native format by the adapter.

const WEATHER_DATA: Record<string, { temp: string; condition: string }> = {
  tokyo: { temp: "18°C", condition: "Partly cloudy" },
  london: { temp: "12°C", condition: "Rainy" },
  new_york: { temp: "22°C", condition: "Sunny" },
  paris: { temp: "15°C", condition: "Overcast" },
  sydney: { temp: "25°C", condition: "Clear" },
};

const serverTools: ToolDefinition[] = [
  {
    name: "get_weather",
    description: "Get current weather for a city",
    location: "server",
    inputSchema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "City name (e.g. Tokyo, London, New York)",
        },
      },
      required: ["city"],
    },
    handler: async (params) => {
      const { city } = params as { city: string };
      const key = city.toLowerCase().replace(/\s+/g, "_");
      const data = WEATHER_DATA[key] ?? { temp: "20°C", condition: "Unknown" };
      console.log(
        `[tool:get_weather] city=${city} → ${data.temp}, ${data.condition}`,
      );
      return { city, temperature: data.temp, condition: data.condition };
    },
  },
  {
    name: "get_server_time",
    description: "Get the current server date and time",
    location: "server",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const now = new Date().toISOString();
      console.log(`[tool:get_server_time] → ${now}`);
      return { time: now };
    },
  },
  {
    name: "calculate",
    description: "Evaluate a simple math expression and return the result",
    location: "server",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Math expression to evaluate, e.g. '12 * 7 + 5'",
        },
      },
      required: ["expression"],
    },
    handler: async (params) => {
      const { expression } = params as { expression: string };
      // Safe eval: only allow numbers and basic operators
      if (!/^[\d\s+\-*/().]+$/.test(expression)) {
        return { error: "Invalid expression — only basic math allowed" };
      }
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${expression})`)();
      console.log(`[tool:calculate] ${expression} = ${result}`);
      return { expression, result };
    },
  },
];

// ─── Helper: fallback chain factory ──────────────────────────────────────────

function onFallbackLog(label: string) {
  return ({
    attemptedModel,
    nextModel,
    error,
    attempt,
  }: {
    attemptedModel: string;
    nextModel: string;
    error: Error;
    attempt: number;
  }) => {
    console.warn(
      `[fallback:${label}] attempt ${attempt}: "${attemptedModel}" → "${nextModel}" | ${error.message}`,
    );
  };
}

// ─── Route 1: Priority (no tools) ────────────────────────────────────────────

const priorityRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      openai.languageModel("gpt-5.4"),
      anthropic.languageModel("claude-haiku-4-5"),
    ],
    strategy: "priority",
    onFallback: onFallbackLog("priority"),
  }),
  systemPrompt: "You are a helpful assistant.",
});

app.post("/chat/priority", async (req, res) => {
  try {
    await priorityRuntime.stream(req.body).pipeToResponse(res);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Route 2: Round-robin (no tools) ─────────────────────────────────────────

const rrStore: RoutingStore = new MemoryRoutingStore();

const roundRobinRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      openai.languageModel("gpt-5.4"),
      anthropic.languageModel("claude-haiku-4-5"),
    ],
    strategy: "round-robin",
    store: rrStore,
    onFallback: onFallbackLog("round-robin"),
  }),
  systemPrompt: "You are a helpful assistant.",
});

app.post("/chat/round-robin", async (req, res) => {
  try {
    await roundRobinRuntime.stream(req.body).pipeToResponse(res);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Route 3: 4xx does NOT trigger fallback ───────────────────────────────────

const badKeyRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      brokenOpenAI.languageModel("gpt-5.4"),
      anthropic.languageModel("claude-haiku-4-5"),
    ],
    strategy: "priority",
    onFallback: () => {
      console.warn(
        "[fallback:bad-key] UNEXPECTED — fallback triggered for 4xx!",
      );
    },
  }),
  systemPrompt: "You are a helpful assistant.",
});

app.post("/chat/bad-key", async (req, res) => {
  try {
    await badKeyRuntime.stream(req.body).pipeToResponse(res);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Route 4: Forced fallback (dead primary URL) ──────────────────────────────

const forcedFallbackRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      deadOpenAI.languageModel("gpt-5.4"),
      anthropic.languageModel("claude-haiku-4-5"),
    ],
    strategy: "priority",
    onFallback: onFallbackLog("forced"),
  }),
  systemPrompt: "You are a helpful assistant.",
});

app.post("/chat/fallback-test", async (req, res) => {
  try {
    await forcedFallbackRuntime.stream(req.body).pipeToResponse(res);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Route 5: Tools + STREAMING ──────────────────────────────────────────────
//
// Primary: OpenAI (gpt-5.4) — formats tools as OpenAI function-calling JSON
// Fallback: Anthropic (claude-haiku-4-5) — formats tools as Anthropic tool_use JSON
//
// The adapter for whichever provider runs transforms the shared ToolDefinition[]
// into that provider's native format. Tools always execute on our server.

const streamToolsRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      openai.languageModel("gpt-5.4"),
      anthropic.languageModel("claude-haiku-4-5"),
    ],
    strategy: "priority",
    onFallback: onFallbackLog("tools-stream"),
  }),
  systemPrompt:
    "You are a helpful assistant with access to weather, time, and calculator tools. Use tools when relevant.",
  tools: serverTools,
});

app.post("/chat/stream/tools", async (req, res) => {
  try {
    await streamToolsRuntime.stream(req.body).pipeToResponse(res);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Route 6: Tools + NON-STREAMING (chat) ───────────────────────────────────
//
// Same chain and tools as above but using runtime.chat() which
// collects the full response before returning JSON.

const chatToolsRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      openai.languageModel("gpt-5.4"),
      anthropic.languageModel("claude-haiku-4-5"),
    ],
    strategy: "priority",
    onFallback: onFallbackLog("tools-chat"),
  }),
  systemPrompt:
    "You are a helpful assistant with access to weather, time, and calculator tools. Use tools when relevant.",
  tools: serverTools,
});

app.post("/chat/tools", async (req, res) => {
  try {
    const result = await chatToolsRuntime.chat(req.body);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Route 8: Retries before fallback ────────────────────────────────────────
//
// retries: 2  → tries dead primary 3 times total (initial + 2 retries) before
//              giving up and falling back to Anthropic.
// retryDelay: 300ms, retryBackoff: 'exponential' → 300ms, 600ms waits
// onRetry fires on each retry attempt so you can see it in the server log.

const retriesRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      deadOpenAI.languageModel("gpt-5.4"),
      anthropic.languageModel("claude-haiku-4-5"),
    ],
    retries: 2,
    retryDelay: 300,
    retryBackoff: "exponential",
    onRetry: ({
      model,
      retryAttempt,
      maxRetries,
      delayMs,
      error,
    }: RetryInfo) => {
      console.warn(
        `[retry] ${model} — attempt ${retryAttempt}/${maxRetries}, waiting ${delayMs}ms | ${error.message}`,
      );
    },
    onFallback: ({ attemptedModel, nextModel, attempt }) => {
      console.warn(
        `[fallback:retries] ${attemptedModel} exhausted all retries (attempt ${attempt}) → ${nextModel}`,
      );
    },
  }),
  systemPrompt: "You are a helpful assistant.",
});

app.post("/chat/retry-test", async (req, res) => {
  try {
    await retriesRuntime.stream(req.body).pipeToResponse(res);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Route 9: Structured output (responseFormat) ─────────────────────────────
//
// Exercises the unified `responseFormat` field across an OpenAI → Anthropic →
// Google fallback chain. Each adapter translates the OpenAI-shape JSON schema
// to its provider's native structured-output API (`response_format`,
// `output_config.format`, `responseJsonSchema`).
//
// Test:
//   curl -s -X POST http://localhost:3000/chat/structured \
//     -H "Content-Type: application/json" \
//     -d '{"messages":[{"role":"user","content":"List the top 3 fastest land animals with their top speed in km/h."}]}'

const google = createOpenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

const ANIMALS_SCHEMA = {
  type: "object",
  properties: {
    animals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          top_speed_kmh: { type: "number" },
        },
        required: ["name", "top_speed_kmh"],
      },
    },
  },
  required: ["animals"],
} as const;

const structuredRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      openai.languageModel("gpt-4o"),
      anthropic.languageModel("claude-3-5-sonnet-latest"),
      google.languageModel("gemini-2.0-flash"),
    ],
    strategy: "priority",
    onFallback: onFallbackLog("structured"),
  }),
  systemPrompt: "You return data as JSON matching the requested schema.",
});

app.post("/chat/structured", async (req, res) => {
  try {
    const result = await structuredRuntime.chat({
      ...req.body,
      config: {
        ...req.body.config,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "animals_response",
            schema: ANIMALS_SCHEMA,
            strict: true,
          },
        },
      },
    });
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Route: Responses API bundle (MCP + reasoning + schema) ──────────────────
//
// Single-call response() that bundles MCP server passthrough, reasoning effort
// control, and JSON-schema structured output. Mirrors the self-learning use
// case in production: extract FAQ pairs from a transcript while letting the
// model consult a knowledge-base MCP server first.
//
// OpenAI routes through /v1/responses; Anthropic falls back to /v1/messages
// with the `mcp-client-2025-11-20` beta header. Providers without native MCP
// (Google/xAI/OpenRouter) throw a clear error so the fallback chain skips them.
//
// Test:
//   curl -s -X POST http://localhost:3000/response \
//     -H "Content-Type: application/json" \
//     -d '{"prompt":"Operator told a user the refund window is 30 days. Extract FAQs.","mcpUrl":"https://kb.example.com/sse","mcpToken":"…"}'

const FAQ_SCHEMA = {
  type: "object",
  properties: {
    response: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
          intent: { type: "string" },
        },
        required: ["question", "answer", "intent"],
        additionalProperties: false,
      },
    },
  },
  required: ["response"],
  additionalProperties: false,
} as const;

// Uses a reasoning-capable model (gpt-5.2) so `reasoningEffort` actually
// engages the Responses API reasoning field. gpt-4o would have it silently
// dropped because OpenAI only accepts `reasoning.effort` on o-series / gpt-5.x.
// Uses a reasoning-capable model (gpt-5.2) so `reasoningEffort` actually
// engages the Responses API reasoning field. gpt-4o would have it silently
// dropped because OpenAI only accepts `reasoning.effort` on o-series / gpt-5.x.
const responsesRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      openai.languageModel("gpt-5.2"),
      anthropic.languageModel("claude-opus-4-7"),
    ],
    strategy: "priority",
    onFallback: onFallbackLog("response"),
  }),
});

// Smoke-test route: dead OpenAI primary → forces Anthropic fallback for the
// Responses bundle. Exercises the `mcp-client-2025-11-20` beta header path
// (when mcpServers is set) and adaptive thinking on Claude 4.7.
const responsesAnthropicRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      deadOpenAI.languageModel("gpt-5.2"),
      anthropic.languageModel("claude-opus-4-7"),
    ],
    strategy: "priority",
    onFallback: onFallbackLog("response-claude-forced"),
  }),
});

app.post("/response", async (req, res) => {
  try {
    const { prompt, mcpUrl, mcpToken } = req.body as {
      prompt: string;
      mcpUrl?: string;
      mcpToken?: string;
    };

    const result = await responsesRuntime.response({
      prompt,
      systemPrompt:
        "You are an FAQ extractor. Consult the knowledge-base MCP server before creating new entries.",
      mcpServers: mcpUrl
        ? [
            {
              label: "knowledge_base",
              url: mcpUrl,
              headers: mcpToken
                ? { Authorization: `Bearer ${mcpToken}` }
                : undefined,
              allowedTools: ["internal_knowledgebase"],
              requireApproval: "never",
            },
          ]
        : undefined,
      reasoningEffort: "high",
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "faqs", schema: FAQ_SCHEMA, strict: true },
      },
    });

    const parsed = (() => {
      try {
        return JSON.parse(result.text);
      } catch {
        return null;
      }
    })();

    res.json({ raw: result.text, parsed, usage: result.usage });
  } catch (err) {
    handleError(err, res);
  }
});

// Force the Anthropic hop on the Responses bundle (dead OpenAI primary).
app.post("/response/claude", async (req, res) => {
  try {
    const { prompt, mcpUrl, mcpToken } = req.body as {
      prompt: string;
      mcpUrl?: string;
      mcpToken?: string;
    };

    const result = await responsesAnthropicRuntime.response({
      prompt,
      systemPrompt:
        "You are an FAQ extractor. Consult the knowledge-base MCP server before creating new entries.",
      mcpServers: mcpUrl
        ? [
            {
              label: "knowledge_base",
              url: mcpUrl,
              headers: mcpToken
                ? { Authorization: `Bearer ${mcpToken}` }
                : undefined,
              allowedTools: ["internal_knowledgebase"],
              requireApproval: "never",
            },
          ]
        : undefined,
      reasoningEffort: "high",
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "faqs", schema: FAQ_SCHEMA, strict: true },
      },
    });

    const parsed = (() => {
      try {
        return JSON.parse(result.text);
      } catch {
        return null;
      }
    })();

    res.json({ raw: result.text, parsed, usage: result.usage });
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Route 7: Tools + FORCED FALLBACK (dead primary) ─────────────────────────
//
// Same tools, but primary is a dead URL.
// Anthropic picks up and handles tool calls in its own format.

const forcedToolsRuntime = createRuntime({
  adapter: createFallbackChain({
    models: [
      deadOpenAI.languageModel("gpt-5.4"),
      anthropic.languageModel("claude-haiku-4-5"),
    ],
    strategy: "priority",
    onFallback: onFallbackLog("tools-forced"),
  }),
  systemPrompt:
    "You are a helpful assistant with access to weather, time, and calculator tools. Use tools when relevant.",
  tools: serverTools,
});

app.post("/chat/fallback-test/tools", async (req, res) => {
  try {
    await forcedToolsRuntime.stream(req.body).pipeToResponse(res);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── Error helper ─────────────────────────────────────────────────────────────

function handleError(err: unknown, res: express.Response) {
  if (err instanceof FallbackExhaustedError) {
    res.status(503).json({
      error: "All models in fallback chain failed",
      detail: err.failures.map(
        (f) => `${f.provider}/${f.model}: ${f.error.message}`,
      ),
    });
  } else {
    res.status(500).json({ error: String(err) });
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nFallback Demo running at http://localhost:${PORT}\n`);
  console.log("── Basic routes ──────────────────────────────────────────────");
  console.log(
    "  POST /chat/priority            — OpenAI first, Claude fallback",
  );
  console.log("  POST /chat/round-robin         — Alternates OpenAI / Claude");
  console.log("  POST /chat/bad-key             — 4xx: fallback NOT triggered");
  console.log(
    "  POST /chat/fallback-test       — Dead primary → Claude picks up",
  );
  console.log(
    "\n── Tool routes ───────────────────────────────────────────────",
  );
  console.log(
    "  POST /chat/stream/tools        — Tools via streaming (OpenAI primary)",
  );
  console.log(
    "  POST /chat/tools               — Tools via non-streaming JSON",
  );
  console.log(
    "  POST /chat/fallback-test/tools — Tools via streaming (forced fallback → Claude)",
  );
  console.log(
    "  POST /chat/retry-test          — Retries dead model 2x before falling back to Claude",
  );
  console.log(
    "  POST /chat/structured          — JSON-schema response across OpenAI → Claude → Gemini",
  );
  console.log(
    "  POST /response                 — runtime.response() with MCP + reasoning + schema (OpenAI → Claude)",
  );
});
