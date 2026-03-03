import { NextRequest, NextResponse } from "next/server";

/**
 * Mock MCP Server with MCP-UI Support
 *
 * This implements an MCP server that demonstrates:
 * - Basic tools (time, calculate, random, echo)
 * - MCP-UI tools (interactive product cards, polls, feedback forms, charts)
 */

// Session storage
const sessions = new Map<string, { initialized: boolean }>();

// Tool definitions
const TOOLS = [
  // ============================================
  // Basic Tools
  // ============================================
  {
    name: "get_current_time",
    description: "Get the current date and time",
    inputSchema: {
      type: "object" as const,
      properties: {
        timezone: {
          type: "string",
          description: "Optional timezone (e.g., 'America/New_York')",
        },
      },
    },
  },
  {
    name: "calculate",
    description: "Perform a mathematical calculation",
    inputSchema: {
      type: "object" as const,
      properties: {
        expression: {
          type: "string",
          description:
            "The mathematical expression to evaluate (e.g., '2 + 2')",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "random_number",
    description: "Generate a random number within a range",
    inputSchema: {
      type: "object" as const,
      properties: {
        min: { type: "number", description: "Minimum value (default: 0)" },
        max: { type: "number", description: "Maximum value (default: 100)" },
      },
    },
  },
  {
    name: "echo",
    description: "Echo back the input message",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "The message to echo" },
      },
      required: ["message"],
    },
  },
  // ============================================
  // MCP-UI Tools (Interactive Components)
  // ============================================
  {
    name: "show_product",
    description:
      "Display an interactive product card with add to cart functionality",
    inputSchema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "Product ID (e.g., 'prod-001', 'prod-002', 'prod-003')",
        },
        name: { type: "string", description: "Product name" },
        price: { type: "number", description: "Product price" },
      },
      required: ["productId", "name", "price"],
    },
  },
  {
    name: "show_poll",
    description: "Display an interactive poll/survey for users to vote on",
    inputSchema: {
      type: "object" as const,
      properties: {
        question: { type: "string", description: "Poll question" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Poll options (2-5 choices)",
        },
      },
      required: ["question", "options"],
    },
  },
  {
    name: "show_feedback_form",
    description: "Display a feedback/rating form",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Form title" },
        context: { type: "string", description: "What the feedback is about" },
      },
      required: ["title"],
    },
  },
  {
    name: "show_chart",
    description: "Display an interactive chart visualization",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Chart title" },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value: { type: "number" },
            },
          },
          description: "Chart data points",
        },
        type: {
          type: "string",
          enum: ["bar", "pie"],
          description: "Chart type (default: bar)",
        },
      },
      required: ["title", "data"],
    },
  },
];

// Mock product data
const PRODUCTS: Record<
  string,
  { name: string; price: number; image: string; description: string }
> = {
  "prod-001": {
    name: "Wireless Headphones",
    price: 99.99,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop",
    description: "Premium wireless headphones with noise cancellation",
  },
  "prod-002": {
    name: "Smart Watch",
    price: 249.99,
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop",
    description: "Feature-rich smartwatch with health monitoring",
  },
  "prod-003": {
    name: "Laptop Stand",
    price: 49.99,
    image:
      "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=200&h=200&fit=crop",
    description: "Ergonomic aluminum laptop stand",
  },
};

// ============================================
// MCP-UI HTML Generators
// ============================================

