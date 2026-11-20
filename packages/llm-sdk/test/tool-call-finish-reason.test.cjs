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

// ---------------------------------------------------------------------------------------------
// Second review (PR #138)
// ---------------------------------------------------------------------------------------------

// Streams the given chunks as-is, then a finish chunk. Lets a test send exactly the shapes a
// provider produces (same index for parallel calls, continuation chunks, missing ids...).
function chunkReply(parts, finishReason = "stop") {
  return (path, { body }) => {
    assert.ok(body.stream, "these fixtures are streaming only");
    return (async function* () {
      for (const part of parts)
        yield {
          choices: [{ delta: { tool_calls: [part] }, finish_reason: null }],
        };
      yield { choices: [{ delta: {}, finish_reason: finishReason }] };
    })();
  };
}
async function streamedToolCalls(parts, finishReason) {
  providerReply = chunkReply(parts, finishReason);
  const chunks = [];
  for await (const chunk of openai("gpt-4o", { apiKey: "fixture" }).doStream({
    messages: [{ role: "user", content: "hi" }],
    openai: { api: "chat" },
  }))
    chunks.push(chunk);
  return chunks
    .filter((c) => c.type === "tool-call")
    .map((c) => [c.toolCall.id, c.toolCall.name, c.toolCall.args]);
}

