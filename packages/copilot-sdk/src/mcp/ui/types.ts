/**
 * MCP-UI Type Definitions
 *
 * This module defines types for MCP-UI support, enabling MCP tools
 * to return interactive UI components (forms, charts, product selectors, etc.)
 * that render directly in the chat interface.
 *
 * @see https://github.com/idosal/mcp-ui
 * @see https://shopify.engineering/mcp-ui-breaking-the-text-wall
 */

// ============================================
// UI Resource Types
// ============================================

/**
 * MCP UI Resource MIME types
 *
 * - `text/html`: Inline HTML content rendered in iframe
 * - `text/uri-list`: External URL to load in iframe
 * - `application/vnd.mcp-ui.remote-dom`: Remote DOM rendering (advanced)
 */
export type MCPUIResourceMimeType =
  | "text/html"
  | "text/uri-list"
  | "application/vnd.mcp-ui.remote-dom";

/**
 * MCP UI Resource metadata
 *
 * Optional configuration for how the UI should be displayed.
 */
export interface MCPUIResourceMetadata {
  /** Title shown above the UI component */
  title?: string;
  /** Width of the iframe (e.g., "100%", "400px") */
  width?: string;
  /** Height of the iframe (e.g., "200px", "auto") */
  height?: string;
  /**
   * Custom iframe sandbox permissions
   * @default ["allow-scripts", "allow-forms"]
   */
  sandbox?: string[];
  /** Additional CSS classes for styling */
  className?: string;
}

/**
 * MCP UI Resource
 *
 * Represents a UI component returned by an MCP tool.
 * Can be inline HTML, an external URL, or Remote DOM content.
 *
 * @example
 * ```typescript
 * // Inline HTML
 * const resource: MCPUIResource = {
 *   uri: "ui://shop/product/123",
 *   mimeType: "text/html",
 *   content: "<div class='product-card'>...</div>",
 *   metadata: { height: "300px" }
 * };
 *
 * // External URL
 * const urlResource: MCPUIResource = {
 *   uri: "ui://dashboard/chart",
 *   mimeType: "text/uri-list",
 *   content: "https://charts.example.com/embed/abc123",
 *   metadata: { height: "400px", title: "Sales Chart" }
 * };
 * ```
 */
export interface MCPUIResource {
  /** Unique URI identifying this UI resource (e.g., ui://server/resource-id) */
  uri: string;
  /** MIME type determining how to render the content */
  mimeType: MCPUIResourceMimeType;
  /** Content: inline HTML for text/html, URL for text/uri-list */
  content?: string;
  /** Base64-encoded content (alternative to content) */
  blob?: string;
  /** Display configuration */
  metadata?: MCPUIResourceMetadata;
}

/**
 * MCP UI Resource content type for tool results
 *
 * This is the content array item format returned by MCP tools.
 *
 * @example
 * ```typescript
 * // MCP tool returning UI
 * return {
 *   content: [
 *     { type: "text", text: "Here's the product:" },
 *     {
 *       type: "ui",
 *       resource: {
 *         uri: "ui://shop/product/123",
 *         mimeType: "text/html",
 *         content: "<div>...</div>"
 *       }
 *     }
 *   ]
 * };
 * ```
 */
export interface MCPUIResourceContent {
  type: "ui";
  resource: MCPUIResource;
}

// ============================================
// Intent Types (UI → Host Communication)
// ============================================

/**
 * Tool intent - Request to call another MCP tool
 *
 * @example
 * ```typescript
 * // Button click triggers tool call
 * window.parent.postMessage({
 *   type: "tool",
 *   name: "add_to_cart",
 *   arguments: { productId: "123", quantity: 1 }
 * }, "*");
 * ```
 */
export interface MCPUIToolIntent {
  type: "tool";
  /** Name of the tool to call */
  name: string;
  /** Arguments to pass to the tool */
  arguments?: Record<string, unknown>;
}

