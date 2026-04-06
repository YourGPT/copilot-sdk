/**
 * Proxy to local yourgpt-server-demo for testing SDK stream/non-stream endpoints.
 *
 * Routes based on `streaming` field in the request body:
 *   streaming: true  → /api/copilot/stream  (SSE)
 *   streaming: false → /api/copilot/chat    (JSON)
 *
 * Set YOURGPT_SERVER_URL in .env.local to point at your local server.
 * Default: http://localhost:3001
 */

const SERVER_URL = process.env.YOURGPT_SERVER_URL || "http://localhost:3001";

export async function POST(request: Request) {
  const body = await request.json();
  const isStreaming = body.streaming !== false;
  const endpoint = isStreaming ? "/api/copilot/stream" : "/api/copilot/chat";
  const targetUrl = `${SERVER_URL}${endpoint}`;

  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Pass the response body (streamed or JSON) straight through
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
      // Forward cache-control so SSE isn't buffered
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