function generateProductCardHTML(
  productId: string,
  name: string,
  price: number,
): string {
  const product = PRODUCTS[productId] || {
    name,
    price,
    image: "",
    description: "",
  };

  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .product-card {
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 280px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
        background: white;
      }
      .product-image {
        width: 100%;
        height: 140px;
        object-fit: cover;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      .product-content { padding: 16px; }
      .product-name {
        font-size: 16px;
        font-weight: 600;
        color: #111827;
        margin-bottom: 4px;
      }
      .product-description {
        font-size: 13px;
        color: #6b7280;
        margin-bottom: 12px;
        line-height: 1.4;
      }
      .product-price {
        font-size: 22px;
        font-weight: 700;
        color: #059669;
        margin-bottom: 12px;
      }
      .quantity-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .qty-btn {
        width: 28px;
        height: 28px;
        border: 1px solid #d1d5db;
        background: #f9fafb;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .qty-btn:hover { background: #e5e7eb; }
      .qty-value { font-size: 15px; font-weight: 500; min-width: 20px; text-align: center; }
      .btn-row { display: flex; gap: 8px; }
      .btn {
        flex: 1;
        padding: 10px 12px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      .btn-primary { background: #2563eb; color: white; }
      .btn-primary:hover { background: #1d4ed8; }
      .btn-secondary { background: #f3f4f6; color: #374151; }
      .btn-secondary:hover { background: #e5e7eb; }
    </style>
    <div class="product-card">
      ${product.image ? `<img src="${product.image}" alt="${product.name}" class="product-image" />` : '<div class="product-image"></div>'}
      <div class="product-content">
        <div class="product-name">${product.name}</div>
        ${product.description ? `<div class="product-description">${product.description}</div>` : ""}
        <div class="product-price">$${product.price.toFixed(2)}</div>
        <div class="quantity-row">
          <button class="qty-btn" onclick="updateQty(-1)">−</button>
          <span class="qty-value" id="qty">1</span>
          <button class="qty-btn" onclick="updateQty(1)">+</button>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="addToCart()">Add to Cart</button>
          <button class="btn btn-secondary" onclick="askDetails()">Details</button>
        </div>
      </div>
    </div>
    <script>
      let qty = 1;
      function updateQty(d) {
        qty = Math.max(1, Math.min(10, qty + d));
        document.getElementById('qty').textContent = qty;
      }
      function addToCart() {
        window.mcpUI.sendIntent({
          type: 'intent',
          action: 'add_to_cart',
          data: { productId: '${productId}', quantity: qty, price: ${price} }
        });
        window.mcpUI.notify('Added ' + qty + ' item(s) to cart!', 'success');
      }
      function askDetails() {
        window.mcpUI.prompt('Tell me more about ${product.name.replace(/'/g, "\\'")}');
      }
    </script>
  `;
}

function generatePollHTML(question: string, options: string[]): string {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .poll {
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 360px;
        padding: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: white;
      }
      .poll-q {
        font-size: 16px;
        font-weight: 600;
        color: #111827;
        margin-bottom: 16px;
        line-height: 1.4;
      }
      .poll-opts { display: flex; flex-direction: column; gap: 8px; }
      .poll-opt {
        position: relative;
        padding: 12px 16px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: white;
        text-align: left;
        cursor: pointer;
        font-size: 14px;
        color: #374151;
        overflow: hidden;
        transition: all 0.15s;
      }
      .poll-opt:hover { border-color: #2563eb; background: #eff6ff; }
      .poll-opt.selected { border-color: #2563eb; background: #dbeafe; }
      .poll-opt.disabled { cursor: default; }
      .poll-bar {
        position: absolute;
        left: 0; top: 0;
        height: 100%;
        background: #93c5fd;
        width: 0;
        transition: width 0.4s ease;
        opacity: 0.3;
      }
      .poll-text { position: relative; z-index: 1; }
      .poll-pct {
        position: relative;
        z-index: 1;
        float: right;
        font-weight: 500;
        color: #2563eb;
        display: none;
      }
      .poll-result {
        margin-top: 12px;
        font-size: 13px;
        color: #6b7280;
        text-align: center;
        display: none;
      }
    </style>
    <div class="poll">
      <div class="poll-q">${question}</div>
      <div class="poll-opts">
        ${options
          .map(
            (opt, i) => `
          <button class="poll-opt" onclick="vote(${i})">
            <span class="poll-bar" id="bar-${i}"></span>
            <span class="poll-text">${opt}</span>
            <span class="poll-pct" id="pct-${i}"></span>
          </button>
        `,
          )
          .join("")}
      </div>
      <div class="poll-result" id="result"></div>
    </div>
    <script>
      const opts = ${JSON.stringify(options)};
      let voted = false;
      function vote(idx) {
        if (voted) return;
        voted = true;
        const btns = document.querySelectorAll('.poll-opt');
        btns.forEach((b, i) => {
          b.classList.add('disabled');
          if (i === idx) b.classList.add('selected');
        });
        const results = opts.map(() => Math.floor(Math.random() * 30) + 10);
        results[idx] += 25;
        const total = results.reduce((a, b) => a + b, 0);
        results.forEach((r, i) => {
          const pct = Math.round((r / total) * 100);
          document.getElementById('bar-' + i).style.width = pct + '%';
          document.getElementById('pct-' + i).style.display = 'inline';
          document.getElementById('pct-' + i).textContent = pct + '%';
        });
        document.getElementById('result').style.display = 'block';
        document.getElementById('result').textContent = 'Thanks for voting! ' + total + ' total votes';
        window.mcpUI.sendIntent({
          type: 'intent',
          action: 'poll_vote',
          data: { question: ${JSON.stringify(question)}, selected: opts[idx], index: idx }
        });
      }
    </script>
  `;
}

function generateFeedbackFormHTML(title: string, context?: string): string {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .feedback {
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 360px;
        padding: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: white;
      }
      .feedback-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 4px; }
      .feedback-ctx { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
      .rating-row { display: flex; gap: 8px; margin-bottom: 16px; }
      .rating-btn {
        width: 40px; height: 40px;
        border: 2px solid #d1d5db;
        border-radius: 50%;
        background: white;
        font-size: 15px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .rating-btn:hover { border-color: #fbbf24; background: #fef3c7; }
      .rating-btn.selected { border-color: #f59e0b; background: #fbbf24; color: white; }
      .feedback-ta {
        width: 100%;
        min-height: 70px;
        padding: 10px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 13px;
        resize: vertical;
        margin-bottom: 12px;
      }
      .feedback-ta:focus { outline: none; border-color: #2563eb; }
      .submit-btn {
        width: 100%;
        padding: 10px;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      }
      .submit-btn:hover { background: #1d4ed8; }
      .submit-btn:disabled { background: #9ca3af; cursor: not-allowed; }
      .success { text-align: center; padding: 20px; color: #059669; display: none; }
      .success h3 { margin-bottom: 8px; }
    </style>
    <div class="feedback" id="form">
      <div class="feedback-title">${title}</div>
      ${context ? `<div class="feedback-ctx">${context}</div>` : ""}
      <div class="rating-row">
        ${[1, 2, 3, 4, 5].map((n) => `<button class="rating-btn" onclick="setRating(${n})">${n}</button>`).join("")}
      </div>
      <textarea class="feedback-ta" id="comments" placeholder="Additional comments (optional)..."></textarea>
      <button class="submit-btn" id="submitBtn" onclick="submit()" disabled>Submit Feedback</button>
    </div>
    <div class="feedback success" id="success">
      <h3>Thank you!</h3>
      <p>Your feedback has been submitted.</p>
    </div>
    <script>
      let rating = 0;
      function setRating(v) {
        rating = v;
        document.querySelectorAll('.rating-btn').forEach((b, i) => {
          b.classList.toggle('selected', i < v);
        });
        document.getElementById('submitBtn').disabled = false;
      }
      function submit() {
        const comments = document.getElementById('comments').value;
        window.mcpUI.sendIntent({
          type: 'intent',
          action: 'submit_feedback',
          data: { title: ${JSON.stringify(title)}, rating, comments }
        });
        document.getElementById('form').style.display = 'none';
        document.getElementById('success').style.display = 'block';
        window.mcpUI.notify('Feedback submitted!', 'success');
      }
    </script>
  `;
}

function generateChartHTML(
  title: string,
  data: { label: string; value: number }[],
  type: string = "bar",
): string {
  const maxVal = Math.max(...data.map((d) => d.value));
  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  if (type === "pie") {
    return `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .chart {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 360px;
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: white;
        }
        .chart-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 16px; }
        .pie-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
        .pie-seg { transition: opacity 0.2s; }
        .pie-seg:hover { opacity: 0.8; }
        .legend { display: flex; flex-wrap: wrap; gap: 10px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #374151; }
        .legend-dot { width: 10px; height: 10px; border-radius: 2px; }
      </style>
      <div class="chart">
        <div class="chart-title">${title}</div>
        <div class="pie-bar">
          ${data.map((d, i) => `<div class="pie-seg" style="width:${(d.value / total) * 100}%;background:${colors[i % colors.length]}"></div>`).join("")}
        </div>
        <div class="legend">
          ${data
            .map(
              (d, i) => `
            <div class="legend-item">
              <div class="legend-dot" style="background:${colors[i % colors.length]}"></div>
              <span>${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .chart {
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 360px;
        padding: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: white;
      }
      .chart-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 16px; }
      .chart-rows { display: flex; flex-direction: column; gap: 10px; }
      .chart-row { display: flex; align-items: center; gap: 10px; }
      .chart-label { width: 70px; font-size: 12px; color: #374151; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .chart-bar-bg { flex: 1; height: 22px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
      .chart-bar {
        height: 100%;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 6px;
        transition: width 0.4s ease;
      }
      .chart-val { font-size: 11px; font-weight: 500; color: white; }
    </style>
    <div class="chart">
      <div class="chart-title">${title}</div>
      <div class="chart-rows">
        ${data
          .map(
            (d, i) => `
          <div class="chart-row">
            <span class="chart-label">${d.label}</span>
            <div class="chart-bar-bg">
              <div class="chart-bar" style="width:${(d.value / maxVal) * 100}%;background:${colors[i % colors.length]}">
                <span class="chart-val">${d.value}</span>
              </div>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

// ============================================
// Tool Handlers
// ============================================

type ToolContent = {
  type: string;
  text?: string;
  resource?: Record<string, unknown>;
};

function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): { content: ToolContent[]; isError?: boolean } {
  switch (name) {
    // Basic tools
    case "get_current_time": {
      const tz = (args.timezone as string) || "UTC";
      try {
        const time = new Date().toLocaleString("en-US", { timeZone: tz });
        return {
          content: [{ type: "text", text: `Current time in ${tz}: ${time}` }],
        };
      } catch {
        return {
          content: [{ type: "text", text: `Invalid timezone: ${tz}` }],
          isError: true,
        };
      }
    }

    case "calculate": {
      const expr = args.expression as string;
      try {
        const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, "");
        const result = Function(`"use strict"; return (${sanitized})`)();
        return { content: [{ type: "text", text: `${expr} = ${result}` }] };
      } catch (e) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${e instanceof Error ? e.message : "Unknown"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "random_number": {
      const min = (args.min as number) ?? 0;
      const max = (args.max as number) ?? 100;
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      return {
        content: [
          {
            type: "text",
            text: `Random number between ${min} and ${max}: ${num}`,
          },
        ],
      };
    }

    case "echo": {
      return { content: [{ type: "text", text: args.message as string }] };
    }

    // MCP-UI tools
    case "show_product": {
      const { productId, name, price } = args as {
        productId: string;
        name: string;
        price: number;
      };
      const product = PRODUCTS[productId] || { name, price };
      return {
        content: [
          {
            type: "text",
            text: `Showing product: ${product.name} ($${product.price})`,
          },
          {
            type: "ui",
            resource: {
              uri: `ui://mcp-demo/product/${productId}`,
              mimeType: "text/html",
              content: generateProductCardHTML(productId, name, price),
              metadata: { title: "Product", height: "340px" },
            },
          },
        ],
      };
    }

    case "show_poll": {
      const { question, options } = args as {
        question: string;
        options: string[];
      };
      return {
        content: [
          { type: "text", text: `Poll: ${question}` },
          {
            type: "ui",
            resource: {
              uri: `ui://mcp-demo/poll/${Date.now()}`,
              mimeType: "text/html",
              content: generatePollHTML(question, options),
              metadata: { title: "Poll", height: "280px" },
            },
          },
        ],
      };
    }

    case "show_feedback_form": {
      const { title, context } = args as { title: string; context?: string };
      return {
        content: [
          { type: "text", text: `Feedback: ${title}` },
          {
            type: "ui",
            resource: {
              uri: `ui://mcp-demo/feedback/${Date.now()}`,
              mimeType: "text/html",
              content: generateFeedbackFormHTML(title, context),
              metadata: { title: "Feedback", height: "300px" },
            },
          },
        ],
      };
    }

    case "show_chart": {
      const { title, data, type } = args as {
        title: string;
        data: { label: string; value: number }[];
        type?: string;
      };
      return {
        content: [
          { type: "text", text: `Chart: ${title}` },
          {
            type: "ui",
            resource: {
              uri: `ui://mcp-demo/chart/${Date.now()}`,
              mimeType: "text/html",
              content: generateChartHTML(title, data, type || "bar"),
              metadata: { title: "Chart", height: "240px" },
            },
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// ============================================
// JSON-RPC Handler
// ============================================

function handleJsonRpc(
  method: string,
  params: Record<string, unknown> | undefined,
  sessionId: string,
): unknown {
  switch (method) {
    case "initialize": {
      sessions.set(sessionId, { initialized: true });
      return {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "MCP Demo Server", version: "2.0.0" },
        capabilities: { tools: { listChanged: true } },
        instructions: `MCP Demo Server with UI support.

**Basic Tools:** get_current_time, calculate, random_number, echo

**MCP-UI Tools (Interactive):**
- show_product: Display product cards (try: prod-001, prod-002, prod-003)
- show_poll: Create interactive polls
- show_feedback_form: Collect user feedback
- show_chart: Display bar/pie charts

Example: "Show me product prod-001" or "Create a poll about favorite colors"`,
      };
    }

    case "notifications/initialized":
      return undefined;

    case "ping":
      return {};

    case "tools/list":
      return { tools: TOOLS };

    case "tools/call": {
      const toolName = params?.name as string;
      const toolArgs = (params?.arguments as Record<string, unknown>) || {};
      return handleToolCall(toolName, toolArgs);
    }

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let sessionId = request.headers.get("mcp-session-id");
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    const { jsonrpc, id, method, params } = body;

    if (jsonrpc !== "2.0") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: id || null,
          error: { code: -32600, message: "Invalid Request" },
        },
        { status: 400 },
      );
    }

    try {
      const result = handleJsonRpc(method, params, sessionId);

      if (method.startsWith("notifications/")) {
        return new NextResponse(null, {
          status: 202,
          headers: { "Mcp-Session-Id": sessionId },
        });
      }

      return NextResponse.json(
        { jsonrpc: "2.0", id, result },
        { headers: { "Mcp-Session-Id": sessionId } },
      );
    } catch (error) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal error",
          },
        },
        { status: 500, headers: { "Mcp-Session-Id": sessionId } },
      );
    }
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400 },
    );
  }
}

export async function GET() {
  return new NextResponse(
    "MCP Demo Server v2.0 with UI support. Use POST for JSON-RPC.",
    { status: 200 },
  );
}
