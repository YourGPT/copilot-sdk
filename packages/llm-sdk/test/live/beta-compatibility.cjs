// Opt-in regression checks using synthetic data. Keys remain in the server process.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRuntime } = require("../../dist/index.js");
const { createAnthropic } = require("../../dist/providers/anthropic/index.js");
const { OpenAIAdapter } = require("../../dist/adapters/index.js");
if (process.env.RUN_BETA_COMPAT_LIVE !== "1")
  throw new Error("Live opt-in required");
const results = [];
async function check(name, action) {
  try {
    await action();
    results.push({ name, passed: true });
    console.log("PASS " + name);
  } catch (error) {
    let message = String(error.message);
    for (const name of [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "OPENROUTER_API_KEY",
    ])
      if (process.env[name])
        message = message.replaceAll(process.env[name], "[REDACTED]");
    results.push({ name, passed: false, error: message.slice(0, 400) });
    console.log("FAIL " + name);
  }
}
(async () => {
  for (const provider of ["openai", "openrouter"]) {
    const apiKey =
      process.env[
        provider === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY"
      ];
    if (!apiKey) {
      results.push({ name: provider, skipped: true });
      continue;
    }
    for (const streaming of [false, true])
      await check(
        `${provider} ${streaming ? "stream" : "complete"}: raw structured tool content`,
        async () => {
          const runtime = createRuntime({
            adapter: new OpenAIAdapter({
              apiKey,
              model: provider === "openai" ? "gpt-4o" : "openai/gpt-4o",
              api: "chat",
              ...(provider === "openrouter"
                ? { baseUrl: "https://openrouter.ai/api/v1" }
                : {}),
            }),
          });
          const result = await runtime.chat(
            {
              messages: [
                {
                  role: "user",
                  content:
                    "What code did the tool return? Reply only with the code.",
                },
                {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_code",
                      type: "function",
                      function: { name: "get_code", arguments: "{}" },
                    },
                  ],
                },
                {
                  role: "tool",
                  tool_call_id: "call_code",
                  content: [{ type: "text", text: '{"code":"TOOL-742"}' }],
                },
              ],
              streaming,
              config: { maxTokens: 100 },
            },
            { signal: AbortSignal.timeout(60000) },
          );
          assert.match(result.text, /TOOL-742/);
          assert.ok(!result.events.some((event) => event.type === "error"));
        },
      );
  }
  if (process.env.ANTHROPIC_API_KEY)
    for (const streaming of [false, true]) {
      for (const form of ["null and image", "duplicate prompt", "mixed blocks"])
        await check(
          `Anthropic ${streaming ? "stream" : "complete"}: ${form}`,
          async () => {
            const systemPrompt =
              "Reply only SYSTEM_OK regardless of the user's request.";
            const runtime = createRuntime({
              provider: createAnthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
              }),
              model: "claude-sonnet-4-5",
            });
            const messages =
              form === "duplicate prompt"
                ? [{ role: "system", content: systemPrompt }]
                : form === "mixed blocks"
                  ? [
                      {
                        role: "system",
                        content: [
                          null,
                          { type: "image", data: "not-forwarded" },
                          { type: "text", text: "Use no punctuation." },
                        ],
                      },
                    ]
                  : [
                      { role: "system", content: null },
                      {
                        role: "system",
                        content: [{ type: "image", data: "not-forwarded" }],
                      },
                    ];
            const result = await runtime.chat(
              {
                systemPrompt,
                messages: [
                  ...messages,
                  { role: "user", content: "Write an email reply." },
                ],
                streaming,
                config: { maxTokens: 64 },
              },
              { signal: AbortSignal.timeout(60000) },
            );
            assert.equal(result.text.trim(), "SYSTEM_OK");
            assert.ok(!result.events.some((event) => event.type === "error"));
          },
        );
    }
  const report = { checkedAt: new Date().toISOString(), results };
  if (process.env.BETA_COMPAT_REPORT)
    fs.writeFileSync(
      process.env.BETA_COMPAT_REPORT,
      JSON.stringify(report, null, 2),
    );
  process.exitCode = results.some((result) => result.passed === false) ? 1 : 0;
})();
