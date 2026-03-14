"use client";

/**
 * useSkillStatus — observe the current skill registry state
 *
 * Returns a reactive snapshot of registered skills.
 * Must be used inside <SkillProvider>.
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const { skills, count, has } = useSkillStatus();
 *
 *   return (
 *     <div>
 *       <p>{count} skill(s) registered</p>
 *       {has("code-review") && <p>Code review skill active</p>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback } from "react";
import { useSkillContext } from "../skill/SkillContext";
import type { ResolvedSkill } from "../../skill-system/types";

export interface UseSkillStatusReturn {
  /** All currently registered skills */
  skills: ResolvedSkill[];
  /** Number of registered skills */
  count: number;
  /** Check if a skill with the given name is registered */
  has: (name: string) => boolean;
}

export function useSkillStatus(): UseSkillStatusReturn {
  const { skills, registry } = useSkillContext();

  const has = useCallback(
    (name: string) => registry.has(name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skills],
  );

  return {
    skills,
    count: skills.length,
    has,
  };
}
