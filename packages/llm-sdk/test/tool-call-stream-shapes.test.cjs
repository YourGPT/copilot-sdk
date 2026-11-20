// How OpenAI-format providers stream tool calls differs: a call can arrive in pieces or whole,
// `index` can be per call, shared, or missing, and `id` / the name can come once or on every chunk.
// Every shape below runs through BOTH stream paths that assemble chunks (the adapter used by
// createRuntime, and the openai() provider used by streamText), and must yield the same calls.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { OpenAIAdapter } = require("../dist/adapters/index.js");
const { openai } = require("../dist/providers/openai/index.js");

const fn = (name, args) => ({ name, arguments: args });
const whole = (id, name, args, extra = {}) => ({
  id,
  type: "function",
  function: fn(name, args),
  ...extra,
});

// Each chunk is the `delta.tool_calls` array of one stream chunk.
const SHAPES = [
  {
    name: "OpenAI: one call, header then argument deltas",
    chunks: [
      [{ index: 0, ...whole("a", "first", "") }],
      [{ index: 0, function: { arguments: '{"n"' } }],
      [{ index: 0, function: { arguments: ":1}" } }],
    ],
    expect: [["a", "first", { n: 1 }]],
  },
  {
    name: "OpenAI: parallel calls, own index, one after the other",
    chunks: [
      [{ index: 0, ...whole("a", "first", "") }],
      [{ index: 0, function: { arguments: '{"n":1}' } }],
      [{ index: 1, ...whole("b", "second", "") }],
      [{ index: 1, function: { arguments: '{"n":2}' } }],
    ],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  },
  {
    name: "OpenAI: parallel calls, own index, deltas interleaved",
    chunks: [
      [{ index: 0, ...whole("a", "first", "") }],
      [{ index: 1, ...whole("b", "second", "") }],
      [{ index: 0, function: { arguments: '{"n"' } }],
      [{ index: 1, function: { arguments: '{"n"' } }],
      [{ index: 0, function: { arguments: ":1}" } }],
      [{ index: 1, function: { arguments: ":2}" } }],
    ],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  },
  {
    name: "whole call per chunk, own index (xAI, Groq, newer Ollama)",
    chunks: [
      [{ index: 0, ...whole("a", "first", '{"n":1}') }],
      [{ index: 1, ...whole("b", "second", '{"n":2}') }],
    ],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  },
  {
    name: "whole calls all at index 0, separate chunks (Gemini, older Ollama)",
    chunks: [
      [{ index: 0, ...whole("a", "first", '{"n":1}') }],
      [{ index: 0, ...whole("b", "second", '{"n":2}') }],
      [{ index: 0, ...whole("c", "first", '{"n":3}') }],
    ],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
      ["c", "first", { n: 3 }],
    ],
  },
  {
    name: "whole calls all at index 0, in one chunk",
    chunks: [
      [
        { index: 0, ...whole("a", "first", '{"n":1}') },
        { index: 0, ...whole("b", "first", '{"n":2}') },
      ],
    ],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "first", { n: 2 }],
    ],
  },
  {
    name: "whole calls with no index, separate chunks (Gemini)",
    chunks: [
      [whole("a", "first", '{"n":1}')],
      [whole("b", "second", '{"n":2}')],
    ],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  },
  {
    name: "whole calls with no index, in one chunk",
    chunks: [[whole("a", "first", '{"n":1}'), whole("b", "first", '{"n":2}')]],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "first", { n: 2 }],
    ],
  },
  {
    name: "no index: header then deltas without id, two calls in sequence",
    chunks: [
      [whole("a", "first", "")],
      [{ function: { arguments: '{"n"' } }],
      [{ function: { arguments: ":1}" } }],
      [whole("b", "second", "")],
      [{ function: { arguments: '{"n":2}' } }],
    ],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  },
  {
    name: "id and name repeated on every chunk of a call",
    chunks: [
      [{ index: 0, ...whole("a", "lookup", '{"n"') }],
      [{ index: 0, ...whole("a", "lookup", ":1}") }],
      [{ index: 0, ...whole("a", "lookup", "") }],
    ],
    expect: [["a", "lookup", { n: 1 }]],
  },
  {
    name: "no index, id on every chunk, two calls interleaved",
    chunks: [
      [whole("a", "first", '{"n"')],
      [whole("b", "second", '{"n"')],
      [{ id: "a", function: { arguments: ":1}" } }],
      [{ id: "b", function: { arguments: ":2}" } }],
    ],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  },
  {
    name: "same index, two calls interleaved, told apart by id",
    chunks: [
      [{ index: 0, ...whole("a", "first", '{"n"') }],
      [{ index: 0, ...whole("b", "second", '{"n":2}') }],
      [{ index: 0, id: "a", function: { arguments: ":1}" } }],
    ],
    expect: [
      ["a", "first", { n: 1 }],
      ["b", "second", { n: 2 }],
    ],
  },
  {
    name: "id changes on every chunk of one call",
    chunks: [
      [{ index: 0, ...whole("x1", "first", '{"n"') }],
      [{ index: 0, id: "x2", function: { arguments: ":1}" } }],
    ],
    expect: [["x2", "first", { n: 1 }]],
  },
  {
    name: "name repeated on a trailing empty delta after the arguments are complete",
    chunks: [
      [{ index: 0, ...whole("a", "lookup", '{"n":1}') }],
      [{ index: 0, function: fn("lookup", "") }],
    ],
    expect: [["a", "lookup", { n: 1 }]],
  },
  {
    name: "a name sent in two fragments is joined",
    chunks: [
      [{ index: 0, ...whole("a", "get_", "") }],
      [{ index: 0, function: fn("weather", '{"n":1}') }],
    ],
    expect: [["a", "get_weather", { n: 1 }]],
  },
  {
    name: 'no-argument call sent whole as "{}"',
    chunks: [[{ index: 0, ...whole("a", "first", "{}") }]],
    finish: "stop",
    expect: [["a", "first", {}]],
  },
  {
    name: "no-argument call with empty argument text, finish tool_calls",
    chunks: [[{ index: 0, ...whole("a", "first", "") }]],
    finish: "tool_calls",
    expect: [["a", "first", {}]],
  },
  {
    name: "two no-argument calls sent whole at the same index",
    chunks: [
      [{ index: 0, ...whole("a", "first", "{}") }],
      [{ index: 0, ...whole("b", "first", "{}") }],
    ],
    expect: [
      ["a", "first", {}],
      ["b", "first", {}],
    ],
  },
  {
    name: "two calls to the same no-argument tool, header only, same index",
    chunks: [
      [{ index: 0, ...whole("a", "ping", "") }],
      [{ index: 0, ...whole("b", "ping", "") }],
    ],
    finish: "tool_calls",
    expect: [
      ["a", "ping", {}],
      ["b", "ping", {}],
    ],
  },
  {
    name: "two calls to the same no-argument tool, header only, no index",
    chunks: [[whole("a", "ping", "")], [whole("b", "ping", "")]],
    finish: "tool_calls",
    expect: [
      ["a", "ping", {}],
      ["b", "ping", {}],
    ],
  },
  {
    name: "a trailing chunk that carries only a new id adds no call",
    chunks: [
      [{ index: 0, ...whole("a", "lookup", '{"n":1}') }],
      [{ index: 0, id: "z" }],
    ],
    expect: [["z", "lookup", { n: 1 }]],
  },
  {
    name: "no index: two calls to the same tool, headers first, then arguments by id",
    chunks: [
      [whole("a", "f", "")],
      [whole("b", "f", "")],
      [{ id: "a", function: { arguments: '{"x":1}' } }],
      [{ id: "b", function: { arguments: '{"y":2}' } }],
    ],
    expect: [
      ["a", "f", { x: 1 }],
      ["b", "f", { y: 2 }],
    ],
  },
  {
    name: "no index: id, name and arguments each in their own chunk, two calls",
    chunks: [
      [{ id: "a" }],
      [{ function: { name: "f" } }],
      [{ function: { arguments: "{}" } }],
      [{ id: "b" }],
      [{ function: { name: "f" } }],
      [{ function: { arguments: "{}" } }],
    ],
    expect: [
      ["a", "f", {}],
      ["b", "f", {}],
    ],
  },
  {
    name: "same index, two calls to the same tool interleaved, told apart by id",
    chunks: [
      [{ index: 0, ...whole("a", "f", '{"x"') }],
      [{ index: 0, ...whole("b", "f", '{"y":2}') }],
      [{ index: 0, id: "a", function: { arguments: ":1}" } }],
    ],
    expect: [
      ["a", "f", { x: 1 }],
      ["b", "f", { y: 2 }],
    ],
  },
  // ---- Streams that cannot be read safely end as an error; no call is produced.
  {
    // Two calls where only one sent arguments, or one call whose id was renewed? Nobody can
    // tell, so the turn is rejected instead of silently dropping a call.
    name: "same index: two same-name headers, then arguments with no id, is rejected",
    chunks: [
      [{ index: 0, ...whole("a", "f", "") }],
      [{ index: 0, ...whole("b", "f", "") }],
      [{ index: 0, function: { arguments: '{"x":1}' } }],
    ],
    error: /ambiguous/,
  },
  {
    name: "same index: three same-name headers, then arguments, is rejected",
    chunks: [
      [{ index: 0, ...whole("a", "f", "") }],
      [{ index: 0, ...whole("b", "f", "") }],
      [{ index: 0, ...whole("c", "f", "") }],
      [{ index: 0, function: { arguments: '{"x":1}' } }],
    ],
    error: /ambiguous/,
  },
  {
    // Never worked: before, the repeated name was doubled ("firstfirst") and the turn failed.
    name: "id renewed and name repeated on every chunk of one call is rejected",
    chunks: [
      [{ index: 0, ...whole("x1", "first", '{"n"') }],
      [{ index: 0, ...whole("x2", "first", ":1}") }],
    ],
    error: /not valid JSON/,
  },
  {
    name: "id renewed and name repeated, arguments starting on the second chunk, is rejected",
    chunks: [
      [{ index: 0, ...whole("x1", "first", "") }],
      [{ index: 0, ...whole("x2", "first", '{"n"') }],
      [{ index: 0, ...whole("x3", "first", ":1}") }],
    ],
    error: /ambiguous|not valid JSON/,
  },
  {
    name: "calls with no id at all are rejected",
    chunks: [
      [{ function: fn("first", '{"n":1}') }],
      [{ function: fn("second", '{"n":2}') }],
    ],
    error:
      /incomplete tool call|missing or duplicate identities|not valid JSON/,
  },
  {
    name: "one id used for two whole calls is rejected",
    chunks: [
      [{ index: 0, ...whole("a", "first", '{"n":1}') }],
      [{ index: 1, ...whole("a", "second", '{"n":2}') }],
    ],
    error: /not valid JSON/,
  },
  {
    name: "arguments cut off by the length limit are rejected",
    chunks: [[{ index: 0, ...whole("a", "first", '{"n":') }]],
    finish: "length",
    error: /incomplete tool calls/,
  },
  {
    name: 'a "stop" turn whose call never received arguments is rejected',
    chunks: [[{ index: 0, ...whole("a", "first", "") }]],
    finish: "stop",
    error: /no arguments/,
  },
];

