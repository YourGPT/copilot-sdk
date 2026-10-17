const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { z } = require("zod");
const { openai, createOpenAI } = require("../dist/providers/openai/index.js");
const { OpenAIAdapter } = require("../dist/adapters/index.js");
const {
  generateText,
  streamText,
  createRuntime,
  mapOutputMessages,
} = require("../dist/index.js");
let requests, reply;
const original = new Map();
before(async () => {
  for (const Client of new Set([
    require("openai").default,
    (await import("openai")).default,
  ])) {
    original.set(Client, Client.prototype.post);
    Client.prototype.post = function (path, options) {
      requests.push({ path, ...options });
      const p = Promise.resolve().then(() => reply(path, options));
      p._thenUnwrap = (fn) => p.then(fn);
      return p;
    };
  }
});
after(() => {
  for (const [Client, post] of original) Client.prototype.post = post;
});
const usage = {
  input_tokens: 12,
  output_tokens: 7,
  total_tokens: 19,
  input_tokens_details: { cached_tokens: 4 },
  output_tokens_details: { reasoning_tokens: 3 },
};
const reasoning = {
  type: "reasoning",
  id: "rs_1",
  summary: [{ type: "summary_text", text: "Summary" }],
  encrypted_content: "opaque-complete-state",
};
const replayReasoning = { ...reasoning, summary: [] };
const message = (text) => ({
  type: "message",
  id: "msg_1",
  role: "assistant",
  status: "completed",
  content: [{ type: "output_text", text, annotations: [] }],
});
const call = (id = "call_1") => ({
  type: "function_call",
  id: "fc_" + id,
  call_id: id,
  name: "inspect",
  arguments: '{"id":"check"}',
  status: "completed",
});
const response = (output = [reasoning, message("ok")]) => ({
  id: "resp_1",
  model: "gpt-6-luna",
  status: "completed",
  store: false,
  output,
  usage,
});
async function* events(result, omitTerminalOutput = false) {
  yield {
    type: "response.created",
    response: { id: result.id, model: result.model },
  };
  for (const [index, item] of result.output.entries()) {
    yield {
      type: "response.output_item.added",
      output_index: index,
      item: {
        ...item,
        ...(item.type === "reasoning"
          ? { encrypted_content: "partial-do-not-replay" }
          : {}),
        ...(item.type === "function_call" ? { arguments: "" } : {}),
      },
    };
    if (item.type === "function_call") {
      yield {
        type: "response.function_call_arguments.delta",
        output_index: index,
        delta: item.arguments.slice(0, 6),
      };
      yield {
        type: "response.function_call_arguments.delta",
        output_index: index,
        delta: item.arguments.slice(6),
      };
    }
    if (item.type === "message")
      for (const part of item.content)
        if (part.type === "output_text")
          yield {
            type: "response.output_text.delta",
            output_index: index,
            delta: part.text,
          };
    yield { type: "response.output_item.done", output_index: index, item };
  }
  yield {
    type: "response.completed",
    response: { ...result, ...(omitTerminalOutput ? { output: [] } : {}) },
  };
}
beforeEach(() => {
  requests = [];
  reply = (path, { body }) => {
    if (path === "/responses")
      return body.stream ? events(response()) : response();
    return body.stream
      ? (async function* () {
          yield {
            choices: [{ delta: { content: "chat" }, finish_reason: "stop" }],
          };
        })()
      : { choices: [{ message: { content: "chat" }, finish_reason: "stop" }] };
  };
});
const modes = [
  "modern-complete",
  "modern-stream",
  "adapter-complete",
  "adapter-stream",
];
async function run(
  mode,
  transport = {},
  messages = [{ role: "user", content: "hello" }],
  settings = {},
) {
  if (mode.startsWith("modern")) {
    const model = openai("gpt-4o", { apiKey: "fixture", ...settings });
    const params = { messages, openai: transport };
    if (mode.endsWith("complete")) return model.doGenerate(params);
    const chunks = [];
    for await (const chunk of model.doStream(params)) chunks.push(chunk);
    return chunks;
  }
  const adapter = new OpenAIAdapter({
    apiKey: "fixture",
    model: "gpt-4o",
    ...settings,
  });
  const request = {
    messages: [],
    rawMessages: messages,
    config: { openai: transport },
  };
  if (mode.endsWith("complete")) return adapter.complete(request);
  const chunks = [];
  for await (const chunk of adapter.stream(request)) chunks.push(chunk);
  const error = chunks.find((chunk) => chunk.type === "error");
  if (error) throw new Error(error.message);
  return chunks;
}
const metadataOf = (result) =>
  Array.isArray(result)
    ? result.find((item) => ["done", "finish"].includes(item.type))
        .providerMetadata
    : result.providerMetadata;

