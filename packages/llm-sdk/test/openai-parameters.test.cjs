const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { OpenAIAdapter } = require("../dist/adapters/index.js");
const { openai, createOpenAI } = require("../dist/providers/openai/index.js");
const { createFallbackChain } = require("../dist/fallback/index.js");
const { generateText, streamText } = require("../dist/index.js");
const { z } = require("zod");

// Patch both official-client module entry points; SDK lazy imports use ESM even
// from a CommonJS bundle. Every request is handled by a deterministic fixture.
const originalPosts = new Map();
let requests, reply;
before(async () => {
  const clients = new Set([
    require("openai").default,
    (await import("openai")).default,
  ]);
  for (const Client of clients) {
    originalPosts.set(Client, Client.prototype.post);
    Client.prototype.post = function (path, options) {
      requests.push({ path, ...options, baseURL: this.baseURL });
      const promise = Promise.resolve().then(() => reply(path, options));
      promise._thenUnwrap = (fn) => promise.then(fn);
      return promise;
    };
  }
});
after(() => {
  for (const [Client, post] of originalPosts) Client.prototype.post = post;
});
async function* chunks(items) {
  yield* items;
}
const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 };
const schema = {
  type: "object",
  properties: { id: { type: "string" } },
  required: ["id"],
  additionalProperties: false,
};
const tool = {
  type: "function",
  function: { name: "inspect", description: "Inspect", parameters: schema },
};
const definition = {
  name: "inspect",
  description: "Inspect",
  location: "server",
  inputSchema: schema,
};
const messages = [{ role: "user", content: "hello" }];
const options = { apiKey: "test-only", onWarning() {} };

beforeEach(() => {
  requests = [];
  reply = (path, { body }) => {
    if (path === "/responses")
      return body.stream
        ? chunks([
            { type: "response.output_text.delta", delta: "ok" },
            {
              type: "response.completed",
              response: { status: "completed", output: [], usage },
            },
          ])
        : {
            id: "response-1",
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "ok" }],
              },
            ],
            usage,
          };
    assert.equal(path, "/chat/completions");
    return body.stream
      ? chunks([
          { choices: [{ delta: { content: "ok" }, finish_reason: null }] },
          { choices: [{ delta: {}, finish_reason: "stop" }] },
          {
            choices: [],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          },
        ])
      : {
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        };
  };
});

async function run(mode, model, config = {}, settings = {}) {
  const tools = settings.tools ? [tool] : undefined;
  if (mode.startsWith("modern")) {
    const m = openai(model, { ...options, ...settings.provider });
    const params = {
      messages,
      temperature: 0,
      maxTokens: 256,
      ...config,
      tools,
      signal: settings.signal,
    };
    return mode.endsWith("stream")
      ? collect(m.doStream(params))
      : m.doGenerate(params);
  }
  const adapter = new OpenAIAdapter({
    ...options,
    model,
    ...settings.provider,
  });
  const request = {
    messages: [{ id: "m1", ...messages[0] }],
    config: { temperature: 0, maxTokens: 256, ...config },
    toolDefinitions: settings.tools ? [definition] : undefined,
    signal: settings.signal,
  };
  if (!mode.endsWith("stream")) return adapter.complete(request);
  const events = await collect(adapter.stream(request));
  if (!settings.expectError)
    assert.ok(!events.some((e) => e.type === "error"), JSON.stringify(events));
  return events;
}
async function collect(stream) {
  const out = [];
  for await (const event of stream) out.push(event);
  return out;
}

