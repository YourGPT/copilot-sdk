const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRuntime } = require("../dist/index.js");
const {
  AnthropicAdapter,
  formatMessagesForAnthropic,
} = require("../dist/adapters/index.js");

const instruction = "Classify this email. Never answer it.";
const user = { role: "user", content: "Can you help with my invoice?" };

function harness(reply = () => [{ type: "text", text: "classified" }]) {
  const requests = [];
  const adapter = new AnthropicAdapter({ apiKey: "fixture" });
  const respond = (body) => {
    requests.push(structuredClone(body));
    return {
      id: "msg_fixture",
      role: "assistant",
      type: "message",
      model: "claude-sonnet-4-5",
      content: reply(requests.length),
      usage: { input_tokens: 10, output_tokens: 2 },
    };
  };
  // Replace only transport: exercise the actual adapter's outgoing payload.
  adapter.client = {
    messages: {
      create: async (body) => respond(body),
      stream: async function* (body) {
        const response = respond(body);
        yield {
          type: "message_start",
          message: { ...response, content: [] },
        };
        for (const [index, block] of response.content.entries()) {
          yield {
            type: "content_block_start",
            index,
            content_block:
              block.type === "tool_use" ? { ...block, input: {} } : block,
          };
          yield {
            type: "content_block_delta",
            index,
            delta:
              block.type === "tool_use"
                ? {
                    type: "input_json_delta",
                    partial_json: JSON.stringify(block.input),
                  }
                : { type: "text_delta", text: block.text },
          };
          yield { type: "content_block_stop", index };
        }
        yield { type: "message_delta", usage: { output_tokens: 2 } };
        yield { type: "message_stop" };
      },
    },
  };
  return { adapter, requests };
}

const cases = [
  {
    name: "system role only",
    request: { messages: [{ role: "system", content: instruction }, user] },
    expected: instruction,
  },
  {
    name: "multiple system messages keep their order",
    request: {
      messages: [
        { role: "system", content: instruction },
        { role: "system", content: "Return a decision only." },
        user,
      ],
    },
    expected: instruction + "\nReturn a decision only.",
  },
  {
    name: "request prompt precedes message instructions and overrides runtime default",
    config: { systemPrompt: "Default instructions" },
    request: {
      systemPrompt: instruction,
      messages: [{ role: "system", content: "Return JSON." }, user],
    },
    expected: instruction + "\nReturn JSON.",
  },
  {
    name: "runtime default precedes message instructions",
    config: { systemPrompt: instruction },
    request: { messages: [{ role: "system", content: "Return JSON." }, user] },
    expected: instruction + "\nReturn JSON.",
  },
  {
    name: "existing explicit prompt remains unchanged",
    request: { systemPrompt: instruction, messages: [user] },
    expected: instruction,
  },
  {
    name: "no system instruction remains empty",
    request: { messages: [user] },
    expected: "",
  },
  {
    name: "duplicate explicit prompt is not repeated",
    request: {
      systemPrompt: instruction,
      messages: [{ role: "system", content: instruction }, user],
    },
    expected: instruction,
  },
  {
    name: "mixed system blocks keep valid text and ignore unsupported content",
    request: {
      messages: [
        {
          role: "system",
          content: [
            null,
            { type: "text", text: instruction },
            { type: "image", data: "fixture" },
          ],
        },
        { role: "system", content: null },
        user,
      ],
    },
    expected: instruction,
  },
];

for (const method of ["chat", "generate", "stream", "processChat"]) {
  for (const scenario of cases) {
    test(`Anthropic Runtime ${method}: ${scenario.name}`, async () => {
      const { adapter, requests } = harness();
      const runtime = createRuntime({ adapter, ...scenario.config });
      const request = structuredClone(scenario.request);
      if (method === "stream") await runtime.stream(request).collect();
      else if (method === "processChat") {
        for await (const event of runtime.processChat(request)) {
          assert.notEqual(event.type, "error");
        }
      } else await runtime[method](request);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].system, scenario.expected);
      assert.deepEqual(requests[0].messages, [user]);
      assert.deepEqual(
        request,
        scenario.request,
        "caller messages must not be mutated",
      );
    });
  }
}

