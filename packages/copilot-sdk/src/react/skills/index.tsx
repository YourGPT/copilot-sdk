"use client";

/**
 * Skills System
 *
 * Skills are on-demand instruction sets that the AI can load at runtime.
 * - "eager" skills inject their content immediately into AI context
 * - "auto" skills appear in a catalog; AI calls load_skill() to fetch content
 */

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { useCopilot } from "../provider/CopilotProvider";
import { logOnce } from "../../core/utils/logger";
import { useAIContext } from "../hooks/useAIContext";
import { useTool } from "../hooks/useTool";

// ============================================================
// Types
// ============================================================

export interface SkillSource {
  type: "inline";
  content: string;
}

export type SkillStrategy = "eager" | "auto";

export interface SkillDefinition {
  name: string;
  description: string;
  strategy: SkillStrategy;
  source: SkillSource;
}

// ============================================================
// defineSkill — pure factory
// ============================================================

export function defineSkill(config: SkillDefinition): SkillDefinition {
  return config;
}

// ============================================================
// SkillContext — shared registry inside SkillProvider
// ============================================================

interface SkillRegistryEntry {
  skill: SkillDefinition;
  /** reference count — multiple useSkill calls for same skill */
  count: number;
}

interface SkillContextValue {
  registerSkill: (skill: SkillDefinition) => void;
  unregisterSkill: (name: string) => void;
  getSkill: (name: string) => SkillDefinition | undefined;
}

const SkillContext = createContext<SkillContextValue | null>(null);

function useSkillContext(): SkillContextValue {
  const ctx = useContext(SkillContext);
  if (!ctx) throw new Error("useSkill must be used within SkillProvider");
  return ctx;
}

// ============================================================
// SkillContextInjector — injects skill content into AI context
// (one per skill, rendered inside SkillProvider)
// ============================================================

function EagerSkillInjector({ skill }: { skill: SkillDefinition }) {
  useAIContext({
    key: `__skill_eager__:${skill.name}`,
    data: skill.source.content,
    description: `Skill [${skill.name}]`,
  });
  return null;
}

// ============================================================
// LoadSkillTool — registers the load_skill tool when there are
// any "auto" skills in the registry
// ============================================================

function LoadSkillTool({
  registryRef,
  registryVersion,
}: {
  registryRef: React.MutableRefObject<Map<string, SkillRegistryEntry>>;
  registryVersion: number;
}) {
  const { addContext, removeContext } = useCopilot();
  const catalogContextIdRef = useRef<string | null>(null);

  // Build catalog string from current auto skills
  const buildCatalog = useCallback((): string => {
    const autoSkills = Array.from(registryRef.current.values())
      .map((e) => e.skill)
      .filter((s) => s.strategy === "auto");
    if (autoSkills.length === 0) return "";
    const lines = autoSkills
      .map((s) => `- ${s.name}: ${s.description}`)
      .join("\n");
    return `You have access to specialized skills. Call load_skill with the skill name to load instructions.\nAvailable skills:\n${lines}`;
  }, [registryRef]);

  // Refresh catalog context whenever registry changes
  const refreshCatalog = useCallback(() => {
    if (catalogContextIdRef.current) {
      removeContext(catalogContextIdRef.current);
      catalogContextIdRef.current = null;
    }
    const catalog = buildCatalog();
    if (catalog) {
      catalogContextIdRef.current = addContext(catalog);
    }
  }, [addContext, removeContext, buildCatalog]);

  // Re-run whenever registry changes (registryVersion increments on register/unregister)
  useEffect(() => {
    refreshCatalog();
    return () => {
      if (catalogContextIdRef.current) {
        removeContext(catalogContextIdRef.current);
        catalogContextIdRef.current = null;
      }
    };
  }, [registryVersion, refreshCatalog, removeContext]);

  // Register load_skill tool
  useTool({
    name: "load_skill",
    description:
      "Load specialized instructions for a task. Call this when you need detailed guidance on a specific domain.",
    hidden: false,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the skill to load",
        },
      },
      required: ["name"],
    },
    handler: async ({ name }: { name: string }) => {
      const registryKeys = Array.from(registryRef.current.keys());
      logOnce("skills", true, `load_skill called: ${name}`, {
        registry: registryKeys,
      });
      const entry = registryRef.current.get(name);
      if (!entry) {
        const available = registryKeys.join(", ");
        logOnce("skills", true, `load_skill NOT FOUND: ${name}`, {
          size: registryRef.current.size,
          keys: registryKeys,
        });
        return {
          success: false,
          error: `Skill "${name}" not found. Available: ${available || "none"}`,
        };
      }
      return {
        success: true,
        name: entry.skill.name,
        description: entry.skill.description,
        result: entry.skill.source.content,
      };
    },
  });

  return null;
}

// ============================================================
// SkillProvider
// ============================================================

export interface SkillProviderProps {
  children: React.ReactNode;
  /** Skills to register at mount (typically eager ones) */
  skills?: SkillDefinition[];
}

export function SkillProvider({ children, skills = [] }: SkillProviderProps) {
  const registryRef = useRef<Map<string, SkillRegistryEntry>>(new Map());
  const [registryVersion, setRegistryVersion] = React.useState(0);
  const rerender = useCallback(() => setRegistryVersion((n) => n + 1), []);

  const registerSkill = useCallback(
    (skill: SkillDefinition) => {
      const existing = registryRef.current.get(skill.name);
      if (existing) {
        existing.count += 1;
      } else {
        registryRef.current.set(skill.name, { skill, count: 1 });
        rerender();
      }
    },
    [rerender],
  );

  const unregisterSkill = useCallback(
    (name: string) => {
      const existing = registryRef.current.get(name);
      if (!existing) return;
      existing.count -= 1;
      if (existing.count <= 0) {
        registryRef.current.delete(name);
        rerender();
      }
    },
    [rerender],
  );

  const getSkill = useCallback((name: string) => {
    return registryRef.current.get(name)?.skill;
  }, []);

  // Register initial skills on mount
  useEffect(() => {
    for (const skill of skills) {
      registerSkill(skill);
    }
    return () => {
      for (const skill of skills) {
        unregisterSkill(skill.name);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Collect current registry snapshot for rendering
  const entries = Array.from(registryRef.current.values());
  const eagerSkills = entries.filter((e) => e.skill.strategy === "eager");

  return (
    <SkillContext.Provider value={{ registerSkill, unregisterSkill, getSkill }}>
      {/* Inject eager skill content into AI context */}
      {eagerSkills.map((e) => (
        <EagerSkillInjector key={e.skill.name} skill={e.skill} />
      ))}
      {/* Register load_skill tool + catalog context */}
      <LoadSkillTool
        registryRef={registryRef}
        registryVersion={registryVersion}
      />
      {children}
    </SkillContext.Provider>
  );
}

// ============================================================
// useSkill — register a skill on mount, unregister on unmount
// ============================================================

export function useSkill(skill: SkillDefinition): void {
  const { registerSkill, unregisterSkill } = useSkillContext();

  useEffect(() => {
    registerSkill(skill);
    return () => {
      unregisterSkill(skill.name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.name]);
}
