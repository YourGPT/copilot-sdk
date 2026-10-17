const test = require("node:test");
const assert = require("node:assert/strict");
const { OpenAIAdapter } = require("../dist/adapters/index.js");
const { generateText, createRuntime } = require("../dist/index.js");
const { createFallbackChain } = require("../dist/fallback/index.js");

const endpoints = {
  openai: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
  xai: "https://api.x.ai/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  openrouter: "https://openrouter.ai/api/v1",
};
for (const [provider, baseUrl] of Object.entries(endpoints)) {
  for (const streaming of [false, true]) {
    for (const content of [
      { order: { id: 42 }, success: true },
      [{ type: "text", text: "Order 42 is ready" }],
      [1, { order: 42 }],
    ]) {
      test(`${provider} ${streaming ? "stream" : "complete"}: preserves structured raw tool content ${JSON.stringify(content)}`, async () => {
        const adapter = new OpenAIAdapter({
          apiKey: "fixture",
          model: "fixture-model",
          baseUrl,
          api: "chat",
        });
        const requests = [];
        adapter.client = {
          chat: {
            completions: {
              create: async (body) => {
                requests.push(structuredClone(body));
                return body.stream
                  ? (async function* () {
                      yield {
                        choices: [
                          { delta: { content: "ok" }, finish_reason: "stop" },
                        ],
                      };
                    })()
                  : {
                      choices: [
                        { message: { content: "ok" }, finish_reason: "stop" },
                      ],
                    };
              },
            },
          },
        };
        const messages = [
          {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call1",
                type: "function",
                function: { name: "lookup", arguments: "{}" },
              },
            ],
          },
          { role: "tool", tool_call_id: "call1", content },
        ];
        const before = structuredClone(messages);
        // Exercise the proxy's real runtime path, which receives raw customer messages.
        const result = await createRuntime({ adapter }).chat({
          messages,
          streaming,
        });
        assert.equal(result.text, "ok");
        assert.deepEqual(
          requests[0].messages.find((m) => m.role === "tool").content,
          content,
        );
        assert.deepEqual(messages, before);
      });
    }
  }
}
test("generateText accepts a model that omits optional toolCalls", async () => {
  const result = await generateText({
    model: {
      modelId: "fixture",
      provider: "custom",
      capabilities: {},
      doGenerate: async () => ({
        text: "ok",
        finishReason: "stop",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    },
    prompt: "hello",
  });
  assert.equal(result.text, "ok");
  assert.deepEqual(result.toolCalls, []);
  assert.deepEqual(result.steps[0].toolCalls, []);
  assert.equal(result.response.messages.at(-1).content, "ok");
});
for (const streaming of [false, true]) {
  for (const bad of [
    { arguments: "{" },
    { arguments: "[]" },
    { name: "" },
    { call_id: "" },
    { status: "incomplete" },
  ]) {
    test(`malformed Responses ${streaming ? "stream" : "complete"} falls back without emitting tools: ${JSON.stringify(bad)}`, async () => {
      const adapter = new OpenAIAdapter({
        apiKey: "fixture",
        model: "gpt-6-luna",
        api: "responses",
      });
      const output = [
        {
          type: "function_call",
          id: "fc1",
          call_id: "call1",
          name: "dangerous",
          arguments: "{}",
          status: "completed",
          ...bad,
        },
      ];
      adapter.client = {
        responses: {
          create: async (body) =>
            body.stream
              ? (async function* () {
                  yield {
                    type: "response.completed",
                    response: { status: "completed", output },
                  };
                })()
              : { status: "completed", output },
        },
      };
      let fallback = 0;
      const second = {
        provider: "fixture",
        model: "good",
        complete: async () => ({ content: "recovered", toolCalls: [] }),
        stream: async function* () {
          yield { type: "message:delta", content: "recovered" };
          yield { type: "done" };
        },
      };
      const chain = createFallbackChain({
        models: [adapter, second],
        onFallback: ({ error }) => {
          fallback++;
          assert.equal(error.status, 502);
          assert.equal(error.code, "INVALID_PROVIDER_RESPONSE");
        },
      });
      if (streaming) {
        const chunks = [];
        for await (const chunk of chain.stream({
          messages: [{ role: "user", content: "test" }],
        }))
          chunks.push(chunk);
        assert.equal(
          chunks.filter((e) => e.type.startsWith("action:")).length,
          0,
        );
        assert.equal(
          chunks.find((e) => e.type === "message:delta").content,
          "recovered",
        );
      } else
        assert.equal(
          (
            await chain.complete({
              messages: [{ role: "user", content: "test" }],
            })
          ).content,
          "recovered",
        );
      assert.equal(fallback, 1);
    });
  }
}
