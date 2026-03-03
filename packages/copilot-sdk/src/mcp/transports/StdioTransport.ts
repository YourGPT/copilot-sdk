/**
 * Stdio Transport for MCP
 *
 * Implements stdio transport for local MCP servers.
 * This transport spawns a child process and communicates via stdin/stdout.
 *
 * NOTE: This transport only works in Node.js environments (server-side).
 * It will not work in browser environments.
 */

import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcMessage,
} from "../types";
import { MCPError, JSON_RPC_ERROR_CODES } from "../types";
import { BaseTransport, type StdioTransportOptions } from "./types";

// Dynamic import type for Node.js child_process
type ChildProcess = {
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  kill: (signal?: string) => boolean;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

type SpawnFunction = (
  command: string,
  args?: string[],
  options?: {
    env?: Record<string, string>;
    cwd?: string;
    stdio?: string[];
  },
) => ChildProcess;

/**
 * Stdio Transport
 *
 * Spawns a local MCP server process and communicates via stdin/stdout
 * using newline-delimited JSON.
 *
 * @example
 * ```typescript
 * const transport = new StdioTransport({
 *   command: "npx",
 *   args: ["-y", "@anthropic/filesystem-mcp-server", "/path/to/dir"],
 * });
 *
 * await transport.connect();
 * await transport.send({ jsonrpc: "2.0", method: "initialize", ... });
 * ```
 */
export class StdioTransport extends BaseTransport {
  private command: string;
  private args: string[];
  private env?: Record<string, string>;
  private cwd?: string;
  private process?: ChildProcess;
  private buffer = "";
  private spawn?: SpawnFunction;

  constructor(options: StdioTransportOptions) {
    super();
    this.command = options.command;
    this.args = options.args ?? [];
    this.env = options.env;
    this.cwd = options.cwd;
  }

  /**
   * Connect by spawning the MCP server process
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Check if we're in a Node.js environment
    if (typeof process === "undefined" || typeof require === "undefined") {
      throw new MCPError(
        "Stdio transport is only available in Node.js environments",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    try {
      // Dynamically import child_process (only available in Node.js)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const childProcess = require("child_process");
      this.spawn = childProcess.spawn;

      // Build environment, filtering out undefined values
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }
      if (this.env) {
        Object.assign(env, this.env);
      }

      // Spawn the MCP server process
      this.process = this.spawn!(this.command, this.args, {
        env,
        cwd: this.cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (!this.process.stdin || !this.process.stdout) {
        throw new MCPError(
          "Failed to create stdio pipes",
          JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        );
      }

      // Handle stdout data
      this.process.stdout.on("data", (data: Buffer) => {
        this.handleData(data.toString());
      });

      // Handle stderr (log for debugging)
      this.process.stderr?.on("data", (data: Buffer) => {
        console.error(`[MCP ${this.command}] ${data.toString()}`);
      });

      // Handle process errors
      this.process.on("error", (err: unknown) => {
        const error = err as Error;
        this.emitError(new MCPError(`Process error: ${error.message}`));
      });

      // Handle process exit
      this.process.on("exit", (...args: unknown[]) => {
        const code = args[0] as number | null;
        if (this.connected) {
          this.connected = false;
          if (code !== 0 && code !== null) {
            this.emitError(new MCPError(`Process exited with code ${code}`));
          }
          this.emitClose();
        }
      });

      // Wait a bit for process to initialize
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new MCPError("Process startup timeout"));
        }, 10000);

        // Consider connected once we have the process running
        // The actual MCP initialization happens at a higher level
        setTimeout(() => {
          clearTimeout(timeout);
          this.connected = true;
          resolve();
        }, 100);
      });
    } catch (error) {
      throw error instanceof MCPError
        ? error
        : new MCPError(
            `Failed to spawn process: ${error instanceof Error ? error.message : "Unknown error"}`,
            JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
          );
    }
  }

  /**
   * Disconnect by killing the process
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = undefined;
    }
    this.buffer = "";
    this.connected = false;
    this.emitClose();
  }

  /**
   * Send a JSON-RPC message via stdin
   */
  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    if (!this.connected || !this.process?.stdin) {
      throw new MCPError(
        "Transport not connected",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    // Serialize message with newline delimiter
    const data = JSON.stringify(message) + "\n";

    return new Promise((resolve, reject) => {
      const stdin = this.process!.stdin as NodeJS.WritableStream;
      stdin.write(data, (error) => {
        if (error) {
          reject(
            new MCPError(
              `Write error: ${error.message}`,
              JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming data from stdout
   */
  private handleData(data: string): void {
    this.buffer += data;

    // Process complete lines (newline-delimited JSON)
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);
        if (this.isValidJsonRpcMessage(message)) {
          this.emitMessage(message);
        }
      } catch (error) {
        // Log but don't crash on parse errors
        console.warn("Failed to parse stdio message:", error);
      }
    }
  }

  /**
   * Validate a JSON-RPC message
   */
  private isValidJsonRpcMessage(msg: unknown): msg is JsonRpcMessage {
    if (!msg || typeof msg !== "object") {
      return false;
    }

    const m = msg as Record<string, unknown>;
    if (m.jsonrpc !== "2.0") {
      return false;
    }

    // Request or notification
    if ("method" in m && typeof m.method === "string") {
      return true;
    }

    // Response
    if ("id" in m && ("result" in m || "error" in m)) {
      return true;
    }

    return false;
  }
}