test("openai() doStream: parallel calls sent at the same index stay separate", async () => {
  assert.deepEqual(
    await streamedToolCalls([
      {
        index: 0,
        id: "a",
        type: "function",
        function: { name: "first", arguments: '{"n":1}' },
      },
      {
        index: 0,
        id: "b",
        type: "function",
        function: { name: "second", arguments: '{"n":2}' },
      },
    ]),
    [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  );
});

test("openai() doStream: a continuation chunk at a reused index joins the latest call there", async () => {
  assert.deepEqual(
    await streamedToolCalls([
      {
        index: 0,
        id: "a",
        type: "function",
        function: { name: "first", arguments: '{"n":1}' },
      },
      {
        index: 0,
        id: "b",
        type: "function",
        function: { name: "second", arguments: '{"n"' },
      },
      { index: 0, function: { arguments: ":2}" } },
    ]),
    [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  );
});

test("openai() doStream: OpenAI's usual shape (own index, id only on the first chunk) is unchanged", async () => {
  assert.deepEqual(
    await streamedToolCalls(
      [
        {
          index: 0,
          id: "a",
          type: "function",
          function: { name: "first", arguments: "" },
        },
        {
          index: 1,
          id: "b",
          type: "function",
          function: { name: "second", arguments: "" },
        },
        { index: 0, function: { arguments: '{"n":1}' } },
        { index: 1, function: { arguments: '{"n":2}' } },
      ],
      "tool_calls",
    ),
    [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  );
});

test("runtime stream: parallel calls sent at the same index both run (Gemini)", async () => {
  const { runtime, counter, executed } = runtimeRecording(
    {
      chat: {
        completions: {
          create: (() => {
            let requests = 0;
            return async () => {
              const first = ++requests === 1;
              return (async function* () {
                if (!first) {
                  yield {
                    choices: [
                      { delta: { content: "done" }, finish_reason: "stop" },
                    ],
                  };
                  return;
                }
                for (const [id, name, args] of [
                  ["a", "first", '{"n":1}'],
                  ["b", "second", '{"n":2}'],
                ])
                  yield {
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            {
                              index: 0,
                              id,
                              type: "function",
                              function: { name, arguments: args },
                            },
                          ],
                        },
                        finish_reason: null,
                      },
                    ],
                  };
                yield { choices: [{ delta: {}, finish_reason: "stop" }] };
              })();
            };
          })(),
        },
      },
    },
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

test('runAgentLoop: a "stop" turn whose call has no arguments does not run the tool', async () => {
  let resolved = 0;
  const seen = [];
  for await (const event of runAgentLoop({
    provider: { name: "openai" },
    messages: [{ role: "user", content: "test" }],
    tools: [
      {
        name: "delete_item",
        description: "delete",
        location: "client",
        inputSchema: { type: "object" },
      },
    ],
    callLLM: async () => ({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: "",
            tool_calls: [
              {
                id: "a",
                type: "function",
                function: { name: "delete_item", arguments: "" },
              },
            ],
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
  assert.equal(resolved, 0, "never run a tool with nothing filled in");
  assert.ok(seen.some((event) => event.type === "error"));
});

for (const [label, complete] of [
  [
    "adapter",
    async () => {
      const { client } = fakeClient("length", {
        name: "first",
        arguments: '{"n":',
      });
      return adapterWith(client).complete(request(false));
    },
  ],
  [
    "openai() doGenerate",
    async () => {
      providerReply = () => ({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "a",
                  type: "function",
                  function: { name: "first", arguments: '{"n":' },
                },
              ],
            },
            finish_reason: "length",
          },
        ],
      });
      return openai("gpt-4o", { apiKey: "fixture" }).doGenerate({
        messages: [{ role: "user", content: "hi" }],
        openai: { api: "chat" },
      });
    },
  ],
])
  test(`${label}: a truncated tool turn reports incomplete tool calls, not invalid JSON`, async () => {
    await assert.rejects(complete, /ended with incomplete tool calls/);
  });

test("collect(): tool_calls before action:start keeps the hidden flag, the later args, and the recorded events", async () => {
  const { StreamResult } = require("../dist/index.js");
  const first = {
    type: "tool_calls",
    toolCalls: [{ id: "c1", name: "lookup", args: { a: 1 } }],
  };
  const result = await new StreamResult(
    (async function* () {
      yield first;
      yield { type: "action:start", id: "c1", name: "lookup", hidden: true };
      yield {
        type: "tool_calls",
        toolCalls: [{ id: "c1", name: "lookup", args: { a: 2 } }],
      };
      yield { type: "done", requiresAction: true, messages: [] };
    })(),
  ).collect();
  assert.equal(result.toolCalls.length, 1);
  assert.deepEqual(
    result.toolCalls[0].args,
    { a: 2 },
    "the later announcement's arguments win",
  );
  assert.equal(
    result.toolCalls[0].hidden,
    true,
    "action:start's hidden flag is kept",
  );
  assert.deepEqual(
    first.toolCalls[0].args,
    { a: 1 },
    "the recorded event is not rewritten",
  );
});

// ---------------------------------------------------------------------------------------------
// Third review (staged changes)
// ---------------------------------------------------------------------------------------------

test("openai() doStream: interleaved chunks of two calls at the same index reassemble by id", async () => {
  assert.deepEqual(
    await streamedToolCalls([
      {
        index: 0,
        id: "a",
        type: "function",
        function: { name: "first", arguments: '{"n"' },
      },
      {
        index: 0,
        id: "b",
        type: "function",
        function: { name: "second", arguments: '{"n":2}' },
      },
      { index: 0, id: "a", function: { arguments: ":1}" } },
    ]),
    [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  );
});

test("openai() doStream: a server that changes the id on every chunk of one call still yields one call", async () => {
  const calls = await streamedToolCalls(
    [
      {
        index: 0,
        id: "x1",
        type: "function",
        function: { name: "first", arguments: '{"n"' },
      },
      { index: 0, id: "x2", function: { arguments: ":1}" } },
    ],
    "tool_calls",
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "first");
  assert.deepEqual(calls[0][2], { n: 1 });
});

test("openai() doStream: a name repeated on every chunk is not doubled", async () => {
  assert.deepEqual(
    await streamedToolCalls(
      [
        {
          index: 0,
          id: "a",
          type: "function",
          function: { name: "lookup", arguments: '{"n"' },
        },
        {
          index: 0,
          id: "a",
          type: "function",
          function: { name: "lookup", arguments: ":1}" },
        },
      ],
      "tool_calls",
    ),
    [["a", "lookup", { n: 1 }]],
  );
});

test('runAgentLoop: a "stop" turn whose arguments arrive already parsed still runs the tool', async () => {
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
    callLLM: (() => {
      let requests = 0;
      return async () => ({
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
                        function: { name: "confirm", arguments: { ok: true } },
                      },
                    ]
                  : [],
            },
          },
        ],
      });
    })(),
    waitForClientToolResult: async () => {
      resolved++;
      return { success: true };
    },
  }))
    assert.notEqual(event.type, "error", JSON.stringify(event));
  assert.equal(resolved, 1);
});

// ---------------------------------------------------------------------------------------------
// collect(): which calls are pending, including backends that reuse ids across loop iterations
// ---------------------------------------------------------------------------------------------
async function collectEvents(events) {
  const { StreamResult } = require("../dist/index.js");
  return new StreamResult(
    (async function* () {
      yield* events;
    })(),
  ).collect();
}
const started = (id, name, args) => [
  { type: "action:start", id, name },
  { type: "action:args", id, args: JSON.stringify(args) },
  { type: "action:end", id, name },
];