test("native replay retains tool schemas with diagnostic-like property names", async () => {
  const item = {
    type: "tool_search_output",
    id: "search1",
    call_id: "searchcall1",
    tools: [
      {
        type: "function",
        name: "inspect",
        parameters: {
          type: "object",
          properties: {
            usage: { type: "string" },
            metadata: { type: "object" },
            logprobs: { type: "number" },
          },
        },
      },
    ],
  };
  reply = (_, { body }) =>
    body.stream
      ? events(response([item, message("ok")]))
      : response([item, message("ok")]);
  const runtime = createRuntime({
    provider: createOpenAI({ apiKey: "fixture", api: "responses" }),
    model: "gpt-6-luna",
  });
  const result = await runtime.chat({
    messages: [{ role: "user", content: "hello" }],
    streaming: false,
  });
  assert.deepEqual(
    result.messages[0].providerMetadata.openai.response.output[0],
    item,
  );
});

for (const streaming of [false, true]) {
  test(`Runtime ${streaming ? "stream" : "JSON"}: replay excludes raw provider diagnostics and nested usage`, async () => {
    const diagnosticOutput = [
      { ...reasoning, private_extension: "PRIVATE_DIAGNOSTIC" },
      {
        ...message("safe answer"),
        private_extension: "PRIVATE_DIAGNOSTIC",
        content: [
          {
            type: "output_text",
            text: "safe answer",
            logprobs: [{ token: "PRIVATE_DIAGNOSTIC" }],
            annotations: [{ type: "private", text: "PRIVATE_DIAGNOSTIC" }],
          },
        ],
      },
    ];
    reply = (_, { body }) =>
      body.stream
        ? events(response(diagnosticOutput))
        : response(diagnosticOutput);
    const runtime = createRuntime({
      provider: createOpenAI({
        apiKey: "fixture",
        api: "responses",
        responses: { store: false },
      }),
      model: "gpt-6-luna",
    });
    const result = await runtime.chat({
      messages: [{ role: "user", content: "hello" }],
      streaming,
    });
    assert.equal(result.text, "safe answer");
    assert.equal(
      result.usage.total_tokens,
      19,
      "billing usage remains on the server result",
    );
    const { usage: billing, events: eventList, ...clientResult } = result;
    const serialized = JSON.stringify(clientResult);
    assert.ok(!serialized.includes('"usage"'));
    assert.ok(!serialized.includes("PRIVATE_DIAGNOSTIC"));
    assert.ok(!serialized.includes('"logprobs"'));
    assert.ok(!serialized.includes("Summary"));
    assert.ok(
      serialized.includes("opaque-complete-state"),
      "encrypted replay must survive",
    );
    for (const event of eventList) {
      if (event.providerMetadata) {
        assert.ok(!JSON.stringify(event.providerMetadata).includes('"usage"'));
        assert.ok(
          !JSON.stringify(event.providerMetadata).includes(
            "PRIVATE_DIAGNOSTIC",
          ),
        );
      }
    }
    const replay = result.messages[0].providerMetadata.openai.response;
    assert.deepEqual(Object.keys(replay), ["output", "refusals"]);
    assert.deepEqual(replay.output[0], replayReasoning);
    const clientSSE = await runtime
      .stream({ messages: [{ role: "user", content: "hello" }], streaming })
      .toResponse()
      .text();
    assert.ok(!clientSSE.includes('"usage"'));
    assert.ok(!clientSSE.includes("PRIVATE_DIAGNOSTIC"));
    assert.ok(clientSSE.includes("opaque-complete-state"));
    const serverSSE = await runtime
      .stream({ messages: [{ role: "user", content: "hello" }], streaming })
      .toResponse({ includeUsage: true })
      .text();
    assert.ok(
      serverSSE.includes('"usage"'),
      "explicit raw usage remains supported",
    );
  });
}
for (const mode of modes) {
  test(`${mode}: explicit Responses without tools and lossless output metadata`, async () => {
    const result = await run(mode, {
      api: "responses",
      responses: {
        store: false,
        reasoningSummary: "auto",
        previousResponseId: "resp_previous",
        promptCacheKey: "tenant-test",
        promptCacheRetention: "24h",
        include: ["message.output_text.logprobs"],
      },
    });
    assert.equal(requests[0].path, "/responses");
    assert.equal(requests[0].body.store, false);
    assert.equal(requests[0].body.previous_response_id, "resp_previous");
    assert.equal(requests[0].body.reasoning.summary, "auto");
    assert.equal(requests[0].body.prompt_cache_key, "tenant-test");
    assert.equal(requests[0].body.prompt_cache_retention, "24h");
    assert.deepEqual(requests[0].body.include, [
      "message.output_text.logprobs",
      "reasoning.encrypted_content",
    ]);
    assert.deepEqual(
      metadataOf(result).openai.response.output,
      response().output,
    );
    assert.deepEqual(metadataOf(result).openai.response.usage, usage);
    assert.equal(metadataOf(result).openai.response.id, "resp_1");
  });
  test(`${mode}: default routing and storage remain unchanged`, async () => {
    await run(mode);
    assert.equal(requests[0].path, "/chat/completions");
    await run(mode, { api: "responses" });
    assert.equal(Object.hasOwn(requests[1].body, "store"), false);
  });
  test(`${mode}: explicit Chat never leaks provider metadata`, async () => {
    const messages = [
      {
        role: "assistant",
        content: "prior",
        providerMetadata: {
          openai: { response: { output: [reasoning, message("prior")] } },
        },
      },
      { role: "user", content: "next" },
    ];
    await run(mode, { api: "chat" }, messages);
    assert.equal(requests[0].path, "/chat/completions");
    assert.equal(
      Object.hasOwn(requests[0].body.messages[0], "providerMetadata"),
      false,
    );
  });
  test(`${mode}: replay selects Responses and does not duplicate assistant/tool items`, async () => {
    const output = [reasoning, call(), message("working")];
    const messages = [
      {
        role: "assistant",
        content: "working",
        toolCalls: [{ id: "call_1", name: "inspect", args: { id: "check" } }],
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "inspect", arguments: '{"id":"check"}' },
          },
        ],
        providerMetadata: { openai: { response: { output } } },
      },
      {
        role: "tool",
        toolCallId: "call_1",
        tool_call_id: "call_1",
        content: "done",
      },
    ];
    await run(mode, {}, messages);
    assert.equal(requests[0].path, "/responses");
    assert.deepEqual(
      requests[0].body.input.slice(0, output.length),
      output.map((item) =>
        item.type === "reasoning" ? { ...item, summary: [] } : item,
      ),
    );
    assert.deepEqual(requests[0].body.input[output.length], {
      type: "function_call_output",
      call_id: "call_1",
      output: "done",
    });
    assert.equal(requests[0].body.input.length, 4);
  });
  test(`${mode}: conflicting Chat/Responses options fail before transport`, async () => {
    await assert.rejects(
      run(mode, { api: "chat", responses: { store: false } }),
      /require the Responses API/,
    );
    assert.equal(requests.length, 0);
  });
}
for (const streaming of [false, true]) {
  test(`modern ${streaming ? "stream" : "generate"}: full tool loop replays encrypted state once`, async () => {
    let executed = 0;
    reply = (path, { body }) => {
      assert.equal(path, "/responses");
      const second = body.input.some(
        (item) => item.type === "function_call_output",
      );
      if (second) {
        assert.deepEqual(body.input.slice(1, 3), [replayReasoning, call()]);
        assert.equal(
          body.input.filter((item) => item.type === "function_call").length,
          1,
        );
      }
      const result = response(second ? [message("done")] : [reasoning, call()]);
      return body.stream ? events(result, true) : result;
    };
    const params = {
      model: openai("gpt-6-luna", {
        apiKey: "fixture",
        api: "responses",
        responses: { store: false },
      }),
      prompt: "inspect",
      maxSteps: 3,
      tools: {
        inspect: {
          description: "Inspect",
          parameters: z.object({ id: z.string() }),
          execute: async () => {
            executed++;
            return "result";
          },
        },
      },
    };
    const result = await (streaming
      ? streamText(params)
      : generateText(params));
    const text = await result.text;
    const history = await result.response;
    assert.equal(text, "done");
    assert.equal(executed, 1);
    assert.equal(requests.length, 2);
    assert.equal(history.messages.at(-1).content, "done");
    assert.deepEqual(
      history.messages[1].providerMetadata.openai.response.output,
      [replayReasoning, call()],
    );
    if (streaming) {
      const parts = [];
      for await (const part of result.fullStream) parts.push(part);
      assert.equal(parts.filter((part) => part.type === "finish").length, 1);
      assert.equal(
        parts.filter((part) => part.type === "tool-call-complete").length,
        1,
      );
      await result.providerMetadata;
      assert.equal(requests.length, 2);
    }
  });
  test(`Runtime ${streaming ? "stream" : "JSON"}: preserves replay in server loop and output storage`, async () => {
    let executions = 0;
    reply = (path, { body }) => {
      assert.equal(path, "/responses");
      const second = requests.length === 2;
      if (second) {
        assert.deepEqual(body.input.slice(1, 3), [replayReasoning, call()]);
        assert.equal(body.input[3].type, "function_call_output");
      }
      const result = response(second ? [message("done")] : [reasoning, call()]);
      return body.stream ? events(result) : result;
    };
    const runtime = createRuntime({
      provider: createOpenAI({
        apiKey: "fixture",
        api: "responses",
        responses: { store: false },
      }),
      model: "gpt-4o",
      tools: [
        {
          name: "inspect",
          description: "inspect",
          location: "server",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
          },
          handler: async () => {
            executions++;
            return { success: true, data: "done" };
          },
        },
      ],
    });
    const result = await runtime.chat({
      messages: [{ role: "user", content: "inspect" }],
      streaming,
    });
    assert.equal(result.text, "done");
    assert.equal(executions, 1);
    assert.deepEqual(
      result.messages[0].providerMetadata.openai.response.output,
      [replayReasoning, call()],
    );
    assert.deepEqual(
      mapOutputMessages(result.messages)[0].metadata.providerMetadata,
      result.messages[0].providerMetadata,
    );
  });
  test(`Responses ${streaming ? "stream" : "complete"}: refusal is retained without invented text`, async () => {
    const output = [
      {
        ...message(""),
        content: [{ type: "refusal", refusal: "Cannot comply" }],
      },
    ];
    reply = (_, { body }) =>
      body.stream ? events(response(output)) : response(output);
    const result = await run(streaming ? "modern-stream" : "modern-complete", {
      api: "responses",
    });
    assert.deepEqual(metadataOf(result).openai.response.refusals, [
      "Cannot comply",
    ]);
    assert.equal(
      Array.isArray(result) ? result.at(-1).finishReason : result.finishReason,
      "content-filter",
    );
  });
}
test("modern Responses preserves URL images and file inputs", async () => {
  await run("modern-complete", { api: "responses" }, [
    {
      role: "user",
      content: [
        { type: "image", image: "https://example.com/image.png" },
        {
          type: "file",
          data: "https://example.com/file.pdf",
          mimeType: "application/pdf",
        },
        {
          type: "file",
          data: "ZmlsZQ==",
          mimeType: "application/pdf",
          filename: "example.pdf",
        },
      ],
    },
  ]);
  assert.deepEqual(requests[0].body.input[0].content, [
    {
      type: "input_image",
      image_url: "https://example.com/image.png",
      detail: "auto",
    },
    { type: "input_file", file_url: "https://example.com/file.pdf" },
    {
      type: "input_file",
      filename: "example.pdf",
      file_data: "data:application/pdf;base64,ZmlsZQ==",
    },
  ]);
});
test("request overrides provider transport defaults", async () => {
  await run("modern-complete", { responses: { store: false } }, undefined, {
    api: "responses",
    responses: { store: true, promptCacheKey: "default" },
  });
  assert.equal(requests[0].body.store, false);
  assert.equal(requests[0].body.prompt_cache_key, "default");
});
test("incomplete Responses never execute buffered tool calls or expose successful replay", async () => {
  let executed = 0;
  reply = () =>
    (async function* () {
      yield {
        type: "response.output_item.added",
        output_index: 0,
        item: call(),
      };
      yield {
        type: "response.output_item.done",
        output_index: 0,
        item: call(),
      };
      yield {
        type: "response.incomplete",
        response: { incomplete_details: { reason: "max_output_tokens" } },
      };
    })();
  const result = await streamText({
    model: openai("gpt-4o", { apiKey: "fixture", api: "responses" }),
    prompt: "inspect",
    tools: {
      inspect: {
        description: "inspect",
        parameters: z.object({ id: z.string() }),
        execute: async () => {
          executed++;
        },
      },
    },
  });
  await assert.rejects(result.response, /incomplete/);
  await assert.rejects(result.providerMetadata, /incomplete/);
  assert.equal(executed, 0);
});