for (const mode of [
  "modern-complete",
  "modern-stream",
  "runtime-complete",
  "runtime-stream",
]) {
  for (const model of [
    "gpt-5",
    "gpt-5.4",
    "gpt-6-luna",
    "gpt-6-astra",
    "gpt-6.1-sol",
    "o3-mini",
  ]) {
    test(`${mode}: ${model} omits temperature and uses Chat completion token limit`, async () => {
      await run(mode, model);
      const { path, body } = requests[0];
      assert.equal(path, "/chat/completions");
      assert.equal(body.max_completion_tokens, 256);
      assert.ok(!Object.hasOwn(body, "temperature"));
      assert.ok(!Object.hasOwn(body, "max_tokens"));
      assert.equal(body.reasoning_effort, undefined); // default reasoning is preserved
    });
  }
  test(`${mode}: legacy and unrelated IDs retain their parameters`, async () => {
    for (const model of [
      "gpt-4o",
      "gpt-5-chat-latest",
      "custom-gpt-6-luna",
      "o1custom",
    ]) {
      await run(mode, model);
      assert.equal(requests.at(-1).body.temperature, 0);
      assert.equal(requests.at(-1).body.max_tokens, 256);
    }
  });
  test(`${mode}: Luna with tools uses Responses and preserves schema and signal`, async () => {
    const signal = new AbortController().signal;
    await run(mode, "gpt-6-luna", {}, { tools: true, signal });
    const request = requests[0];
    assert.equal(request.path, "/responses");
    assert.equal(request.signal, signal);
    assert.equal(request.body.max_output_tokens, 256);
    assert.ok(!Object.hasOwn(request.body, "temperature"));
    assert.deepEqual(request.body.tools[0].parameters, schema);
    assert.equal(request.body.tools[0].name, "inspect");
    assert.ok(!request.body.tools.some((t) => t.type === "tool_search"));
  });
  test(`${mode}: explicit none permits sampling and Chat tools`, async () => {
    await run(mode, "gpt-6-luna", { reasoningEffort: "none" }, { tools: true });
    assert.equal(requests[0].path, "/chat/completions");
    assert.equal(requests[0].body.reasoning_effort, "none");
    assert.equal(requests[0].body.temperature, 0);
    assert.equal(requests[0].body.tools[0].function.name, "inspect");
  });
  test(`${mode}: custom endpoints are not automatically switched to Responses`, async () => {
    await run(
      mode,
      "gpt-6-luna",
      {},
      {
        tools: true,
        provider: {
          baseUrl: "https://proxy.example/v1",
          baseURL: "https://proxy.example/v1",
        },
      },
    );
    assert.equal(requests[0].path, "/chat/completions");
  });
  test(`${mode}: compatible servers can explicitly bypass OpenAI model rules`, async () => {
    await run(
      mode,
      "gpt-6-luna",
      {},
      { tools: true, provider: { parameterPolicy: "passthrough" } },
    );
    assert.equal(requests[0].path, "/chat/completions");
    assert.equal(requests[0].body.temperature, 0);
    assert.equal(requests[0].body.max_tokens, 256);
  });
  test(`${mode}: already-aborted requests do not reach the transport`, async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      run(mode, "gpt-6-luna", {}, { tools: true, signal: controller.signal }),
      { name: "AbortError" },
    );
    assert.equal(requests.length, 0);
  });
}

test("request model and effort overrides determine payload, endpoint and warnings", async () => {
  const warnings = [];
  const adapter = new OpenAIAdapter({
    ...options,
    model: "gpt-4o",
    reasoningEffort: "none",
    onWarning: (w) => warnings.push(w),
  });
  await adapter.complete({
    messages: [],
    config: {
      model: "gpt-6-luna",
      reasoningEffort: "high",
      temperature: 0,
      maxTokens: 32,
    },
    toolDefinitions: [definition],
  });
  assert.equal(requests[0].body.model, "gpt-6-luna");
  assert.deepEqual(requests[0].body.reasoning, { effort: "high" });
  assert.equal(requests[0].body.max_output_tokens, 32);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /omitted temperature/);
});

test("unsupported reasoning none fails before sending on both public paths", async () => {
  for (const model of ["gpt-5", "gpt-6-astra", "gpt-6.1-sol", "o3"]) {
    for (const mode of [
      "modern-complete",
      "modern-stream",
      "runtime-complete",
    ]) {
      await assert.rejects(
        run(mode, model, { reasoningEffort: "none" }),
        /does not support/,
      );
    }
    const events = await run(
      "runtime-stream",
      model,
      { reasoningEffort: "none" },
      { expectError: true },
    );
    assert.match(
      events.find((e) => e.type === "error").message,
      /does not support/,
    );
  }
  assert.equal(requests.length, 0);
});