test("collect(): a client call that reuses an id an earlier iteration answered is still pending", async () => {
  const result = await collectEvents([
    ...started("call_0", "lookup", { a: 1 }), // iteration 1: server tool, executed inline
    ...started("call_0", "confirm", { a: 2 }), // iteration 2: client tool with the same id
    {
      type: "tool_calls",
      toolCalls: [{ id: "call_0", name: "confirm", args: { a: 2 } }],
    },
    {
      type: "done",
      requiresAction: true,
      messages: [{ role: "tool", tool_call_id: "call_0", content: "ok" }],
    },
  ]);
  assert.equal(result.requiresAction, true);
  assert.deepEqual(
    result.toolCalls.map((call) => [call.id, call.name, call.args]),
    [["call_0", "confirm", { a: 2 }]],
  );
});

test("collect(): calls that reuse an id across iterations are each listed with their own arguments", async () => {
  const result = await collectEvents([
    ...started("call_0", "lookup", { a: 1 }),
    ...started("call_0", "lookup", { a: 2 }),
    { type: "done", messages: [] },
  ]);
  assert.deepEqual(
    result.toolCalls.map((call) => [call.id, call.args]),
    [
      ["call_0", { a: 1 }],
      ["call_0", { a: 2 }],
    ],
  );
});

test("collect(): a mixed turn lists only the client call the runtime announced", async () => {
  const result = await collectEvents([
    ...started("s1", "lookup", { a: 1 }),
    ...started("c1", "confirm", { a: 2 }),
    {
      type: "tool_calls",
      toolCalls: [{ id: "c1", name: "confirm", args: { a: 2 } }],
    },
    {
      type: "done",
      requiresAction: true,
      messages: [{ role: "tool", tool_call_id: "s1", content: "ok" }],
    },
  ]);
  assert.deepEqual(
    result.toolCalls.map((call) => call.id),
    ["c1"],
  );
});

test("collect(): without a tool_calls event, answered ids are still dropped as before", async () => {
  const result = await collectEvents([
    ...started("s1", "lookup", { a: 1 }),
    ...started("c1", "confirm", { a: 2 }),
    {
      type: "done",
      requiresAction: true,
      messages: [{ role: "tool", tool_call_id: "s1", content: "ok" }],
    },
  ]);
  assert.deepEqual(
    result.toolCalls.map((call) => [call.id, call.args]),
    [["c1", { a: 2 }]],
  );
});

test("runtime.chat(): a backend that reuses call ids every turn still hands the client its call", async () => {
  let requests = 0;
  let serverRuns = 0;
  const reply = (name) =>
    (async function* () {
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_0",
                  type: "function",
                  function: { name, arguments: "{}" },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };
      yield { choices: [{ delta: {}, finish_reason: "tool_calls" }] };
    })();
  const runtime = createRuntime({
    adapter: adapterWith({
      chat: {
        completions: {
          // Reply 1 calls the server tool, reply 2 calls the client tool, both as "call_0".
          create: async () => reply(++requests === 1 ? "first" : "confirm"),
        },
      },
    }),
    tools: [
      {
        name: "first",
        description: "first",
        location: "server",
        inputSchema: { type: "object" },
        handler: async () => {
          serverRuns++;
          return "OK";
        },
      },
    ],
  });
  const result = await runtime.chat({
    ...request(true),
    tools: [
      {
        name: "confirm",
        description: "confirm",
        inputSchema: { type: "object" },
      },
    ],
  });
  assert.equal(result.error, undefined, JSON.stringify(result.error));
  assert.equal(serverRuns, 1);
  assert.equal(result.requiresAction, true);
  assert.deepEqual(
    result.toolCalls.map((call) => [call.id, call.name]),
    [["call_0", "confirm"]],
  );
});

// ---- The other two collectors (handleRequest JSON and generate()) follow the same rule.
function reusedIdRuntime() {
  let requests = 0;
  // Reply 1 calls the server tool, reply 2 the client tool, both with the id "call_0".
  const reply = (name, stream) => {
    const call = {
      id: "call_0",
      type: "function",
      function: { name, arguments: "{}" },
    };
    if (!stream)
      return {
        choices: [
          {
            message: { content: "", tool_calls: [call] },
            finish_reason: "tool_calls",
          },
        ],
      };
    return (async function* () {
      yield {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, ...call }] },
            finish_reason: null,
          },
        ],
      };
      yield { choices: [{ delta: {}, finish_reason: "tool_calls" }] };
    })();
  };
  return createRuntime({
    adapter: adapterWith({
      chat: {
        completions: {
          create: async (body) =>
            reply(++requests === 1 ? "first" : "confirm", body.stream),
        },
      },
    }),
    tools: [
      {
        name: "first",
        description: "first",
        location: "server",
        inputSchema: { type: "object" },
        handler: async () => "OK",
      },
    ],
  });
}
const clientTool = {
  name: "confirm",
  description: "confirm",
  inputSchema: { type: "object" },
};