test("automatic replay does not move a custom endpoint to Responses", async () => {
  await run(
    "modern-complete",
    {},
    [
      {
        role: "assistant",
        content: "prior",
        providerMetadata: {
          openai: { response: { output: [message("prior")] } },
        },
      },
    ],
    { baseURL: "https://custom.example/v1" },
  );
  assert.equal(requests[0].path, "/chat/completions");
});
test("terminal-only Responses tools are executed once and retain authoritative arguments", async () => {
  reply = () =>
    (async function* () {
      yield {
        type: "response.completed",
        response: response([reasoning, call()]),
      };
    })();
  const chunks = await run("modern-stream", { api: "responses" });
  assert.equal(chunks.filter((chunk) => chunk.type === "tool-call").length, 1);
  assert.deepEqual(
    chunks.find((chunk) => chunk.type === "tool-call").toolCall.args,
    { id: "check" },
  );
  assert.deepEqual(metadataOf(chunks).openai.response.output, [
    reasoning,
    call(),
  ]);
});
test("duplicate terminal events reject the stream before buffered tool execution", async () => {
  reply = () =>
    (async function* () {
      yield { type: "response.completed", response: response([call()]) };
      yield { type: "response.completed", response: response([call()]) };
    })();
  await assert.rejects(
    run("modern-stream", { api: "responses" }),
    /after completion/,
  );
});
test("compatible streaming responses with text deltas retain text for later replay", async () => {
  reply = () =>
    (async function* () {
      yield { type: "response.output_text.delta", delta: "hello" };
      yield { type: "response.completed", response: response([]) };
    })();
  const chunks = await run("modern-stream", { api: "responses" });
  assert.equal(
    metadataOf(chunks).openai.response.output[0].content[0].text,
    "hello",
  );
});