test("legacy factory and core helpers forward effort", async () => {
  await createOpenAI({ ...options, reasoningEffort: "none" })
    .languageModel("gpt-6-luna")
    .complete({ messages: [], config: { temperature: 0 } });
  assert.equal(requests.at(-1).body.reasoning_effort, "none");
  await generateText({
    model: openai("gpt-6-luna", options),
    prompt: "test",
    temperature: 0,
    reasoningEffort: "none",
  });
  assert.equal(requests.at(-1).body.reasoning_effort, "none");
  const result = await streamText({
    model: openai("gpt-6-luna", options),
    prompt: "test",
    temperature: 0,
    reasoningEffort: "none",
  });
  assert.equal(await result.text, "ok");
  assert.equal(requests.at(-1).body.reasoning_effort, "none");
});

test("native tool search stays opt-in and legacy actions retain their schema", async () => {
  const adapter = new OpenAIAdapter({ ...options, model: "gpt-6-luna" });
  await adapter.complete({
    messages: [],
    actions: [
      {
        name: "legacy",
        description: "Legacy",
        parameters: { id: { type: "string", required: true } },
        handler() {},
      },
    ],
  });
  assert.equal(requests[0].path, "/responses");
  assert.ok(requests[0].body.tools[0].parameters.properties.id);
  await adapter.complete({
    messages: [],
    toolDefinitions: [definition],
    providerToolOptions: { openai: { nativeToolSearch: { enabled: true } } },
  });
  assert.ok(requests[1].body.tools.some((t) => t.type === "tool_search"));
});

test("Responses incomplete or interrupted streams never execute buffered calls or report done", async () => {
  for (const terminal of [
    [],
    [
      {
        type: "response.incomplete",
        response: { incomplete_details: { reason: "max_output_tokens" } },
      },
    ],
  ]) {
    reply = () =>
      chunks([
        {
          type: "response.output_item.added",
          output_index: 0,
          item: {
            type: "function_call",
            call_id: "call-1",
            name: "inspect",
            arguments: '{"id":"1"}',
          },
        },
        ...terminal,
      ]);
    const events = await run(
      "runtime-stream",
      "gpt-6-luna",
      {},
      { tools: true, expectError: true },
    );
    assert.ok(events.some((e) => e.type === "error"));
    assert.ok(!events.some((e) => ["action:end", "done"].includes(e.type)));
    await assert.rejects(
      run("modern-stream", "gpt-6-luna", {}, { tools: true }),
      /incomplete|without a completed/,
    );
  }
});

test("Responses complete refuses failed/incomplete status", async () => {
  for (const status of ["failed", "incomplete"]) {
    reply = () => ({
      status,
      output: [],
      error: { code: "invalid_request", message: "provider failure" },
    });
    await assert.rejects(
      run("runtime-complete", "gpt-6-luna", {}, { tools: true }),
      /provider failure/,
    );
  }
});

test("structured provider errors survive the Runtime stream and fallback", async () => {
  const error = Object.assign(new Error("unsupported temperature"), {
    status: 400,
    code: "unsupported_parameter",
    param: "temperature",
    request_id: "req-1",
    privateData: "DO_NOT_SERIALIZE",
  });
  reply = () => {
    throw error;
  };
  const adapter = new OpenAIAdapter({ ...options, model: "gpt-6-luna" });
  const events = await collect(adapter.stream({ messages: [] }));
  const event = events.find((e) => e.type === "error");
  assert.equal(event.status, 400);
  assert.equal(event.providerCode, "unsupported_parameter");
  assert.equal(event.param, "temperature");
  assert.equal(event.requestId, "req-1");
  assert.ok(!JSON.stringify(event).includes("DO_NOT_SERIALIZE"));
  let observed;
  const fallback = {
    provider: "test",
    model: "backup",
    async *stream() {
      yield { type: "message:delta", content: "backup" };
    },
  };
  const chain = createFallbackChain({
    models: [adapter, fallback],
    retries: 2,
    retryDelay: 0,
    fallbackErrors: (e) => {
      observed = e;
      return (
        e.status === 400 &&
        e.code === "unsupported_parameter" &&
        e.param === "temperature"
      );
    },
  });
  const output = await collect(chain.stream({ messages: [] }));
  assert.equal(observed, error);
  assert.equal(output[0].content, "backup");
  assert.equal(requests.length, 2); // one standalone call + one chain call, no repeated invalid request
});

