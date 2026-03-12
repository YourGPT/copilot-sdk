/**
 * defineSkill — type-safe skill factory
 *
 * Identity function with type inference. Same pattern as useTool.
 *
 * @example
 * ```ts
 * const brandVoice = defineSkill({
 *   name: "brand-voice",
 *   description: "Ensures responses match our brand tone",
 *   strategy: "eager",
 *   source: {
 *     type: "inline",
 *     content: "Always respond in a friendly, concise tone...",
 *   },
 * });
 *
 * // Use in SkillProvider
 * <SkillProvider skills={[brandVoice]}>
 *   <App />
 * </SkillProvider>
 * ```
 */

import type { SkillDefinition } from "../../skill-system/types";

export function defineSkill(def: SkillDefinition): SkillDefinition {
  return def;
}
