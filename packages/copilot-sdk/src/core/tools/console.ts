/**
 * Console Log Capture Tool
 *
 * Intercepts console methods to capture logs for AI analysis.
 * Framework-agnostic implementation.
 */

import type {
  ConsoleLogType,
  ConsoleLogEntry,
  ConsoleLogOptions,
  ConsoleLogResult,
} from "./types";

// Check if we're in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof console !== "undefined";

// Store for captured logs
let capturedLogs: ConsoleLogEntry[] = [];
let isCapturing = false;
let captureOptions: Required<ConsoleLogOptions>;

// Original console methods
const originalMethods: Record<ConsoleLogType, (...args: unknown[]) => void> = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

/**
 * Default capture options
 */
const DEFAULT_OPTIONS: Required<ConsoleLogOptions> = {
  types: ["log", "info", "warn", "error", "debug"],
  limit: 100,
  filter: () => true,
};

/**
 * Convert arguments to a readable message string
 */
function argsToMessage(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg === null) return "null";
      if (arg === undefined) return "undefined";
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

/**
 * Extract stack trace from an error or create one
 */
function getStackTrace(): string | undefined {
  try {
    const error = new Error();
    const stack = error.stack?.split("\n").slice(3).join("\n"); // Skip internal frames
    return stack;
  } catch {
    return undefined;
  }
}

/**
 * Create a console interceptor for a specific method
 */
function createInterceptor(type: ConsoleLogType) {
  return (...args: unknown[]) => {
    // Call original method
    originalMethods[type].apply(console, args);

    // Skip if not capturing this type
    if (!captureOptions.types.includes(type)) {
      return;
    }

    // Create log entry
    const entry: ConsoleLogEntry = {
      type,
      message: argsToMessage(args),
      args: args.length > 1 ? args : undefined,
      timestamp: Date.now(),
    };

    // Add stack trace for errors
    if (type === "error" || type === "warn") {
      entry.stack = getStackTrace();
    }

    // Check if first arg is an Error
    if (args[0] instanceof Error) {
      entry.stack = args[0].stack;
    }

    // Apply filter
    if (!captureOptions.filter(entry)) {
      return;
    }

    // Add to captured logs
    capturedLogs.push(entry);

    // Enforce limit
    while (capturedLogs.length > captureOptions.limit) {
      capturedLogs.shift();
    }
  };
}

/**
 * Start capturing console logs
 *
 * @param options - Capture options
 *
 * @example
 * ```typescript
 * // Start capturing all logs
 * startConsoleCapture();
 *
 * // Capture only errors and warnings
 * startConsoleCapture({ types: ['error', 'warn'] });
 *
 * // Custom filter
 * startConsoleCapture({
 *   filter: (entry) => !entry.message.includes('[HMR]')
 * });
 * ```
 */
export function startConsoleCapture(options: ConsoleLogOptions = {}): void {
  if (!isBrowser) {
    console.warn("Console capture is only available in browser environment");
    return;
  }

  if (isCapturing) {
    console.warn("Console capture already active");
    return;
  }

  captureOptions = { ...DEFAULT_OPTIONS, ...options };
  isCapturing = true;

  // Override console methods
  (Object.keys(originalMethods) as ConsoleLogType[]).forEach((type) => {
    console[type] = createInterceptor(type);
  });
}

/**
 * Stop capturing console logs
 */
export function stopConsoleCapture(): void {
  if (!isCapturing) {
    return;
  }

  isCapturing = false;

  // Restore original methods
  (Object.keys(originalMethods) as ConsoleLogType[]).forEach((type) => {
    console[type] = originalMethods[type];
  });
}

/**
 * Get captured console logs
 *
 * @param options - Filter options
 * @returns Captured log entries
 *
 * @example
 * ```typescript
 * // Get all captured logs
 * const { logs } = getConsoleLogs();
 *
 * // Get only errors from last minute
 * const { logs } = getConsoleLogs({
 *   types: ['error'],
 *   filter: (entry) => entry.timestamp > Date.now() - 60000
 * });
 * ```
 */
export function getConsoleLogs(
  options: ConsoleLogOptions = {},
): ConsoleLogResult {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    types: options.types ?? DEFAULT_OPTIONS.types,
    limit: options.limit ?? DEFAULT_OPTIONS.limit,
  };

  let logs = [...capturedLogs];

  // Filter by type
  if (opts.types.length < Object.keys(originalMethods).length) {
    logs = logs.filter((entry) => opts.types.includes(entry.type));
  }

  // Apply custom filter
  if (opts.filter !== DEFAULT_OPTIONS.filter) {
    logs = logs.filter(opts.filter);
  }

  // Apply limit
  const totalCaptured = logs.length;
  logs = logs.slice(-opts.limit);

  return {
    logs,
    totalCaptured,
  };
}

/**
 * Clear captured console logs
 */
export function clearConsoleLogs(): void {
  capturedLogs = [];
}

/**
 * Check if console capture is active
 */
export function isConsoleCaptureActive(): boolean {
  return isCapturing;
}

/**
 * Get console errors only (convenience function)
 */
export function getConsoleErrors(limit = 50): ConsoleLogEntry[] {
  return getConsoleLogs({
    types: ["error"],
    limit,
  }).logs;
}

/**
 * Get console warnings only (convenience function)
 */
export function getConsoleWarnings(limit = 50): ConsoleLogEntry[] {
  return getConsoleLogs({
    types: ["warn"],
    limit,
  }).logs;
}

/**
 * Format console logs for AI context
 *
 * @param logs - Log entries to format
 * @returns Formatted string for AI consumption
 */
export function formatLogsForAI(logs: ConsoleLogEntry[]): string {
  if (logs.length === 0) {
    return "No console logs captured.";
  }

  const formatted = logs.map((entry, index) => {
    const time = new Date(entry.timestamp).toISOString();
    const typeIcon = {
      error: "❌",
      warn: "⚠️",
      log: "📝",
      info: "ℹ️",
      debug: "🔍",
    }[entry.type];

    let text = `[${index + 1}] ${typeIcon} [${entry.type.toUpperCase()}] ${time}\n`;
    text += `    ${entry.message}`;

    if (entry.stack) {
      // Only include first few lines of stack
      const stackLines = entry.stack.split("\n").slice(0, 3);
      text += `\n    Stack:\n${stackLines.map((l) => `      ${l.trim()}`).join("\n")}`;
    }

    return text;
  });

  return `Console Logs (${logs.length} entries):\n\n${formatted.join("\n\n")}`;
}

/**
 * Create a one-time capture of current logs
 * Useful for getting logs without starting persistent capture
 */
export function captureCurrentLogs(
  options: ConsoleLogOptions = {},
): ConsoleLogResult {
  // If already capturing, just return current logs
  if (isCapturing) {
    return getConsoleLogs(options);
  }

  // Return what we have (may be empty if capture was never started)
  return getConsoleLogs(options);
}

// Auto-cleanup on page unload
if (isBrowser) {
  window.addEventListener("beforeunload", () => {
    stopConsoleCapture();
  });
}
