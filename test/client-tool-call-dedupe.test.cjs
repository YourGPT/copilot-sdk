const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

// Build the real ChatWithTools from source, as pr-compatibility.test.cjs does: the dedupe lives in
// its toolCalls handler, which every emit path (JSON response, streamed tool_calls, last-message
// fallback) goes through.
const root = path.resolve(__dirname, "..");
const esbuild = require(
  require.resolve("esbuild", {
    paths: [
      fs.realpathSync(
        path.join(__dirname, "../packages/llm-sdk/node_modules/tsup"),
      ),
    ],
  }),
);
const outfile = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "copilot-dedupe-tests-")),
  "chat.cjs",
);
esbuild.buildSync({
  stdin: {
    contents: `export { ChatWithTools } from './packages/copilot-sdk/src/chat/ChatWithTools';`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile,
  logLevel: "silent",
});
const { ChatWithTools } = require(outfile);

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

function setup() {
  const requests = [];
  const executed = [];
  const chat = new ChatWithTools({
    runtimeUrl: "https://fixture.invalid",
    transport: {
      abort() {},
      isStreaming: () => false,
      async send(request) {
        requests.push(request);
        return { messages: [{ role: "assistant", content: "Here they are." }] };
      },
    },
    initialMessages: [
      {
        id: "a",
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "toolu_1",
            type: "function",
            function: {
              name: "load_skill",
              arguments: '{"name":"conversations"}',
            },
          },
        ],
      },
    ],
    tools: [
      {
        name: "load_skill",
        description: "Load a skill",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
        },
        location: "client",
        handler: async (args) => {
          executed.push(args);
          return { success: true, data: { loaded: args.name } };
        },
      },
    ],
  });
  return { chat, requests, executed };
}

test("a tool call listed twice runs once, with the later entry's arguments", async () => {
  const { chat, requests, executed } = setup();
  // What a server on @yourgpt/llm-sdk 2.6.0 sent: the same call twice. The first copy comes
  // from the streamed start event and can carry {}; the later one has the final arguments.
  chat.chat.emit("toolCalls", {
    toolCalls: [
      {
        id: "toolu_1",
        type: "function",
        function: { name: "load_skill", arguments: "{}" },
      },
      {
        id: "toolu_1",
        type: "function",
        function: { name: "load_skill", arguments: '{"name":"conversations"}' },
      },
    ],
  });
  await tick();
  assert.equal(executed.length, 1, "one execution per call id");
  assert.deepEqual(
    executed[0],
    { name: "conversations" },
    "the later arguments win",
  );
  assert.equal(requests.length, 1, "one follow-up request");
  const toolResults = requests[0].messages.filter(
    (m) => m.role === "tool" && (m.tool_call_id ?? m.toolCallId) === "toolu_1",
  );
  assert.equal(toolResults.length, 1, "one result for the call id");
  chat.dispose();
});

test("distinct tool call ids still all run", async () => {
  const { chat, executed } = setup();
  chat.chat.emit("toolCalls", {
    toolCalls: [
      {
        id: "toolu_1",
        type: "function",
        function: { name: "load_skill", arguments: '{"name":"a"}' },
      },
      {
        id: "toolu_2",
        type: "function",
        function: { name: "load_skill", arguments: '{"name":"b"}' },
      },
    ],
  });
  await tick();
  assert.deepEqual(executed.map((args) => args.name).sort(), ["a", "b"]);
  chat.dispose();
});

test("a call id repeated in a later event while it is still running is not started again", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const executed = [];
  const chat = new ChatWithTools({
    runtimeUrl: "https://fixture.invalid",
    transport: {
      abort() {},
      isStreaming: () => false,
      async send() {
        return { messages: [{ role: "assistant", content: "done" }] };
      },
    },
    initialMessages: [
      {
        id: "a",
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "toolu_1",
            type: "function",
            function: { name: "load_skill", arguments: "{}" },
          },
        ],
      },
    ],
    tools: [
      {
        name: "load_skill",
        description: "Load a skill",
        inputSchema: { type: "object", properties: {} },
        location: "client",
        handler: async (args) => {
          executed.push(args);
          await gate;
          return { success: true };
        },
      },
    ],
  });
  const call = {
    id: "toolu_1",
    type: "function",
    function: { name: "load_skill", arguments: "{}" },
  };
  chat.chat.emit("toolCalls", { toolCalls: [call] });
  await tick();
  chat.chat.emit("toolCalls", { toolCalls: [call] });
  await tick();
  release();
  await tick();
  assert.equal(
    executed.length,
    1,
    "the in-flight call is not run a second time",
  );
  chat.dispose();
});

