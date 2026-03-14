/**
 * @yourgpt/copilot-sdk/server
 *
 * Server-only exports. Do NOT import in browser/React code.
 * Uses Node.js fs module for skill file loading.
 *
 * @example
 * ```typescript
 * import { loadSkills, compactSession } from '@yourgpt/copilot-sdk/server';
 * import path from 'path';
 *
 * const { skills, buildSystemPrompt, tools } = await loadSkills({
 *   dir: path.join(process.cwd(), 'skills'),
 * });
 *
 * // In your API route handler:
 * const systemPrompt = buildSystemPrompt('You are a helpful assistant.');
 * ```
 */

// Context Management — server-side compaction
export { compactSession } from "./compact-session";
export type {
  CompactSessionOptions,
  CompactSessionResult,
} from "./compact-session";

// Skills System — server-side skill loading
export { loadSkills } from "../skill-system/load-skills";
export { SkillRegistry } from "../skill-system/registry";
export { parseSkillFile } from "../skill-system/frontmatter";

export type {
  SkillDefinition,
  SkillSource,
  SkillStrategy,
  ResolvedSkill,
  SkillDiagnostic,
  SkillDiagnosticWinner,
  ClientInlineSkill,
  LoadSkillsOptions,
  LoadSkillsResult,
  LoadSkillResult,
  LoadSkillError,
} from "../skill-system/types";