function streamOf(shape, finish) {
  return (async function* () {
    for (const parts of shape.chunks)
      yield {
        choices: [{ delta: { tool_calls: parts }, finish_reason: null }],
      };
    yield { choices: [{ delta: {}, finish_reason: finish }] };
  })();
}

// ---- Path 1: the adapter behind createRuntime (what a Copilot backend uses).
async function viaAdapter(shape, finish) {
  const adapter = new OpenAIAdapter({
    apiKey: "fixture",
    model: "gemini-3.1-flash-lite",
    api: "chat",
  });
  adapter.client = {
    chat: { completions: { create: async () => streamOf(shape, finish) } },
  };
  const events = [];
  for await (const event of adapter.stream({
    messages: [{ role: "user", content: "test" }],
  }))
    events.push(event);
  const error = events.find((event) => event.type === "error");
  if (error) throw new Error(error.message);
  const args = new Map(
    events
      .filter((event) => event.type === "action:args")
      .map((event) => [event.id, JSON.parse(event.args || "{}")]),
  );
  return events
    .filter((event) => event.type === "action:start")
    .map((event) => [event.id, event.name, args.get(event.id)]);
}

// ---- Path 2: the openai() provider behind streamText / generateText.
let providerStream;
const originalPosts = new Map();
before(async () => {
  for (const Client of new Set([
    require("openai").default,
    (await import("openai")).default,
  ])) {
    originalPosts.set(Client, Client.prototype.post);
    Client.prototype.post = function () {
      const p = Promise.resolve().then(() => providerStream());
      p._thenUnwrap = (fn) => p.then(fn);
      return p;
    };
  }
});
after(() => {
  for (const [Client, post] of originalPosts) Client.prototype.post = post;
});
async function viaProvider(shape, finish) {
  providerStream = () => streamOf(shape, finish);
  const calls = [];
  for await (const chunk of openai("gpt-4o", { apiKey: "fixture" }).doStream({
    messages: [{ role: "user", content: "test" }],
    openai: { api: "chat" },
  }))
    if (chunk.type === "tool-call")
      calls.push([chunk.toolCall.id, chunk.toolCall.name, chunk.toolCall.args]);
  return calls;
}

