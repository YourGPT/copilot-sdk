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
                {
                  message: { content, tool_calls: calls },
                  finish_reason: reason,
                },
              ],
            };
          return (async function* () {
            yield {
              choices: [
                {
                  delta: {
                    ...(content ? { content } : {}),
                    ...(calls.length
                      ? {
                          tool_calls: calls.map((c, index) => ({
                            ...c,
                            index,
                          })),
                        }
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
      adapter: createFallbackChain({
        models: [adapterWith(client), backupModel(counter)],
      }),
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
        adapter: createFallbackChain({
          models: [adapterWith(client), backupModel(counter)],
        }),
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
    adapter: createFallbackChain({
      models: [adapterWith(client), backupModel(counter)],
    }),
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
          inputSchema: {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
      ],
    });
    assert.equal(result.error, undefined, JSON.stringify(result.error));
    assert.equal(result.requiresAction, true);
    assert.equal(
      result.toolCalls.length,
      1,
      "one entry per call id, not one per event",
    );
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
      {
        name: "confirm",
        description: "confirm",
        location: "client",
        inputSchema: { type: "object" },
      },
    ],
    callLLM: async () => ({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: ++requests === 1 ? "" : "OK",
            tool_calls:
              requests === 1
                ? [
                    {
                      id: "a",
                      type: "function",
                      function: { name: "confirm", arguments: "{}" },
                    },
                  ]
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
  assert.equal(
    resolved,
    1,
    "the tool call was handled, not dropped as an end of turn",
  );
  assert.equal(requests, 2);
  assert.ok(!seen.some((event) => event.type === "error"));
});

// ---------------------------------------------------------------------------------------------
// Review follow-ups (PR #138)
// ---------------------------------------------------------------------------------------------

// Like fakeClient, but the first reply can carry several calls, and streamed chunks can omit
// `index` the way some OpenAI-compatible APIs do.
function fakeMultiClient(finishReason, calls, { omitIndex = false } = {}) {
  let requests = 0;
  return {
    chat: {
      completions: {
        create: async (body) => {
          const first = ++requests === 1;
          const toolCalls = first
            ? calls.map((c) => ({
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: c.arguments },
              }))
            : [];
          const reason = first ? finishReason : "stop";
          const content = first ? "" : "done";
          if (!body.stream)
            return {
              choices: [
                {
                  message: { content, tool_calls: toolCalls },
                  finish_reason: reason,
                },
              ],
            };
          return (async function* () {
            if (content)
              yield { choices: [{ delta: { content }, finish_reason: null }] };
            // One chunk per call, as Gemini sends them; `index` optionally left out.
            for (const [index, call] of toolCalls.entries())
              yield {
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        { ...call, ...(omitIndex ? {} : { index }) },
                      ],
                    },
                    finish_reason: null,
                  },
                ],
              };
            yield { choices: [{ delta: {}, finish_reason: reason }] };
          })();
        },
      },
    },
  };
}

function runtimeRecording(client, toolNames = ["first"]) {
  const counter = { fallbacks: 0 };
  const executed = [];
  const runtime = createRuntime({
    adapter: createFallbackChain({
      models: [adapterWith(client), backupModel(counter)],
    }),
    tools: toolNames.map((name) => ({
      name,
      description: name,
      location: "server",
      inputSchema: { type: "object" },
      handler: async (args) => {
        executed.push({ name, args });
        return "OK";
      },
    })),
  });
  return { runtime, counter, executed };
}

for (const streaming of [false, true]) {
  test(`OpenAI-compatible ${streaming ? "stream" : "response"}: a "stop" turn whose call got no arguments is rejected`, async () => {
    const { runtime, counter, executed } = runtimeRecording(
      fakeMultiClient("stop", [{ id: "a", name: "first", arguments: "" }]),
    );
    const result = await runtime.chat(request(streaming));
    assert.equal(executed.length, 0, "never run a tool with nothing filled in");
    assert.equal(counter.fallbacks, 1);
    assert.equal(result.text, "recovered");
  });

  test(`OpenAI-compatible ${streaming ? "stream" : "response"}: a "stop" turn calling a zero-argument tool with {} still runs`, async () => {
    const { runtime, counter, executed } = runtimeRecording(
      fakeMultiClient("stop", [{ id: "a", name: "first", arguments: "{}" }]),
    );
    const result = await runtime.chat(request(streaming));
    assert.equal(result.error, undefined, JSON.stringify(result.error));
    assert.deepEqual(executed, [{ name: "first", args: {} }]);
    assert.equal(counter.fallbacks, 0);
  });
}

test("OpenAI-compatible stream: parallel calls without an index stay separate (Gemini)", async () => {
  const { runtime, counter, executed } = runtimeRecording(
    fakeMultiClient(
      "stop",
      [
        { id: "a", name: "first", arguments: '{"n":1}' },
        { id: "b", name: "second", arguments: '{"n":2}' },
      ],
      { omitIndex: true },
    ),
    ["first", "second"],
  );
  const result = await runtime.chat(request(true));
  assert.equal(result.error, undefined, JSON.stringify(result.error));
  assert.equal(counter.fallbacks, 0);
  assert.deepEqual(
    executed.sort((x, y) => x.name.localeCompare(y.name)),
    [
      { name: "first", args: { n: 1 } },
      { name: "second", args: { n: 2 } },
    ],
  );
});