test("runtime.generate(): a reused call id still hands the client its call", async () => {
  const result = await reusedIdRuntime().generate({
    messages: [{ role: "user", content: "test" }],
    tools: [clientTool],
  });
  assert.equal(result.requiresAction, true);
  assert.deepEqual(
    result.toolCalls.map((call) => [call.id, call.name]),
    [["call_0", "confirm"]],
  );
});

test("runtime.handleRequest() JSON: a reused call id still hands the client its call", async () => {
  const originalLog = console.log;
  console.log = () => {};
  let body;
  try {
    const response = await reusedIdRuntime().handleRequest(
      new Request("https://copilot.test/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "test" }],
          tools: [clientTool],
          streaming: false,
        }),
      }),
    );
    body = await response.json();
  } finally {
    console.log = originalLog;
  }
  assert.equal(body.requiresAction, true, JSON.stringify(body.error));
  assert.deepEqual(
    body.toolCalls.map((call) => [call.id, call.name]),
    [["call_0", "confirm"]],
  );
});

// ---- Reused ids when the turn does NOT suspend: each call keeps its own arguments.
function reusedIdServerOnlyRuntime() {
  let requests = 0;
  const reply = (stream) => {
    const turn = ++requests;
    const call =
      turn <= 2
        ? {
            id: "call_0",
            type: "function",
            function: { name: "first", arguments: JSON.stringify({ a: turn }) },
          }
        : null;
    if (!stream)
      return {
        choices: [
          {
            message: {
              content: call ? "" : "done",
              ...(call ? { tool_calls: [call] } : {}),
            },
            finish_reason: call ? "tool_calls" : "stop",
          },
        ],
      };
    return (async function* () {
      yield {
        choices: [
          {
            delta: call
              ? { tool_calls: [{ index: 0, ...call }] }
              : { content: "done" },
            finish_reason: null,
          },
        ],
      };
      yield {
        choices: [{ delta: {}, finish_reason: call ? "tool_calls" : "stop" }],
      };
    })();
  };
  return createRuntime({
    adapter: adapterWith({
      chat: { completions: { create: async (body) => reply(body.stream) } },
    }),
    tools: [
      {
        name: "first",
        description: "first",
        location: "server",
        inputSchema: { type: "object" },
        handler: async () => "OK",
      },
    ],
  });
}
const twoRuns = [
  ["call_0", { a: 1 }],
  ["call_0", { a: 2 }],
];

test("runtime.generate(): calls reusing an id across iterations keep their own arguments", async () => {
  const result = await reusedIdServerOnlyRuntime().generate({
    messages: [{ role: "user", content: "test" }],
  });
  assert.equal(result.text, "done");
  assert.deepEqual(
    result.toolCalls.map((call) => [call.id, call.args]),
    twoRuns,
  );
});

test("runtime.handleRequest() JSON: calls reusing an id across iterations keep their own arguments", async () => {
  const originalLog = console.log;
  console.log = () => {};
  let body;
  try {
    const response = await reusedIdServerOnlyRuntime().handleRequest(
      new Request("https://copilot.test/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "test" }],
          streaming: false,
        }),
      }),
    );
    body = await response.json();
  } finally {
    console.log = originalLog;
  }
  assert.deepEqual(
    body.toolCalls.map((call) => [call.id, call.args]),
    twoRuns,
  );
});

// ---- Non-streaming: a client-only turn keeps each call's provider metadata. Gemini rejects the
// follow-up request when the thought_signature it sent with a call does not come back.
test("runtime.handleRequest() JSON: a client tool call keeps its extra_content (Gemini thought_signature)", async () => {
  const signature = { google: { thought_signature: "sig_1" } };
  const runtime = createRuntime({
    adapter: adapterWith({
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: "",
                  tool_calls: [
                    {
                      id: "call_0",
                      type: "function",
                      function: { name: "confirm", arguments: "{}" },
                      extra_content: signature,
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          }),
        },
      },
    }),
  });
  const originalLog = console.log;
  console.log = () => {};
  let body;
  try {
    const response = await runtime.handleRequest(
      new Request("https://copilot.test/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "test" }],
          tools: [clientTool],
          streaming: false,
        }),
      }),
    );
    body = await response.json();
  } finally {
    console.log = originalLog;
  }
  assert.equal(body.requiresAction, true, JSON.stringify(body.error));
  const assistant = body.messages.find((message) => message.tool_calls);
  assert.deepEqual(
    assistant.tool_calls[0].extra_content,
    signature,
    "the assistant message the client sends back carries the signature",
  );
});
