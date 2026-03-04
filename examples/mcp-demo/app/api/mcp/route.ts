import { NextRequest, NextResponse } from "next/server";

/**
 * Mock MCP Server - Simplified Demo
 *
 * Demonstrates:
 * - Basic tools (time, calculate)
 * - MCP-UI tools (product, chart, code, weather)
 */

const sessions = new Map<string, { initialized: boolean }>();

// ============================================
// Tool Definitions (6 tools)
// ============================================
const TOOLS = [
  // Basic Tools
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
          description: "Mathematical expression (e.g., '2 + 2')",
        },
      },
      required: ["expression"],
    },
  },
  // MCP-UI Tools
  {
    name: "show_product",
    description: "Display an interactive product card with add to cart",
    inputSchema: {
      type: "object" as const,
      properties: {
        productId: { type: "string", description: "Product ID" },
        name: { type: "string", description: "Product name" },
        price: { type: "number", description: "Product price" },
      },
      required: ["productId", "name", "price"],
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
          description: "Chart type",
        },
      },
      required: ["title", "data"],
    },
  },
  {
    name: "show_code",
    description: "Display syntax-highlighted code with copy functionality",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Code to display" },
        language: {
          type: "string",
          enum: [
            "javascript",
            "typescript",
            "python",
            "rust",
            "go",
            "html",
            "css",
            "json",
            "bash",
          ],
          description: "Programming language",
        },
        filename: { type: "string", description: "Optional filename" },
      },
      required: ["code", "language"],
    },
  },
  {
    name: "show_weather",
    description: "Display an interactive weather widget with forecast",
    inputSchema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City name" },
        country: { type: "string", description: "Country code (e.g., 'US')" },
        units: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature units",
        },
      },
      required: ["city"],
    },
  },
];

// ============================================
// Tool Handlers
// ============================================
function handleTool(
  name: string,
  args: Record<string, unknown>,
): { content: Array<{ type: string; text?: string; mimeType?: string }> } {
  switch (name) {
    case "get_current_time": {
      const tz = (args.timezone as string) || "UTC";
      const now = new Date();
      try {
        const formatted = now.toLocaleString("en-US", {
          timeZone: tz,
          dateStyle: "full",
          timeStyle: "long",
        });
        return {
          content: [
            { type: "text", text: `Current time in ${tz}: ${formatted}` },
          ],
        };
      } catch {
        return {
          content: [
            { type: "text", text: `Current time (UTC): ${now.toISOString()}` },
          ],
        };
      }
    }

    case "calculate": {
      const expr = args.expression as string;
      try {
        const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, "");
        const result = Function(`"use strict"; return (${sanitized})`)();
        return { content: [{ type: "text", text: `${expr} = ${result}` }] };
      } catch {
        return {
          content: [
            { type: "text", text: `Error: Invalid expression "${expr}"` },
          ],
        };
      }
    }

    case "show_product":
      return {
        content: [
          {
            type: "text",
            mimeType: "text/html",
            text: generateProductHTML(args),
          },
        ],
      };

    case "show_chart":
      return {
        content: [
          {
            type: "text",
            mimeType: "text/html",
            text: generateChartHTML(args),
          },
        ],
      };

    case "show_code":
      return {
        content: [
          { type: "text", mimeType: "text/html", text: generateCodeHTML(args) },
        ],
      };

    case "show_weather":
      return {
        content: [
          {
            type: "text",
            mimeType: "text/html",
            text: generateWeatherHTML(args),
          },
        ],
      };

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
}

// ============================================
// MCP-UI HTML Generators
// ============================================
const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 16px; }
  .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
`;

const MCP_UI_SCRIPT = `
  function mcpAction(action, data) {
    window.parent.postMessage({ type: 'mcp-ui-intent', action, data }, '*');
  }
  function mcpNotify(message, level = 'info') {
    window.parent.postMessage({ type: 'mcp-ui-notify', message, level }, '*');
  }