for (const method of ["complete", "stream"]) {
  for (const raw of [false, true]) {
    test(`Anthropic adapter ${method}: ${raw ? "raw" : "typed"} system instruction and JSON suffix`, async () => {
      const { adapter, requests } = harness();
      const messages = [{ role: "system", content: instruction }, user];
      const request = {
        messages: raw ? [] : messages,
        ...(raw ? { rawMessages: messages } : {}),
        config: { responseFormat: { type: "json_object" } },
      };
      if (method === "stream") {
        for await (const event of adapter.stream(request))
          assert.notEqual(event.type, "error");
      } else await adapter.complete(request);
      assert.equal(
        requests[0].system,
        instruction +
          "\n\nRespond with a single JSON object and no other text.",
      );
      assert.deepEqual(requests[0].messages, [user]);
    });
  }
}

test("Anthropic exported formatter preserves system instructions", () => {
  const result = formatMessagesForAnthropic(
    [{ role: "system", content: instruction }, user],
    "Runtime instructions",
  );
  assert.equal(result.system, "Runtime instructions\n" + instruction);
  assert.deepEqual(result.messages, [user]);
});

test("Anthropic raw text blocks are extracted from the active message list only", async () => {
  const { adapter, requests } = harness();
  await adapter.complete({
    messages: [{ role: "system", content: "Inactive history" }],
    rawMessages: [
      {
        role: "system",
        content: [
          { type: "text", text: instruction },
          { type: "text", text: "Return JSON." },
        ],
      },
      user,
    ],
  });
  assert.equal(requests[0].system, instruction + "\nReturn JSON.");
  assert.deepEqual(requests[0].messages, [user]);
});

test("Anthropic empty rawMessages falls back to typed messages", async () => {
  const { adapter, requests } = harness();
  await adapter.complete({
    messages: [{ role: "system", content: instruction }, user],
    rawMessages: [],
  });
  assert.equal(requests[0].system, instruction);
});

for (const content of [
  null,
  undefined,
  42,
  { unexpected: true },
  [{ type: "image", data: "fixture" }],
  [null, { type: "text", text: 42 }],
]) {
  test(`Anthropic ignores unsupported system content ${JSON.stringify(content)}`, async () => {
    const { adapter, requests } = harness();
    await adapter.complete({
      messages: [],
      rawMessages: [{ role: "system", content }, user],
    });
    assert.equal(requests[0].system, "");
    assert.deepEqual(requests[0].messages, [user]);
  });
}

for (const method of ["chat", "generate"]) {
  test(`Anthropic Runtime ${method}: instructions survive tool continuation exactly once`, async () => {
    let executions = 0;
    const { adapter, requests } = harness((turn) =>
      turn === 1
        ? [{ type: "tool_use", id: "call_lookup", name: "lookup", input: {} }]
        : [{ type: "text", text: "classified" }],
    );
    const runtime = createRuntime({
      adapter,
      systemPrompt: instruction,
      tools: [
        {
          name: "lookup",
          description: "Read a fixture",
          location: "server",
          handler: async () => {
            executions++;
            return { found: true };
          },
        },
      ],
    });
    await runtime[method]({
      messages: [{ role: "system", content: "Return JSON." }, user],
    });
    assert.equal(executions, 1);
    assert.equal(requests.length, 2);
    for (const body of requests) {
      assert.equal(body.system, instruction + "\nReturn JSON.");
      assert.ok(body.messages.every((message) => message.role !== "system"));
    }
    assert.equal(requests[1].messages[1].content[0].type, "tool_use");
    assert.equal(requests[1].messages[2].content[0].type, "tool_result");
  });
}