/**
 * Action intent - Semantic action for the agent to interpret
 *
 * Unlike tool intents, these don't directly call tools but let the
 * AI agent decide how to handle the action.
 *
 * @example
 * ```typescript
 * // User selects a product variant
 * window.parent.postMessage({
 *   type: "intent",
 *   action: "select_variant",
 *   data: { variantId: "blue-xl", productId: "123" }
 * }, "*");
 * ```
 */
export interface MCPUIActionIntent {
  type: "intent";
  /** Semantic action name */
  action: string;
  /** Action data */
  data?: Record<string, unknown>;
}

/**
 * Prompt intent - Add text to the chat input
 *
 * @example
 * ```typescript
 * // "Ask about this" button
 * window.parent.postMessage({
 *   type: "prompt",
 *   text: "Tell me more about product X"
 * }, "*");
 * ```
 */
export interface MCPUIPromptIntent {
  type: "prompt";
  /** Text to add to chat input */
  text: string;
}

/**
 * Notify intent - Show a notification/toast
 *
 * @example
 * ```typescript
 * // Show success message
 * window.parent.postMessage({
 *   type: "notify",
 *   message: "Added to cart!",
 *   level: "success"
 * }, "*");
 * ```
 */
export interface MCPUINotifyIntent {
  type: "notify";
  /** Notification message */
  message: string;
  /** Notification level */
  level?: "info" | "success" | "warning" | "error";
}

/**
 * Link intent - Open a URL (with user consent)
 *
 * @example
 * ```typescript
 * // "View full details" button
 * window.parent.postMessage({
 *   type: "link",
 *   url: "https://shop.example.com/product/123"
 * }, "*");
 * ```
 */
export interface MCPUILinkIntent {
  type: "link";
  /** URL to open */
  url: string;
  /** Open in new tab (default: true) */
  newTab?: boolean;
}

/**
 * Union of all MCP-UI intent types
 *
 * These are messages sent from the UI iframe to the host application
 * via postMessage.
 */
export type MCPUIIntent =
  | MCPUIToolIntent
  | MCPUIActionIntent
  | MCPUIPromptIntent
  | MCPUINotifyIntent
  | MCPUILinkIntent;

// ============================================
// Message Types (for postMessage)
// ============================================

/**
 * Message envelope for postMessage communication
 *
 * All messages from UI iframes should include a source identifier
 * for validation.
 */
export interface MCPUIMessage {
  /** Source identifier for validation */
  source?: "mcp-ui";
  /** The intent payload */
  intent: MCPUIIntent;
}

// ============================================
// Intent Handler Types
// ============================================

/**
 * Intent handler callback signature
 */
export type MCPUIIntentHandler<T extends MCPUIIntent = MCPUIIntent> = (
  intent: T,
  context?: MCPUIIntentContext,
) => void | Promise<void>;

/**
 * Context passed to intent handlers
 */
export interface MCPUIIntentContext {
  /** Source tool name that rendered the UI */
  toolName?: string;
  /** Tool call ID */
  toolCallId?: string;
  /** Original UI resource */
  resource?: MCPUIResource;
}

/**
 * Configuration for useMCPUIIntents hook
 */
export interface UseMCPUIIntentsConfig {
  /**
   * Handler for tool intents - call another MCP tool
   */
  onToolCall?: (
    name: string,
    args?: Record<string, unknown>,
    context?: MCPUIIntentContext,
  ) => void | Promise<void>;

  /**
   * Handler for action intents - semantic actions for agent interpretation
   */
  onIntent?: (
    action: string,
    data?: Record<string, unknown>,
    context?: MCPUIIntentContext,
  ) => void | Promise<void>;

  /**
   * Handler for prompt intents - add text to chat input
   */
  onPrompt?: (text: string, context?: MCPUIIntentContext) => void;