for (const mode of ["modern-stream", "runtime-stream"]) {
  test(`${mode}: interleaved Chat tool calls and trailing usage remain intact`, async () => {
    reply = () =>
      chunks([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "a",
                    function: { name: "first", arguments: "" },
                  },
                  {
                    index: 1,
                    id: "b",
                    function: { name: "second", arguments: "" },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, function: { arguments: '{"x":1}' } },
                  { index: 1, function: { arguments: '{"y":2}' } },
                ],
              },
            },
          ],
        },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        {
          choices: [],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ]);
    const events = await run(
      mode,
      "gpt-6-luna",
      { reasoningEffort: "none" },
      { tools: true },
    );
    if (mode.startsWith("modern")) {
      assert.deepEqual(
        events.filter((e) => e.type === "tool-call").map((e) => e.toolCall),
        [
          { id: "a", name: "first", args: { x: 1 } },
          { id: "b", name: "second", args: { y: 2 } },
        ],
      );
      assert.equal(events.at(-1).usage.totalTokens, 15);
    } else {
      assert.deepEqual(
        events
          .filter((e) => e.type === "action:args")
          .map((e) => [e.id, JSON.parse(e.args)]),
        [
          ["a", { x: 1 }],
          ["b", { y: 2 }],
        ],
      );
      assert.equal(events.at(-1).usage.total_tokens, 15);
    }
    assert.equal(requests[0].body.stream_options.include_usage, true);
  });
}

test("stream readers and result promises share one model execution and one tool execution", async () => {
  let calls = 0,
    executions = 0;
  const model = {
    provider: "openai",
    modelId: "fixture",
    capabilities: {},
    async *doStream() {
      calls++;
      yield { type: "text-delta", text: "hello" };
      yield {
        type: "tool-call",
        toolCall: { id: "one", name: "record", args: {} },
      };
      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    },
  };
  const result = await streamText({
    model,
    prompt: "test",
    tools: {
      record: {
        description: "record",
        parameters: z.object({}),
        execute: async () => {
          executions++;
          return "ok";
        },
      },
    },
  });
  const [parts, textChunks, text, usage, reason] = await Promise.all([
    collect(result.fullStream),
    collect(result.textStream),
    result.text,
    result.usage,
    result.finishReason,
  ]);
  assert.equal(calls, 1);
  assert.equal(executions, 1);
  assert.equal(textChunks.join(""), "hello");
  assert.equal(text, "hello");
  assert.equal(usage.totalTokens, 15);
  assert.equal(reason, "tool-calls");
  assert.equal(parts.filter((p) => p.type === "tool-call-complete").length, 1);
  assert.equal(await result.toTextStreamResponse().text(), "hello");
  assert.equal(calls, 1);
  assert.equal(executions, 1);
});

test("stream getters reject provider errors without rerunning the provider", async () => {
  let calls = 0;
  const result = await streamText({
    model: {
      provider: "test",
      modelId: "fixture",
      capabilities: {},
      async *doStream() {
        calls++;
        throw new Error("provider failed");
      },
    },
    prompt: "test",
  });
  const outcomes = await Promise.allSettled([
    result.text,
    result.usage,
    result.finishReason,
    collect(result.textStream),
  ]);
  assert.ok(
    outcomes.every(
      (x) =>
        x.status === "rejected" && /provider failed/.test(x.reason.message),
    ),
  );
  assert.equal(calls, 1);
});

