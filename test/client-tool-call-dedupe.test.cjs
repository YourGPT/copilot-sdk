const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { ReactChat } = require("../packages/copilot-sdk/dist/react/index.cjs");

// The JSON a server built on @yourgpt/llm-sdk 2.6.0 returns from runtime.chat() when the model
// calls one client tool: the call is listed twice in `toolCalls` (once from action:start, once
// from the tool_calls event). Captured from a real Copilot request; ids shortened.
const duplicatedReply = {
  text: "",
  messages: [
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "toolu_1",
          type: "function",
          function: { name: "load_skill", arguments: '{"name":"conversations"}' },
        },
      ],
    },
  ],
  toolCalls: [
    { id: "toolu_1", name: "load_skill", args: { name: "conversations" } },
    { id: "toolu_1", name: "load_skill", args: { name: "conversations" } },
  ],
  requiresAction: true,
};

const originalFetch = global.fetch;
after(() => {
  global.fetch = originalFetch;
});

test("a tool call listed twice by the server is dispatched once", async () => {
  global.fetch = async () =>
    new Response(JSON.stringify(duplicatedReply), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const chat = new ReactChat({
    runtimeUrl: "https://copilot.test/api/chat",
    streaming: false,
    threadId: "dedupe-thread",
  });
  chat.setTools([
    {
      name: "load_skill",
      description: "Load a skill",
      location: "client",
      inputSchema: { type: "object", properties: { name: { type: "string" } } },
    },
  ]);
  const pending = [];
  chat.onToolCalls((event) => pending.push(event));
  await chat.sendMessage("List my 3 most recent conversations.");
  assert.equal(pending.length, 1);
  const calls = pending[0].toolCalls;
  assert.equal(calls.length, 1, "one dispatch per tool call id");
  assert.equal(calls[0].id, "toolu_1");
  assert.deepEqual(
    calls[0].args ?? JSON.parse(calls[0].function.arguments),
    { name: "conversations" },
  );
});
