"use client";

/**
 * SkillContext — React context holding the client-side SkillRegistry
 */

import { createContext, useContext } from "react";
import type { SkillRegistry } from "../../skill-system/registry";
import type { ResolvedSkill } from "../../skill-system/types";

export interface SkillContextValue {
  registry: SkillRegistry;
  /** Register a skill and trigger re-render */
  register: (skill: ResolvedSkill) => void;
  /** Unregister a skill by name and trigger re-render */
  unregister: (name: string) => void;
  /** Reactive snapshot of all registered skills */
  skills: ResolvedSkill[];
}

export const SkillContext = createContext<SkillContextValue | null>(null);

export function useSkillContext(): SkillContextValue {
  const ctx = useContext(SkillContext);
  if (!ctx) {
    throw new Error("useSkillContext must be used within <SkillProvider>");
  }
  return ctx;
}

/** Returns null instead of throwing when used outside SkillProvider */
export function useSkillContextOptional(): SkillContextValue | null {
  return useContext(SkillContext);
}
