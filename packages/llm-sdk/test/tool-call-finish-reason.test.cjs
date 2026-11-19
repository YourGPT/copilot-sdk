const { test } = require("node:test");
const assert = require("node:assert/strict");
const { OpenAIAdapter } = require("../dist/adapters/index.js");
const { createFallbackChain } = require("../dist/fallback/index.js");
const { createRuntime, runAgentLoop } = require("../dist/index.js");

// An OpenAI-compatible client whose first reply calls one tool and ends with `finishReason`,
// and whose second reply (after the tool result) is plain text. Gemini's OpenAI endpoint ends
// tool-calling turns with "stop" rather than "tool_calls".
function fakeClient(finishReason, call = { name: "first", arguments: "{}" }) {
  let requests = 0;
  const client = {
    chat: {
      completions: {
        create: async (body) => {
          const first = ++requests === 1;
          const calls = first
            ? [{ id: "a", type: "function", function: call }]
            : [];
          const reason = first ? finishReason : "stop";
          const content = first ? "" : "done";
          if (!body.stream)
            return {
              choices: [
                { message: { content, tool_calls: calls }, finish_reason: reason },
              ],
            };
          return (async function* () {
            yield {
              choices: [
                {
                  delta: {
                    ...(content ? { content } : {}),
                    ...(calls.length
                      ? { tool_calls: calls.map((c, index) => ({ ...c, index })) }
                      : {}),
                  },
                  finish_reason: reason,
                },
              ],
            };
          })();
        },
      },
    },
  };
  return { client, requests: () => requests };
}

function adapterWith(client) {
  const adapter = new OpenAIAdapter({
    apiKey: "fixture",
    model: "gemini-3.1-flash-lite",
    api: "chat",
  });
  adapter.client = client;
  return adapter;
}

function backupModel(counter) {
  return {
    provider: "fixture",
    model: "backup",
    complete: async () => {
      counter.fallbacks++;
      return { content: "recovered", toolCalls: [] };
    },
    stream: async function* () {
      counter.fallbacks++;
      yield { type: "message:delta", content: "recovered" };
      yield { type: "done" };
    },
  };
}

const request = (streaming) => ({
  messages: [{ role: "user", content: "test" }],
  streaming,
});

for (const streaming of [false, true])
  test(`OpenAI-compatible ${streaming ? "stream" : "response"}: a complete tool call ending with "stop" runs (Gemini)`, async () => {
    const { client } = fakeClient("stop");
    const counter = { fallbacks: 0 };
    let executions = 0;
    const runtime = createRuntime({
      adapter: createFallbackChain({ models: [adapterWith(client), backupModel(counter)] }),
      tools: [
        {
          name: "first",
          description: "first",
          location: "server",
          inputSchema: { type: "object" },
          handler: async () => {
            executions++;
            return "OK";
          },
        },
      ],
    });
    const result = await runtime.chat(request(streaming));
    assert.equal(result.error, undefined, JSON.stringify(result.error));
    assert.equal(executions, 1, "the tool ran once");
    assert.equal(counter.fallbacks, 0, "no fallback: the response was valid");
    assert.equal(result.text, "done");
  });

for (const streaming of [false, true])
  for (const reason of ["length", "content_filter"])
    test(`OpenAI-compatible ${streaming ? "stream" : "response"}: tool calls ending with "${reason}" are still rejected`, async () => {
      const { client } = fakeClient(reason);
      const counter = { fallbacks: 0 };
      let executions = 0;
      const runtime = createRuntime({
        adapter: createFallbackChain({ models: [adapterWith(client), backupModel(counter)] }),
        tools: [
          {
            name: "first",
            description: "first",
            location: "server",
            inputSchema: { type: "object" },
            handler: async () => {
              executions++;
              return "OK";
            },
          },
        ],
      });
      const result = await runtime.chat(request(streaming));
      assert.equal(executions, 0, "a truncated or filtered call never runs");
      assert.equal(counter.fallbacks, 1);
      assert.equal(result.text, "recovered");
    });

test('OpenAI-compatible stream: a "stop" turn with a malformed call is still rejected', async () => {
  const { client } = fakeClient("stop", { name: "first", arguments: "{" });
  const counter = { fallbacks: 0 };
  let executions = 0;
  const runtime = createRuntime({
    adapter: createFallbackChain({ models: [adapterWith(client), backupModel(counter)] }),
    tools: [
      {
        name: "first",
        description: "first",
        location: "server",
        inputSchema: { type: "object" },
        handler: async () => {
          executions++;
          return "OK";
        },
      },
    ],
  });
  const result = await runtime.chat(request(true));
  assert.equal(executions, 0);
  assert.equal(counter.fallbacks, 1);
});

for (const reason of ["tool_calls", "stop"])
  test(`runtime.chat(): a pending client tool is listed once, with its arguments (finish "${reason}")`, async () => {
    const { client } = fakeClient(reason, {
      name: "load_skill",
      arguments: JSON.stringify({ name: "conversations" }),
    });
    const runtime = createRuntime({ adapter: adapterWith(client) });
    const result = await runtime.chat({
      ...request(true),
      tools: [
        {
          name: "load_skill",
          description: "Load a skill",
          inputSchema: { type: "object", properties: { name: { type: "string" } } },
        },
      ],
    });
    assert.equal(result.error, undefined, JSON.stringify(result.error));
    assert.equal(result.requiresAction, true);
    assert.equal(result.toolCalls.length, 1, "one entry per call id, not one per event");
    assert.equal(result.toolCalls[0].id, "a");
    assert.equal(result.toolCalls[0].name, "load_skill");
    assert.deepEqual(result.toolCalls[0].args, { name: "conversations" });
  });

test('runAgentLoop: an OpenAI-format response that calls a tool and ends with "stop" runs the tool', async () => {
  let requests = 0;
  let resolved = 0;
  const seen = [];
  for await (const event of runAgentLoop({
    provider: { name: "openai" },
    messages: [{ role: "user", content: "test" }],
    tools: [
      { name: "confirm", description: "confirm", location: "client", inputSchema: { type: "object" } },
    ],
    callLLM: async () => ({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: ++requests === 1 ? "" : "OK",
            tool_calls:
              requests === 1
                ? [{ id: "a", type: "function", function: { name: "confirm", arguments: "{}" } }]
                : [],
          },
        },
      ],
    }),
    waitForClientToolResult: async () => {
      resolved++;
      return { success: true };
    },
  }))
    seen.push(event);
  assert.equal(resolved, 1, "the tool call was handled, not dropped as an end of turn");
  assert.equal(requests, 2);
  assert.ok(!seen.some((event) => event.type === "error"));
});
