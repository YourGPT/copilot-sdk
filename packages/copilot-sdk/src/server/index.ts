/**
 * @yourgpt/copilot-sdk/server
 *
 * Server-only exports. Do NOT import in browser/React code.
 */

// Context Management — server-side compaction
export { compactSession } from "./compact-session";
export type {
  CompactSessionOptions,
  CompactSessionResult,
} from "./compact-session";
