/**
 * @yourgpt/copilot-sdk/server
 *
 * Server-only exports for the Skills System.
 * Do NOT import this in browser/React code — it uses Node.js fs module.
 *
 * @example
 * ```typescript
 * import { loadSkills } from '@yourgpt/copilot-sdk/server';
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
