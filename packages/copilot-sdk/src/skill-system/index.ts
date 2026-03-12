/**
 * Skills — framework-agnostic core
 * Re-exported via @yourgpt/copilot-sdk/server entry point
 */

export { loadSkills } from "./load-skills";
export { SkillRegistry } from "./registry";
export { parseSkillFile } from "./frontmatter";
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
} from "./types";