test("adapter typed Message input retains Responses replay and additional system instructions", async () => {
  const adapter = new OpenAIAdapter({ apiKey: "fixture", model: "gpt-4o" });
  await adapter.complete({
    systemPrompt: "Global instructions",
    messages: [
      { id: "sys", role: "system", content: "Additional instructions" },
      {
        id: "prior",
        role: "assistant",
        content: "ok",
        providerMetadata: {
          openai: { response: { output: [reasoning, message("ok")] } },
        },
      },
      { id: "new", role: "user", content: "next" },
    ],
  });
  assert.equal(requests[0].path, "/responses");
  assert.equal(requests[0].body.instructions, "Global instructions");
  assert.deepEqual(requests[0].body.input[0], {
    type: "message",
    role: "developer",
    content: "Additional instructions",
  });
  assert.deepEqual(requests[0].body.input.slice(1, 3), [
    replayReasoning,
    message("ok"),
  ]);
});

test("Responses forwards current cache controls and the exact legacy retention value", async () => {
  await run("modern-complete", {
    api: "responses",
    responses: {
      promptCacheOptions: { mode: "implicit", ttl: "30m" },
      promptCacheRetention: "in_memory",
    },
  });
  assert.deepEqual(requests[0].body.prompt_cache_options, {
    mode: "implicit",
    ttl: "30m",
  });
  assert.equal(requests[0].body.prompt_cache_retention, "in_memory");
});

for (const output of [
  [{ ...call(), call_id: undefined }],
  [call(), call()],
  [{ ...call(), arguments: "null" }],
  [{ ...call(), status: "incomplete" }],
]) {
  for (const mode of ["modern-complete", "modern-stream"]) {
    test(`${mode}: invalid completed tool payload is rejected (${JSON.stringify(output)})`, async () => {
      reply = (_, { body }) =>
        body.stream ? events(response(output)) : response(output);
      await assert.rejects(
        run(mode, { api: "responses" }),
        /incomplete|duplicate|JSON object/,
      );
    });
  }
}
