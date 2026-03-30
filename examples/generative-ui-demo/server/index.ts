import "dotenv/config";
import express from "express";
import cors from "cors";
import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";

function resolveProvider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
      model: "claude-haiku-4-5",
      providerName: "Anthropic",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: "gpt-4o-mini",
      providerName: "OpenAI",
    };
  }
  throw new Error(
    "Set ANTHROPIC_API_KEY or OPENAI_API_KEY to run the generative UI demo.",
  );
}

const { provider, model, providerName } = resolveProvider();

const runtime = createRuntime({
  provider,
  model,
  systemPrompt: `You are a data-rich assistant that always renders visual UI components instead of plain text.

You have a render_ui tool. Use it proactively based on the request:

- "table" — any list of items, comparisons, records
- "stat"  — numbers, KPIs, metrics with deltas
- "card"  — single entity details (person, product, place)
- "chart" — trends and distributions (bar, line, pie, area, scatter)
- "html"  — rich, fully custom layouts (see below)

━━━ HTML TYPE CAPABILITIES ━━━
The html iframe has TWO libraries pre-loaded:
1. Tailwind CSS (Play CDN) — use any utility class freely
2. Chart.js — create inline charts with <canvas> + new Chart(...)

Design in a shadcn/ui style:
- Cards:    bg-white rounded-xl border border-gray-200 shadow-sm p-6
- Headings: text-gray-900 font-semibold text-lg
- Muted:    text-gray-500 text-sm
- Badges:   bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium
- Buttons:  bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700
- Grid:     grid grid-cols-3 gap-4 (or 2-col for cards)
- Dividers: border-t border-gray-100 mt-4 pt-4

Chart.js usage in html — inline script after canvas:
<canvas id="c" height="220"></canvas>
<script>
new Chart(document.getElementById('c'), {
  type: 'bar', // bar | line | pie | doughnut | radar | polarArea
  data: {
    labels: ['Jan','Feb','Mar'],
    datasets: [{ label: 'Revenue', data: [120,190,170], backgroundColor: '#6366f1' }]
  },
  options: { responsive: true, plugins: { legend: { position: 'top' } } }
});
</script>

Use html when asked for dashboards, interactive layouts, shadcn-style components, or anything combining charts + stats + cards in one view.
For html, set the "height" field to fit the content — e.g. "600px" for dashboards, "320px" for a small card.
Always prefer a structured type (table, stat, card) over html when the data fits a single type.`,
  maxIterations: 3,
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/chat", (_req, res) => {
  res.json({
    status: "ok",
    provider: providerName,
    model,
    demo: "generative-ui",
  });
});

app.post("/api/chat", async (req, res) => {
  const PORT_NUM = process.env.PORT || 3030;
  const url = `http://localhost:${PORT_NUM}/api/chat`;
  const webReq = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body),
  });
  const response = await runtime.handleRequest(webReq);
  res.status(response.status);
  response.headers.forEach((val, key) => res.setHeader(key, val));
  const body = await response.text();
  res.send(body);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3030;
app.listen(PORT, () =>
  console.log(
    `Generative UI server running on http://localhost:${PORT} (${providerName} / ${model})`,
  ),
);
