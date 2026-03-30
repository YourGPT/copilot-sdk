import "dotenv/config";
import express from "express";
import cors from "cors";
import { createRuntime } from "@yourgpt/llm-sdk";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const runtime = createRuntime({
  provider: openai,
  model: "gpt-4o-mini",
  systemPrompt:
    "You are a helpful AI assistant in a team Slack-like chat. Be concise and friendly.\n\nYou have access to these tools — use them when relevant:\n- get_weather: get weather for any city\n- search_web: search the web for information\n- create_poll: create a team poll with voting options\n- calculate: evaluate a math expression (client-side)\n- get_time: get current time/date for any timezone (client-side)\n\nAlways use tools when the user's request clearly calls for one.",
  tools: [
    {
      name: "get_weather",
      description: "Get current weather for a city",
      location: "server" as const,
      inputSchema: {
        type: "object" as const,
        properties: {
          city: { type: "string", description: "City name" },
        },
        required: ["city"],
      },
      handler: async ({ city }: { city: string }) => {
        // Mock weather data
        const conditions = [
          "Sunny",
          "Cloudy",
          "Rainy",
          "Partly cloudy",
          "Windy",
        ];
        const temp = Math.floor(Math.random() * 25) + 10;
        const condition =
          conditions[Math.floor(Math.random() * conditions.length)];
        return {
          success: true,
          data: {
            city,
            temperature: temp,
            unit: "celsius",
            condition,
            humidity: Math.floor(Math.random() * 40) + 40,
            wind: Math.floor(Math.random() * 20) + 5,
          },
        };
      },
    },
    {
      name: "search_web",
      description: "Search the web for information on a topic",
      location: "server" as const,
      inputSchema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
      handler: async ({ query }: { query: string }) => {
        // Mock search results
        return {
          success: true,
          data: {
            query,
            results: [
              {
                title: `${query} — Overview`,
                url: "https://example.com/1",
                snippet: `Comprehensive overview of ${query} with latest updates and insights.`,
              },
              {
                title: `Understanding ${query}`,
                url: "https://example.com/2",
                snippet: `Deep dive into ${query}: history, current state, and future outlook.`,
              },
              {
                title: `${query} Guide 2025`,
                url: "https://example.com/3",
                snippet: `Complete guide to ${query} for beginners and advanced users alike.`,
              },
            ],
          },
        };
      },
    },
    {
      name: "create_poll",
      description: "Create a team poll with options for voting",
      location: "server" as const,
      inputSchema: {
        type: "object" as const,
        properties: {
          question: { type: "string", description: "Poll question" },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Poll options",
          },
        },
        required: ["question", "options"],
      },
      handler: async ({
        question,
        options,
      }: {
        question: string;
        options: string[];
      }) => {
        return {
          success: true,
          data: {
            id: `poll_${Date.now()}`,
            question,
            options: options.map((o, i) => ({ id: i, text: o, votes: 0 })),
            createdAt: new Date().toISOString(),
          },
        };
      },
    },
  ],
});

app.get("/api/copilot", (_req, res) => {
  res.json({ status: "ok", provider: "openai" });
});

app.post("/api/copilot", async (req, res) => {
  // createRuntime.handleRequest expects a web Request — adapt from Express
  const url = `http://localhost:${PORT}/api/copilot`;
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

const PORT = 3010;
app.listen(PORT, () =>
  console.log(`Copilot server running on http://localhost:${PORT}`),
);
