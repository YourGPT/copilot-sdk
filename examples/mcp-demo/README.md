# MCP Demo with MCP-UI Support

This example demonstrates the MCP (Model Context Protocol) integration with YourGPT Copilot SDK, including **MCP-UI** for interactive components.

## Features

- **MCP Server** - Mock MCP server with basic and UI tools
- **MCP Client** - Using `useMCPTools` to connect and auto-register tools
- **MCP-UI** - Interactive UI components (product cards, polls, feedback forms, charts)
- **Intent Handling** - Handle user interactions from UI components

## Getting Started

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your OpenAI API key:

   ```
   OPENAI_API_KEY=sk-xxx
   ```

3. **Run the development server**

   ```bash
   pnpm dev
   ```

4. **Open the demo**

   Navigate to [http://localhost:3001](http://localhost:3001)

## How to Test

1. Click **"Connect"** to connect to the built-in MCP server
2. Once connected, you'll see available tools listed (basic + MCP-UI)
3. Try asking the AI to use the tools

### Basic Tools

| Prompt                                       | Tool Used          |
| -------------------------------------------- | ------------------ |
| "What time is it?"                           | `get_current_time` |
| "Calculate 15 \* 7 + 3"                      | `calculate`        |
| "Generate a random number between 1 and 100" | `random_number`    |
| "Echo: Hello World"                          | `echo`             |

### MCP-UI Tools (Interactive)

| Prompt                                             | Tool Used            | Result                                    |
| -------------------------------------------------- | -------------------- | ----------------------------------------- |
| "Show me product prod-001"                         | `show_product`       | Interactive product card with Add to Cart |
| "Create a poll: Favorite color? Red, Blue, Green"  | `show_poll`          | Clickable poll with animated results      |
| "Show a feedback form for this chat"               | `show_feedback_form` | Rating form with comments                 |
| "Display a chart of sales: Q1 100, Q2 150, Q3 200" | `show_chart`         | Bar chart visualization                   |

## MCP-UI Features

### Interactive Components

MCP-UI tools return HTML content that renders as sandboxed iframes in the chat. Users can interact with these components:

- **Product Cards** - Quantity selector, Add to Cart button
- **Polls** - Click to vote, see animated results
- **Feedback Forms** - Rate 1-5 stars, add comments
- **Charts** - Bar and pie chart visualizations

### Intent Handling

When users interact with MCP-UI components, intents are sent back to the host application:

```typescript
// Example intents
{ type: "intent", action: "add_to_cart", data: { productId: "prod-001", quantity: 2 } }
{ type: "intent", action: "poll_vote", data: { selected: "Blue", index: 1 } }
{ type: "intent", action: "submit_feedback", data: { rating: 5, comments: "Great!" } }
```

The demo shows these events in the "UI Events" panel.

## Available Products

The mock server includes these pre-defined products:

| ID         | Name                | Price   |
| ---------- | ------------------- | ------- |
| `prod-001` | Wireless Headphones | $99.99  |
| `prod-002` | Smart Watch         | $249.99 |
| `prod-003` | Laptop Stand        | $49.99  |

## Project Structure

```
mcp-demo/
├── app/
│   ├── api/
│   │   ├── chat/route.ts    # Chat API endpoint
│   │   └── mcp/route.ts     # Mock MCP server with UI tools
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx             # Main demo page with MCP-UI handling
├── package.json
└── README.md
```

## SDK Integration

### Connecting to MCP

```tsx
import { useMCPTools, useMCPUIIntents } from "@yourgpt/copilot-sdk/react";

// Connect to MCP server
const { isConnected, toolDefinitions, connect } = useMCPTools({
  name: "demo",
  transport: "http",
  url: "/api/mcp",
  autoConnect: false,
  prefixToolNames: true,
});

// Handle UI intents
const { handleIntent } = useMCPUIIntents({
  onIntent: (action, data) => {
    if (action === "add_to_cart") {
      // Handle add to cart
    }
  },
  onNotify: (message, level) => {
    // Show toast notification
  },
});
```

### MCP Server Response Format

MCP-UI tools return content arrays with both text and UI resources:

```typescript
{
  content: [
    { type: "text", text: "Showing product: Wireless Headphones" },
    {
      type: "ui",
      resource: {
        uri: "ui://mcp-demo/product/prod-001",
        mimeType: "text/html",
        content: "<div class='product-card'>...</div>",
        metadata: { title: "Product", height: "340px" },
      },
    },
  ];
}
```

## Learn More

- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP-UI GitHub](https://github.com/idosal/mcp-ui)
- [YourGPT Copilot SDK Documentation](https://copilot-sdk.yourgpt.ai)