  /**
   * Handler for notify intents - show notifications
   */
  onNotify?: (
    message: string,
    level?: "info" | "success" | "warning" | "error",
    context?: MCPUIIntentContext,
  ) => void;

  /**
   * Handler for link intents - open URLs
   * Return false to prevent default behavior
   */
  onLink?: (
    url: string,
    newTab?: boolean,
    context?: MCPUIIntentContext,
  ) => boolean | void;

  /**
   * Whether to require user consent for sensitive intents
   * @default true for "tool" and "link" intents
   */
  requireConsent?: {
    tool?: boolean;
    link?: boolean;
  };
}

/**
 * Return type for useMCPUIIntents hook
 */
export interface UseMCPUIIntentsReturn {
  /**
   * Handle an intent from a UI component
   * This should be passed to MCPUIFrame's onIntent prop
   */
  handleIntent: (
    intent: MCPUIIntent,
    context?: MCPUIIntentContext,
  ) => void | Promise<void>;
}

// ============================================
// Component Props Types
// ============================================

/**
 * Props for MCPUIFrame component
 */
export interface MCPUIFrameProps {
  /** UI resource to render */
  resource: MCPUIResource;
  /**
   * Callback when UI emits an intent
   * @param intent The intent from the UI
   */
  onIntent?: (intent: MCPUIIntent) => void;
  /**
   * Callback when an error occurs
   * @param error The error
   */
  onError?: (error: Error) => void;
  /**
   * Callback when iframe loads
   */
  onLoad?: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /**
   * Override default sandbox permissions
   * @default "allow-scripts allow-forms"
   */
  sandbox?: string;
  /**
   * Whether to show a loading state while iframe loads
   * @default true
   */
  showLoading?: boolean;
  /**
   * Test ID for testing
   */
  testId?: string;
}

// ============================================
// Utility Types
// ============================================

/**
 * Type guard for MCPUIResourceContent
 */
export function isMCPUIResourceContent(
  content: unknown,
): content is MCPUIResourceContent {
  return (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    (content as MCPUIResourceContent).type === "ui" &&
    "resource" in content
  );
}

/**
 * Type guard for MCPUIIntent
 */
export function isMCPUIIntent(data: unknown): data is MCPUIIntent {
  if (typeof data !== "object" || data === null) return false;

  const intent = data as { type?: string };
  return (
    intent.type === "tool" ||
    intent.type === "intent" ||
    intent.type === "prompt" ||
    intent.type === "notify" ||
    intent.type === "link"
  );
}

/**
 * Type guard for MCPUIMessage (postMessage envelope)
 */
export function isMCPUIMessage(data: unknown): data is MCPUIMessage {
  if (typeof data !== "object" || data === null) return false;

  const message = data as MCPUIMessage;
  // Accept messages with source: "mcp-ui" OR direct intents
  if (message.source === "mcp-ui" && message.intent) {
    return isMCPUIIntent(message.intent);
  }
  // Also accept direct intents without envelope
  return isMCPUIIntent(data);
}

/**
 * Parse a postMessage event data to MCPUIIntent
 * Returns null if the data is not a valid MCP-UI message
 */
export function parseMCPUIMessage(data: unknown): MCPUIIntent | null {
  // Check for envelope format
  if (
    typeof data === "object" &&
    data !== null &&
    "source" in data &&
    (data as MCPUIMessage).source === "mcp-ui"
  ) {
    const message = data as MCPUIMessage;
    return isMCPUIIntent(message.intent) ? message.intent : null;
  }

  // Check for direct intent format
  if (isMCPUIIntent(data)) {
    return data;
  }

  return null;
}

/**
 * Default iframe sandbox permissions
 * Provides a secure default that allows interactivity
 */
export const DEFAULT_MCP_UI_SANDBOX = "allow-scripts allow-forms";

/**
 * Restricted sandbox for untrusted content
 * More secure but limits functionality
 */
export const RESTRICTED_MCP_UI_SANDBOX = "allow-scripts";
