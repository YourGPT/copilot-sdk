/**
 * Copilot SDK Logger
 *
 * Simple debug logger with console grouping support.
 *
 * Usage:
 *   debug={true}   → enable all logs
 *   debug={false}  → silent (default)
 *
 * Runtime toggle from browser console (no rebuild needed):
 *   window.__COPILOT_DEBUG = true
 *   window.__COPILOT_DEBUG = false
 */

// ─── Types ─────────────────────────────────────────────────────────────────

/** Well-known log scopes — used internally as labels, not exposed to the user. */
type LogScope = "streaming" | "tools" | "provider" | string;

/** Debug config accepted by CopilotProvider. true = on, false = off. */
export type DebugConfig = boolean;

declare global {
  interface Window {
    __COPILOT_DEBUG?: boolean;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isEnabled(getEnabled: () => boolean): boolean {
  if (typeof window !== "undefined" && window.__COPILOT_DEBUG !== undefined) {
    return !!window.__COPILOT_DEBUG;
  }
  return getEnabled();
}

// ─── Factory ───────────────────────────────────────────────────────────────

export interface ScopedLogger {
  /** Log a message with optional data */
  (action: string, data?: unknown): void;
  /** Open a collapsible group — all subsequent logs nest inside until groupEnd() */
  group(label: string): void;
  /** Open a collapsed group (hidden by default in DevTools) */
  groupCollapsed(label: string): void;
  /** Close the most recently opened group */
  groupEnd(): void;
}

/**
 * Create a scoped logger bound to a specific namespace.
 *
 * @param scope      - Label shown in brackets, e.g. "streaming", "tools"
 * @param getEnabled - Returns whether debug logging is currently on
 *
 * @example
 * const log = createLogger("streaming", () => this.config.debug ?? false);
 * log("sendMessage", { content });
 * // → [streaming] sendMessage { content: '...' }
 *
 * log.groupCollapsed("Stream #1");
 * log("chunk", { type: "message:start" });  // nested inside group
 * log.groupEnd();
 */
/**
 * One-shot log — for cases where you don't keep a persistent logger.
 */
export function logOnce(
  scope: LogScope,
  enabled: boolean,
  action: string,
  data?: unknown,
): void {
  if (!isEnabled(() => enabled)) return;
  const prefix = `[${scope}]`;
  if (data !== undefined) {
    console.log(prefix, action, data);
  } else {
    console.log(prefix, action);
  }
}

export function createLogger(
  scope: LogScope,
  getEnabled: () => boolean,
): ScopedLogger {
  const prefix = `[${scope}]`;

  function log(action: string, data?: unknown): void {
    if (!isEnabled(getEnabled)) return;
    if (data !== undefined) {
      console.log(prefix, action, data);
    } else {
      console.log(prefix, action);
    }
  }

  log.group = function (label: string): void {
    if (!isEnabled(getEnabled)) return;
    console.group(`${prefix} ${label}`);
  };

  log.groupCollapsed = function (label: string): void {
    if (!isEnabled(getEnabled)) return;
    console.groupCollapsed(`${prefix} ${label}`);
  };

  log.groupEnd = function (): void {
    if (!isEnabled(getEnabled)) return;
    console.groupEnd();
  };

  return log;
}