test("Responses routing preserves selected tool, structured output and user role", async () => {
  const adapter = new OpenAIAdapter({ ...options, model: "gpt-6-luna" });
  await adapter.complete({
    messages: [{ id: "m1", role: "user", content: "inspect this" }],
    toolDefinitions: [definition],
    config: {
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "result", schema, strict: true },
      },
    },
    providerToolOptions: {
      openai: {
        toolChoice: { type: "function", name: "inspect" },
        parallelToolCalls: false,
      },
    },
  });
  assert.equal(requests[0].body.input[0].role, "user");
  assert.deepEqual(requests[0].body.tool_choice, {
    type: "function",
    name: "inspect",
  });
  assert.equal(requests[0].body.parallel_tool_calls, false);
  assert.deepEqual(requests[0].body.text.format.schema, schema);
});

for (const mode of ["modern-stream", "runtime-stream"]) {
  test(`${mode}: Responses interleaves calls safely and emits one terminal result`, async () => {
    reply = () =>
      chunks([
        {
          type: "response.output_item.added",
          output_index: 0,
          item: {
            type: "function_call",
            call_id: "a",
            name: "first",
            arguments: "",
          },
        },
        {
          type: "response.output_item.added",
          output_index: 1,
          item: {
            type: "function_call",
            call_id: "b",
            name: "second",
            arguments: "",
          },
        },
        {
          type: "response.function_call_arguments.delta",
          output_index: 1,
          delta: '{"y":2}',
        },
        {
          type: "response.function_call_arguments.delta",
          output_index: 0,
          delta: '{"x":1}',
        },
        { type: "response.completed", response: { output: [], usage } },
      ]);
    const events = await run(mode, "gpt-6-luna", {}, { tools: true });
    if (mode.startsWith("modern")) {
      assert.deepEqual(
        events.filter((x) => x.type === "tool-call").map((x) => x.toolCall),
        [
          { id: "a", name: "first", args: { x: 1 } },
          { id: "b", name: "second", args: { y: 2 } },
        ],
      );
      assert.equal(events.filter((x) => x.type === "finish").length, 1);
      assert.equal(events.at(-1).usage.totalTokens, 15);
    } else {
      assert.deepEqual(
        events
          .filter((x) => x.type === "action:args")
          .map((x) => JSON.parse(x.args)),
        [{ x: 1 }, { y: 2 }],
      );
      assert.equal(events.filter((x) => x.type === "done").length, 1);
      assert.equal(events.at(-1).usage.total_tokens, 15);
    }
  });
}

test("malformed Responses arguments are not converted into executable empty arguments", async () => {
  reply = () => ({
    status: "completed",
    output: [
      {
        type: "function_call",
        call_id: "a",
        name: "inspect",
        arguments: "{bad",
      },
    ],
    usage,
  });
  await assert.rejects(
    run("runtime-complete", "gpt-6-luna", {}, { tools: true }),
    (error) =>
      error.status === 502 && error.code === "INVALID_PROVIDER_RESPONSE",
  );
  reply = () =>
    chunks([
      {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "function_call",
          call_id: "a",
          name: "inspect",
          arguments: "{bad",
        },
      },
      { type: "response.completed", response: { output: [], usage } },
    ]);
  const events = await run(
    "runtime-stream",
    "gpt-6-luna",
    {},
    { tools: true, expectError: true },
  );
  assert.ok(events.some((x) => x.type === "error"));
  assert.ok(!events.some((x) => x.type === "action:end" || x.type === "done"));
});

test("aborting Responses after a text delta does not report successful completion", async () => {
  const controller = new AbortController();
  reply = () =>
    (async function* () {
      yield { type: "response.output_text.delta", delta: "partial" };
      controller.abort();
      yield { type: "response.completed", response: { output: [], usage } };
    })();
  const events = await run(
    "runtime-stream",
    "gpt-6-luna",
    {},
    { tools: true, signal: controller.signal, expectError: true },
  );
  assert.ok(events.some((x) => x.type === "message:delta"));
  assert.ok(events.some((x) => x.type === "error"));
  assert.ok(!events.some((x) => x.type === "done"));
});