`;

function generateProductHTML(args: Record<string, unknown>): string {
  const { productId, name, price } = args as {
    productId: string;
    name: string;
    price: number;
  };
  const images: Record<string, string> = {
    "prod-001":
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
    "prod-002":
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
    "prod-003":
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400",
  };
  const image = images[productId] || images["prod-001"];

  return `<!DOCTYPE html><html><head><style>
    ${BASE_STYLES}
    .product { max-width: 320px; }
    .product img { width: 100%; height: 200px; object-fit: cover; }
    .product-info { padding: 16px; }
    .product-name { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
    .product-price { font-size: 24px; font-weight: 700; color: #059669; margin-bottom: 16px; }
    .qty-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .qty-btn { width: 32px; height: 32px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; cursor: pointer; font-size: 16px; }
    .qty-btn:hover { background: #f1f5f9; }
    .qty-value { font-size: 16px; font-weight: 500; min-width: 24px; text-align: center; }
    .add-btn { width: 100%; padding: 12px; background: #059669; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .add-btn:hover { background: #047857; }
  </style></head><body>
    <div class="card product">
      <img src="${image}" alt="${name}">
      <div class="product-info">
        <div class="product-name">${name}</div>
        <div class="product-price">$${price.toFixed(2)}</div>
        <div class="qty-row">
          <button class="qty-btn" onclick="changeQty(-1)">−</button>
          <span class="qty-value" id="qty">1</span>
          <button class="qty-btn" onclick="changeQty(1)">+</button>
        </div>
        <button class="add-btn" onclick="addToCart()">Add to Cart</button>
      </div>
    </div>
    <script>
      ${MCP_UI_SCRIPT}
      let qty = 1;
      function changeQty(delta) {
        qty = Math.max(1, Math.min(10, qty + delta));
        document.getElementById('qty').textContent = qty;
      }
      function addToCart() {
        mcpAction('add_to_cart', { productId: '${productId}', name: '${name}', price: ${price}, quantity: qty });
        mcpNotify('Added ' + qty + 'x ${name} to cart!', 'success');
      }
    </script>
  </body></html>`;
}

function generateChartHTML(args: Record<string, unknown>): string {
  const {
    title,
    data,
    type = "bar",
  } = args as {
    title: string;
    data: Array<{ label: string; value: number }>;
    type?: string;
  };
  const maxValue = Math.max(...data.map((d) => d.value));
  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];

  if (type === "pie") {
    let total = data.reduce((s, d) => s + d.value, 0);
    let startAngle = 0;
    const paths = data.map((d, i) => {
      const angle = (d.value / total) * 360;
      const endAngle = startAngle + angle;
      const largeArc = angle > 180 ? 1 : 0;
      const x1 = 100 + 80 * Math.cos((Math.PI * startAngle) / 180);
      const y1 = 100 + 80 * Math.sin((Math.PI * startAngle) / 180);
      const x2 = 100 + 80 * Math.cos((Math.PI * endAngle) / 180);
      const y2 = 100 + 80 * Math.sin((Math.PI * endAngle) / 180);
      const path = `<path d="M100,100 L${x1},${y1} A80,80 0 ${largeArc},1 ${x2},${y2} Z" fill="${colors[i % colors.length]}"/>`;
      startAngle = endAngle;
      return path;
    });
    const legend = data
      .map(
        (d, i) =>
          `<div style="display:flex;align-items:center;gap:8px;font-size:12px;"><div style="width:12px;height:12px;border-radius:2px;background:${colors[i % colors.length]}"></div>${d.label}: ${d.value}</div>`,
      )
      .join("");

    return `<!DOCTYPE html><html><head><style>${BASE_STYLES}.chart{padding:20px;max-width:360px}.title{font-size:16px;font-weight:600;margin-bottom:16px;color:#1e293b}.legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}</style></head><body>
      <div class="card chart"><div class="title">${title}</div><svg viewBox="0 0 200 200" width="200" height="200">${paths.join("")}</svg><div class="legend">${legend}</div></div>
    </body></html>`;
  }

  const bars = data.map((d, i) => {
    const height = (d.value / maxValue) * 120;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="width:40px;height:${height}px;background:${colors[i % colors.length]};border-radius:4px 4px 0 0;"></div><div style="font-size:10px;color:#64748b;text-align:center;max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.label}</div><div style="font-size:12px;font-weight:600;color:#1e293b;">${d.value}</div></div>`;
  });

  return `<!DOCTYPE html><html><head><style>${BASE_STYLES}.chart{padding:20px;max-width:400px}.title{font-size:16px;font-weight:600;margin-bottom:16px;color:#1e293b}.bars{display:flex;align-items:flex-end;gap:16px;height:160px;padding-top:20px}</style></head><body>
    <div class="card chart"><div class="title">${title}</div><div class="bars">${bars.join("")}</div></div>
  </body></html>`;
}

function generateCodeHTML(args: Record<string, unknown>): string {
  const { code, language, filename } = args as {
    code: string;
    language: string;
    filename?: string;
  };
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped
    .split("\n")
    .map(
      (line, i) =>
        `<div class="line"><span class="ln">${i + 1}</span><span class="code">${line || " "}</span></div>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><style>
    ${BASE_STYLES}
    .code-block { max-width: 500px; background: #1e293b; border-radius: 8px; overflow: hidden; }
    .header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #334155; }
    .filename { font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 6px; }
    .lang-badge { font-size: 10px; background: #475569; color: #e2e8f0; padding: 2px 6px; border-radius: 4px; }
    .copy-btn { background: #475569; border: none; color: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; }
    .copy-btn:hover { background: #64748b; }
    .lines { padding: 12px 0; font-family: 'SF Mono', Monaco, monospace; font-size: 13px; line-height: 1.5; overflow-x: auto; }
    .line { display: flex; }
    .ln { width: 40px; text-align: right; padding-right: 12px; color: #64748b; user-select: none; }
    .code { color: #e2e8f0; white-space: pre; }
  </style></head><body>
    <div class="code-block">
      <div class="header">
        <span class="filename">${filename || language}<span class="lang-badge">${language}</span></span>
        <button class="copy-btn" onclick="copyCode()">Copy</button>
      </div>
      <div class="lines">${lines}</div>
    </div>
    <script>
      ${MCP_UI_SCRIPT}
      function copyCode() {
        navigator.clipboard.writeText(${JSON.stringify(code)});
        mcpNotify('Code copied!', 'success');
      }
    </script>
  </body></html>`;
}

function generateWeatherHTML(args: Record<string, unknown>): string {
  const {
    city,
    country = "",
    units = "celsius",
  } = args as { city: string; country?: string; units?: string };
  const conditions = ["sunny", "cloudy", "rainy", "partly-cloudy"];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  const temp =
    units === "fahrenheit"
      ? Math.floor(Math.random() * 40 + 50)
      : Math.floor(Math.random() * 20 + 10);
  const unit = units === "fahrenheit" ? "°F" : "°C";
  const icons: Record<string, string> = {
    sunny: "☀️",
    cloudy: "☁️",
    rainy: "🌧️",
    "partly-cloudy": "⛅",
  };
  const forecast = [1, 2, 3, 4, 5].map((d) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
      (new Date().getDay() + d) % 7
    ],
    temp: temp + Math.floor(Math.random() * 10 - 5),
    icon: icons[conditions[Math.floor(Math.random() * conditions.length)]],
  }));

  return `<!DOCTYPE html><html><head><style>
    ${BASE_STYLES}
    .weather { max-width: 320px; padding: 20px; }
    .location { font-size: 14px; color: #64748b; margin-bottom: 4px; }
    .current { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .icon { font-size: 48px; }
    .temp { font-size: 48px; font-weight: 700; color: #1e293b; }
    .condition { font-size: 14px; color: #64748b; text-transform: capitalize; }
    .forecast { display: flex; gap: 8px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .day { flex: 1; text-align: center; padding: 8px 4px; background: #f8fafc; border-radius: 8px; }
    .day-name { font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .day-icon { font-size: 20px; margin-bottom: 4px; }
    .day-temp { font-size: 13px; font-weight: 600; color: #1e293b; }
  </style></head><body>
    <div class="card weather">
      <div class="location">${city}${country ? ", " + country : ""}</div>
      <div class="current">
        <span class="icon">${icons[condition]}</span>
        <div>
          <div class="temp">${temp}${unit}</div>
          <div class="condition">${condition.replace("-", " ")}</div>
        </div>
      </div>
      <div class="forecast">
        ${forecast.map((f) => `<div class="day"><div class="day-name">${f.day}</div><div class="day-icon">${f.icon}</div><div class="day-temp">${f.temp}°</div></div>`).join("")}
      </div>
    </div>
  </body></html>`;
}

// ============================================
// MCP Protocol Handler
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jsonrpc, id, method, params } = body;

    if (jsonrpc !== "2.0") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Invalid JSON-RPC version" },
      });
    }

    let result: unknown;

    switch (method) {
      case "initialize":
        const sessionId = params?.sessionId || `session-${Date.now()}`;
        sessions.set(sessionId, { initialized: true });
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "MCP Demo Server", version: "2.0.0" },
        };
        break;

      case "initialized":
        result = {};
        break;

      case "tools/list":
        result = { tools: TOOLS };
        break;

      case "tools/call":
        const { name, arguments: toolArgs } = params || {};
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) {
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `Unknown tool: ${name}` },
          });
        }
        result = handleTool(name, toolArgs || {});
        break;

      case "ping":
        result = {};
        break;

      default:
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
    }

    return NextResponse.json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    console.error("MCP Error:", error);
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "Internal error" },
    });
  }
}

export async function GET() {
  return NextResponse.json({
    name: "MCP Demo Server",
    version: "2.0.0",
    tools: TOOLS.length,
    description: "Mock MCP server with MCP-UI support",
  });
}