test("calls without an id are each kept, not collapsed into one", async () => {
  const { chat, executed } = setup();
  chat.chat.emit("toolCalls", {
    toolCalls: [
      {
        type: "function",
        function: { name: "load_skill", arguments: '{"name":"a"}' },
      },
      {
        type: "function",
        function: { name: "load_skill", arguments: '{"name":"b"}' },
      },
    ],
  });
  await tick();
  assert.deepEqual(executed.map((args) => args.name).sort(), ["a", "b"]);
  chat.dispose();
});

test("a call whose run threw can be delivered again and runs", async () => {
  let failOnce = true;
  const executed = [];
  const chat = new ChatWithTools(
    {
      runtimeUrl: "https://fixture.invalid",
      transport: {
        abort() {},
        isStreaming: () => false,
        async send() {
          return { messages: [{ role: "assistant", content: "done" }] };
        },
      },
      initialMessages: [
        {
          id: "a",
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "toolu_1",
              type: "function",
              function: { name: "load_skill", arguments: "{}" },
            },
          ],
        },
      ],
      tools: [
        {
          name: "load_skill",
          description: "Load a skill",
          inputSchema: { type: "object", properties: {} },
          location: "client",
          handler: async (args) => {
            executed.push(args);
            return { success: true };
          },
        },
      ],
    },
    {
      // Throws during the first run, as a failing approval or start callback would.
      onToolExecutionsChange: () => {
        if (failOnce) {
          failOnce = false;
          throw new Error("callback failed");
        }
      },
    },
  );
  const originalError = console.error;
  console.error = () => {};
  try {
    const call = {
      id: "toolu_1",
      type: "function",
      function: { name: "load_skill", arguments: "{}" },
    };
    chat.chat.emit("toolCalls", { toolCalls: [call] });
    await tick();
    chat.chat.emit("toolCalls", { toolCalls: [call] });
    await tick();
  } finally {
    console.error = originalError;
  }
  assert.equal(
    executed.length,
    1,
    "the re-delivered call ran instead of being skipped as still running",
  );
  chat.dispose();
});

test("after a run throws, stop() still closes the call with a cancelled result", async () => {
  let fail = true;
  const chat = new ChatWithTools(
    {
      runtimeUrl: "https://fixture.invalid",
      transport: {
        abort() {},
        isStreaming: () => false,
        async send() {
          return { messages: [{ role: "assistant", content: "done" }] };
        },
      },
      initialMessages: [
        {
          id: "a",
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "toolu_1",
              type: "function",
              function: { name: "load_skill", arguments: "{}" },
            },
          ],
        },
      ],
      tools: [
        {
          name: "load_skill",
          description: "Load a skill",
          inputSchema: { type: "object", properties: {} },
          location: "client",
          handler: async () => ({ success: true }),
        },
      ],
    },
    {
      onToolExecutionsChange: () => {
        if (fail) {
          fail = false;
          throw new Error("callback failed");
        }
      },
    },
  );
  const originalError = console.error;
  console.error = () => {};
  try {
    chat.chat.emit("toolCalls", {
      toolCalls: [
        {
          id: "toolu_1",
          type: "function",
          function: { name: "load_skill", arguments: "{}" },
        },
      ],
    });
    await tick();
  } finally {
    console.error = originalError;
  }
  chat.stop();
  await tick();
  assert.ok(
    chat.messages.some((m) => m.role === "tool" && m.toolCallId === "toolu_1"),
    "the open tool call is closed, so the next request has a result for it",
  );
  chat.dispose();
});

test("a reply that reuses the call id of the call just answered runs its call", async () => {
  const executed = [];
  let sends = 0;
  const chat = new ChatWithTools({
    runtimeUrl: "https://fixture.invalid",
    transport: {
      abort() {},
      isStreaming: () => false,
      async send() {
        // Reply to the first result: the server calls the tool again and reuses the id.
        if (++sends === 1)
          return {
            messages: [
              {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "call_0",
                    type: "function",
                    function: { name: "load_skill", arguments: '{"name":"b"}' },
                  },
                ],
              },
            ],
            toolCalls: [
              { id: "call_0", name: "load_skill", args: { name: "b" } },
            ],
            requiresAction: true,
          };
        return { messages: [{ role: "assistant", content: "done" }] };
      },
    },
    initialMessages: [
      {
        id: "a",
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_0",
            type: "function",
            function: { name: "load_skill", arguments: '{"name":"a"}' },
          },
        ],
      },
    ],
    tools: [
      {
        name: "load_skill",
        description: "Load a skill",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
        },
        location: "client",
        handler: async (args) => {
          executed.push(args.name);
          return { success: true };
        },
      },
    ],
  });
  chat.chat.emit("toolCalls", {
    toolCalls: [
      {
        id: "call_0",
        type: "function",
        function: { name: "load_skill", arguments: '{"name":"a"}' },
      },
    ],
  });
  await tick();
  await tick();
  assert.deepEqual(
    executed,
    ["a", "b"],
    "the second call_0 is a new call and runs",
  );
  assert.equal(sends, 2);
  chat.dispose();
});