// ---- Provider API (generateText/streamText path) and google(): same finish reason for the same reply.
const { openai } = require("../dist/providers/openai/index.js");
const { google } = require("../dist/providers/google/index.js");
const { before, after } = require("node:test");
let providerReply;
const originalPosts = new Map();
before(async () => {
  for (const Client of new Set([
    require("openai").default,
    (await import("openai")).default,
  ])) {
    originalPosts.set(Client, Client.prototype.post);
    Client.prototype.post = function (path, options) {
      const p = Promise.resolve().then(() => providerReply(path, options));
      p._thenUnwrap = (fn) => p.then(fn);
      return p;
    };
  }
});
after(() => {
  for (const [Client, post] of originalPosts) Client.prototype.post = post;
});

function geminiStyleReply(calls, { omitIndex = false } = {}) {
  const toolCalls = calls.map((c) => ({
    id: c.id,
    type: "function",
    function: { name: c.name, arguments: c.arguments },
  }));
  return (path, { body }) => {
    if (!body.stream)
      return {
        choices: [
          {
            message: { content: "", tool_calls: toolCalls },
            finish_reason: "stop",
          },
        ],
      };
    return (async function* () {
      for (const [index, call] of toolCalls.entries())
        yield {
          choices: [
            {
              delta: {
                tool_calls: [{ ...call, ...(omitIndex ? {} : { index }) }],
              },
              finish_reason: null,
            },
          ],
        };
      yield { choices: [{ delta: {}, finish_reason: "stop" }] };
    })();
  };
}

const twoCalls = [
  { id: "a", name: "first", arguments: '{"n":1}' },
  { id: "b", name: "second", arguments: '{"n":2}' },
];
const providers = {
  "openai()": () => openai("gpt-4o", { apiKey: "fixture" }),
  "google()": () => google("gemini-3.1-flash-lite", { apiKey: "fixture" }),
};
for (const [label, make] of Object.entries(providers)) {
  test(`${label} doGenerate: a "stop" reply with tool calls reports finishReason "tool-calls"`, async () => {
    providerReply = geminiStyleReply(twoCalls);
    const result = await make().doGenerate({
      messages: [{ role: "user", content: "hi" }],
      openai: { api: "chat" },
    });
    assert.equal(result.finishReason, "tool-calls");
    assert.deepEqual(
      result.toolCalls.map((c) => c.id),
      ["a", "b"],
    );
  });

  test(`${label} doStream: a "stop" reply with tool calls reports finishReason "tool-calls"`, async () => {
    providerReply = geminiStyleReply(twoCalls);
    const chunks = [];
    for await (const chunk of make().doStream({
      messages: [{ role: "user", content: "hi" }],
      openai: { api: "chat" },
    }))
      chunks.push(chunk);
    assert.equal(
      chunks.find((c) => c.type === "finish").finishReason,
      "tool-calls",
    );
    assert.deepEqual(
      chunks
        .filter((c) => c.type === "tool-call")
        .map((c) => [c.toolCall.id, c.toolCall.name, c.toolCall.args]),
      [
        ["a", "first", { n: 1 }],
        ["b", "second", { n: 2 }],
      ],
    );
  });
}

test("openai() doStream: parallel calls without an index stay separate", async () => {
  providerReply = geminiStyleReply(twoCalls, { omitIndex: true });
  const chunks = [];
  for await (const chunk of openai("gpt-4o", { apiKey: "fixture" }).doStream({
    messages: [{ role: "user", content: "hi" }],
    openai: { api: "chat" },
  }))
    chunks.push(chunk);
  assert.deepEqual(
    chunks
      .filter((c) => c.type === "tool-call")
      .map((c) => [c.toolCall.id, c.toolCall.name, c.toolCall.args]),
    [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  );
});

test('openai() doGenerate: a plain "stop" reply without tool calls is still "stop"', async () => {
  providerReply = () => ({
    choices: [{ message: { content: "hello" }, finish_reason: "stop" }],
  });
  const result = await openai("gpt-4o", { apiKey: "fixture" }).doGenerate({
    messages: [{ role: "user", content: "hi" }],
    openai: { api: "chat" },
  });
  assert.equal(result.finishReason, "stop");
});

// ---- Agent-loop formatter: same rule as the adapters, including legacy function_call.
for (const reason of ["function_call", "tool_calls"])
  test(`runAgentLoop: an OpenAI-format response ending with "${reason}" runs its tool`, async () => {
    let requests = 0;
    let resolved = 0;
    for await (const event of runAgentLoop({
      provider: { name: "openai" },
      messages: [{ role: "user", content: "test" }],
      tools: [
        {
          name: "confirm",
          description: "confirm",
          location: "client",
          inputSchema: { type: "object" },
        },
      ],
      callLLM: async () => ({
        choices: [
          {
            finish_reason: ++requests === 1 ? reason : "stop",
            message: {
              content: requests === 1 ? "" : "OK",
              tool_calls:
                requests === 1
                  ? [
                      {
                        id: "a",
                        type: "function",
                        function: { name: "confirm", arguments: "{}" },
                      },
                    ]
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
      assert.notEqual(event.type, "error", JSON.stringify(event));
    assert.equal(resolved, 1);
    assert.equal(requests, 2);
  });