for (const shape of SHAPES)
  for (const [path, run] of [
    ["adapter", viaAdapter],
    ["openai()", viaProvider],
  ])
    // A shape without its own finish reason must read the same whether the provider ends the
    // turn the OpenAI way ("tool_calls") or the Gemini way ("stop").
    for (const finish of shape.finish ? [shape.finish] : ["tool_calls", "stop"])
      test(`${path} [${finish}]: ${shape.name}`, async () => {
        if (shape.error) await assert.rejects(run(shape, finish), shape.error);
        else assert.deepEqual(await run(shape, finish), shape.expect);
      });

test("adapter: each call keeps its own extra_content (Gemini thought signatures)", async () => {
  const adapter = new OpenAIAdapter({
    apiKey: "fixture",
    model: "gemini-3.1-flash-lite",
    api: "chat",
  });
  const shape = {
    chunks: [
      [
        {
          index: 0,
          ...whole("a", "first", '{"n":1}', {
            extra_content: { google: { thought_signature: "sig-a" } },
          }),
        },
      ],
      [
        {
          index: 0,
          ...whole("b", "second", '{"n":2}', {
            extra_content: { google: { thought_signature: "sig-b" } },
          }),
        },
      ],
    ],
  };
  adapter.client = {
    chat: { completions: { create: async () => streamOf(shape, "stop") } },
  };
  const starts = [];
  for await (const event of adapter.stream({
    messages: [{ role: "user", content: "test" }],
  }))
    if (event.type === "action:start") starts.push(event);
  assert.deepEqual(
    starts.map((event) => [
      event.id,
      event.extra_content.google.thought_signature,
    ]),
    [
      ["a", "sig-a"],
      ["b", "sig-b"],
    ],
  );
});

test("assembling large arguments sent in many small chunks stays fast", async () => {
  // 200KB of argument text in 20,000 chunks. Re-parsing the text on every chunk made this
  // quadratic (seconds of blocked event loop); it must stay linear.
  const piece = "x".repeat(10);
  const chunks = [[{ index: 0, ...whole("a", "first", '{"text":"') }]];
  for (let i = 0; i < 20000; i++)
    chunks.push([{ index: 0, function: { arguments: piece } }]);
  chunks.push([{ index: 0, function: { arguments: '"}' } }]);
  const startedAt = process.hrtime.bigint();
  const calls = await viaAdapter({ chunks }, "tool_calls");
  const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].text.length, 200000);
  assert.ok(ms < 1000, `took ${Math.round(ms)}ms`);
});
