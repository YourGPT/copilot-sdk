// Opt-in real API conformance. Uses synthetic prompts and the process key only.
// RUN_OPENAI_LIVE=1 OPENAI_API_KEY=... node packages/llm-sdk/test/live/responses.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { z } = require("zod");
const {
  openai,
  createOpenAI,
} = require("../../dist/providers/openai/index.js");
const {
  generateText,
  streamText,
  createRuntime,
} = require("../../dist/index.js");
if (process.env.RUN_OPENAI_LIVE !== "1" || !process.env.OPENAI_API_KEY) {
  console.error(
    "Set RUN_OPENAI_LIVE=1 and supply OPENAI_API_KEY privately to run live Responses checks.",
  );
  process.exit(1);
}
const modelId = process.env.OPENAI_TEST_MODEL || "gpt-6-luna";
const key = process.env.OPENAI_API_KEY;
const model = openai(modelId, {
  apiKey: key,
  api: "responses",
  responses: { store: false },
  reasoningEffort: "low",
});
const checks = [];
const observedOutput = [];
function inspectState(metadata, replay = false) {
  const r = metadata.openai.response;
  if (replay) {
    assert.equal(r.usage, undefined);
    assert.equal(r.model, undefined);
    assert.equal(r.status, undefined);
    assert.ok(!JSON.stringify(r).includes('"logprobs"'));
  } else {
    assert.ok(r.id);
    assert.equal(r.status, "completed");
  }
  assert.ok(r.output.length);
  observedOutput.push({
    model: r.model,
    types: r.output.map((item) => item.type),
    encryptedItems: r.output.filter(
      (item) => item.type === "reasoning" && item.encrypted_content,
    ).length,
    reasoningTokens: r.usage?.output_tokens_details?.reasoning_tokens,
  });
}
async function check(name, fn) {
  if (
    process.env.RESPONSES_LIVE_FILTER &&
    !name.includes(process.env.RESPONSES_LIVE_FILTER)
  )
    return;
  try {
    await fn();
    checks.push({ name, passed: true });
    console.log("PASS " + name);
  } catch (error) {
    checks.push({
      name,
      passed: false,
      error: {
        name: error.name,
        status: error.status,
        code: error.code,
        message: String(error.message)
          .replaceAll(key, "[REDACTED]")
          .slice(0, 600),
      },
    });
    console.log("FAIL " + name);
  }
}
async function resultOf(streaming, params) {
  const result = await (streaming ? streamText(params) : generateText(params));
  return {
    text: await result.text,
    response: await result.response,
    metadata: await result.providerMetadata,
  };
}
(async () => {
  for (const streaming of [false, true]) {
    const mode = streaming ? "stream" : "complete";
    await check(`${mode}: stateless text and next-turn replay`, async () => {
      const first = await resultOf(streaming, {
        model,
        prompt:
          "Remember the synthetic test code ORBIT-42. Reply exactly ORBIT-42.",
        maxTokens: 1024,
        signal: AbortSignal.timeout(60000),
      });
      assert.match(first.text, /ORBIT-42/);
      assert.ok(first.metadata.openai.response.id);
      assert.equal(first.metadata.openai.response.status, "completed");
      assert.equal(first.metadata.openai.response.store, false);
      inspectState(first.metadata);
      const next = await resultOf(streaming, {
        model,
        messages: [
          ...first.response.messages,
          {
            role: "user",
            content: "What was the synthetic test code? Return only the code.",
          },
        ],
        maxTokens: 1024,
        signal: AbortSignal.timeout(60000),
      });
      assert.match(next.text, /ORBIT-42/);
    });
    await check(`${mode}: function loop and persisted replay`, async () => {
      let executions = 0;
      const first = await resultOf(streaming, {
        model,
        prompt:
          "Call inspect to retrieve the synthetic code, then return that code exactly.",
        maxTokens: 1024,
        maxSteps: 3,
        signal: AbortSignal.timeout(60000),
        tools: {
          inspect: {
            description:
              "Retrieve the synthetic code. Always call this to obtain it.",
            parameters: z.object({}),
            execute: async () => {
              executions++;
              return { code: "RIVET-73" };
            },
          },
        },
      });
      assert.equal(executions, 1);
      assert.match(first.text, /RIVET-73/);
      const history = JSON.parse(JSON.stringify(first.response.messages));
      for (const message of history)
        if (message.providerMetadata)
          inspectState(message.providerMetadata, true);
      const next = await resultOf(streaming, {
        model,
        messages: [
          ...history,
          {
            role: "user",
            content:
              "Repeat the code you just retrieved. No tools are necessary.",
          },
        ],
        maxTokens: 1024,
        signal: AbortSignal.timeout(60000),
      });
      assert.match(next.text, /RIVET-73/);
    });
    await check(`${mode}: Runtime server tool replay`, async () => {
      let executions = 0;
      const runtime = createRuntime({
        provider: createOpenAI({
          apiKey: key,
          api: "responses",
          responses: { store: false },
          reasoningEffort: "low",
        }),
        model: modelId,
        maxIterations: 3,
        tools: [
          {
            name: "inspect",
            description: "Return the synthetic code. Call this to get it.",
            location: "server",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
              additionalProperties: false,
            },
            handler: async () => {
              executions++;
              return { success: true, data: { code: "COMET-81" } };
            },
          },
        ],
      });
      const result = await runtime.chat(
        {
          messages: [
            {
              role: "user",
              content:
                "Call inspect, then reply exactly with the synthetic code returned by it.",
            },
          ],
          streaming,
          config: { maxTokens: 1024 },
        },
        { signal: AbortSignal.timeout(60000) },
      );
      assert.equal(executions, 1);
      assert.match(result.text, /COMET-81/);
      for (const message of result.messages)
        if (message.providerMetadata)
          inspectState(message.providerMetadata, true);
    });
    await check(
      `${mode}: stored previous_response_id continuation`,
      async () => {
        const storedModel = openai(modelId, {
          apiKey: key,
          api: "responses",
          responses: { store: true },
          reasoningEffort: "low",
        });
        const ids = [];
        try {
          const first = await resultOf(streaming, {
            model: storedModel,
            prompt:
              "Remember synthetic test code BRAVO-16. Reply only with the code.",
            maxTokens: 1024,
            signal: AbortSignal.timeout(60000),
          });
          ids.push(first.metadata.openai.response.id);
          assert.match(first.text, /BRAVO-16/);
          const second = await resultOf(streaming, {
            model: storedModel,
            openai: { responses: { previousResponseId: ids[0] } },
            prompt: "What was the code? Reply only with it.",
            maxTokens: 1024,
            signal: AbortSignal.timeout(60000),
          });
          ids.push(second.metadata.openai.response.id);
          assert.match(second.text, /BRAVO-16/);
        } finally {
          for (const id of ids.filter(Boolean)) {
            const res = await fetch(
              `https://api.openai.com/v1/responses/${encodeURIComponent(id)}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${key}` },
                signal: AbortSignal.timeout(30000),
              },
            );
            if (!res.ok)
              throw new Error(
                `Synthetic stored response cleanup failed: HTTP ${res.status}`,
              );
          }
        }
      },
    );
  }
  for (const streaming of [false, true])
    await check(
      `${streaming ? "stream" : "complete"}: returned encrypted reasoning replay (gpt-5.2)`,
      async () => {
        const reasoningModel = openai("gpt-5.2", {
          apiKey: key,
          api: "responses",
          responses: { store: false },
          reasoningEffort: "medium",
        });
        let answer = 1;
        while (!(answer % 17 === 5 && answer % 19 === 8 && answer % 23 === 11))
          answer++;
        const first = await resultOf(streaming, {
          model: reasoningModel,
          prompt:
            "Find the smallest positive integer n such that n mod 17 = 5, n mod 19 = 8, and n mod 23 = 11. Reply with only the integer.",
          maxTokens: 4096,
          signal: AbortSignal.timeout(90000),
        });
        assert.equal(first.text.trim(), String(answer));
        inspectState(first.metadata);
        assert.ok(
          first.metadata.openai.response.output.some(
            (item) => item.type === "reasoning" && item.encrypted_content,
          ),
          "dedicated reasoning workload must return an encrypted item for this check",
        );
        const next = await resultOf(streaming, {
          model: reasoningModel,
          messages: [
            ...first.response.messages,
            { role: "user", content: "Repeat your answer, integer only." },
          ],
          maxTokens: 1024,
          signal: AbortSignal.timeout(60000),
        });
        assert.equal(next.text.trim(), String(answer));
      },
    );
  for (const streaming of [false, true])
    await check(
      `Copilot ${streaming ? "SSE" : "JSON"}: real mixed tools and persisted next turn`,
      async () => {
        const {
          ReactChat,
        } = require("../../../copilot-sdk/dist/react/index.cjs");
        const schema = {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        };
        let executed = 0;
        const runtime = createRuntime({
          provider: createOpenAI({
            apiKey: key,
            api: "responses",
            responses: { store: false },
            reasoningEffort: "low",
          }),
          model: "gpt-5.2",
          maxIterations: 4,
          tools: [
            {
              name: "server_code",
              description: "Get the server code. Call exactly once.",
              location: "server",
              inputSchema: schema,
              handler: async () => {
                executed++;
                return { success: true, data: { code: "NORTH-31" } };
              },
            },
          ],
        });
        const originalFetch = global.fetch;
        global.fetch = async (url, init) =>
          String(url) === "https://copilot.test/api/chat"
            ? runtime.handleRequest(new Request(url, init))
            : originalFetch(url, init);
        const init = {
          runtimeUrl: "https://copilot.test/api/chat",
          streaming,
          threadId: "synthetic-response-test",
          llm: { maxTokens: 2048 },
        };
        const chat = new ReactChat(init);
        chat.setTools([
          {
            name: "client_code",
            description: "Get the client code. Call exactly once.",
            location: "client",
            inputSchema: schema,
          },
        ]);
        const pending = [];
        chat.onToolCalls((event) => pending.push(event));
        let restored;
        try {
          assert.equal(
            await chat.sendMessage(
              "Call server_code once and client_code once, then reply with both codes. Do not invent either code.",
            ),
            true,
          );
          let clientExecutions = 0;
          while (pending.length) {
            assert.ok(clientExecutions < 3, "unexpected repeated client calls");
            const event = pending.shift();
            await chat.continueWithToolResults(
              event.toolCalls.map((call) => {
                clientExecutions++;
                return {
                  toolCallId: call.id,
                  result: { success: true, data: { code: "SOUTH-92" } },
                };
              }),
            );
          }
          assert.equal(chat.error, undefined);
          assert.equal(chat.status, "ready");
          assert.equal(executed, 1);
          assert.equal(clientExecutions, 1);
          assert.match(chat.messages.at(-1).content, /NORTH-31/);
          assert.match(chat.messages.at(-1).content, /SOUTH-92/);
          assert.ok(
            chat.messages.some((message) =>
              message.providerMetadata?.openai?.response?.output?.some(
                (item) => item.type === "reasoning" && item.encrypted_content,
              ),
            ),
          );
          restored = new ReactChat({
            ...init,
            initialMessages: JSON.parse(JSON.stringify(chat.messages)),
          });
          assert.equal(
            await restored.sendMessage(
              "Repeat the two codes from our earlier exchange. Do not call any tools.",
            ),
            true,
          );
          assert.equal(restored.error, undefined);
          assert.match(restored.messages.at(-1).content, /NORTH-31/);
          assert.match(restored.messages.at(-1).content, /SOUTH-92/);
          assert.equal(executed, 1);
        } finally {
          chat.dispose();
          restored?.dispose();
          global.fetch = originalFetch;
        }
      },
    );
  const report = {
    observedOutput,
    checkedAt: new Date().toISOString(),
    model: modelId,
    checks,
    passed: checks.filter((check) => check.passed).length,
    failed: checks.filter((check) => !check.passed).length,
  };
  if (process.env.RESPONSES_LIVE_REPORT)
    fs.writeFileSync(
      process.env.RESPONSES_LIVE_REPORT,
      JSON.stringify(report, null, 2) + "\n",
    );
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  process.exitCode = report.failed ? 1 : 0;
})().catch((error) => {
  console.error(String(error.message).replaceAll(key, "[REDACTED]"));
  process.exitCode = 1;
});
