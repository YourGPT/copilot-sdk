"use client";

/**
 * SkillProvider — React provider for the client-side skill system
 *
 * Responsibilities:
 * 1. Creates and holds a client SkillRegistry
 * 2. Pre-registers skills passed as props
 * 3. Injects skill catalog into AI context (useAIContext)
 * 4. Registers the load_skill tool (useTool)
 * 5. Exposes SkillContext for useSkill() hooks
 *
 * Must be placed inside <CopilotProvider>.
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { SkillRegistry } from "../../skill-system/registry";
import type { SkillDefinition, ResolvedSkill } from "../../skill-system/types";
import { SkillContext } from "./SkillContext";
import { useAIContext } from "../hooks/useAIContext";
import { useTool } from "../hooks/useTool";
import { useCopilot } from "../provider/CopilotProvider";

// ============================================
// Types
// ============================================

export interface SkillProviderProps {
  children: React.ReactNode;
  /** Pre-register skills (eager or auto strategies) */
  skills?: SkillDefinition[];
  /**
   * Future: URL to fetch a remote skill manifest
   * @experimental
   */
  remoteManifest?: string;
}

// ============================================
// Internal: Context injectors and tool registrar
// Must be separate components to call hooks at top level
// ============================================

function SkillContextInjector({
  registry,
  skills,
}: {
  registry: SkillRegistry;
  skills: ResolvedSkill[];
}) {
  const catalog = useMemo(() => registry.buildCatalog(), [skills]);
  const eagerContent = useMemo(() => registry.buildEagerContent(), [skills]);

  // Inject auto skill catalog into AI context
  useAIContext({
    key: "__skill_catalog__",
    description: "Skills the AI can load on demand",
    data: catalog
      ? `You have access to specialized skills. Call load_skill({ name }) when relevant.\n\n${catalog}`
      : "",
  });

  // Inject eager skill content (always active)
  useAIContext({
    key: "__skill_eager__",
    description: "Always-active skill instructions",
    data: eagerContent,
  });

  return null;
}

function SkillRequestSync({ skills }: { skills: ResolvedSkill[] }) {
  const { setInlineSkills } = useCopilot();

  useEffect(() => {
    const inlineSkills = skills
      .filter((s) => s.source.type === "inline")
      .map((s) => ({
        name: s.name,
        description: s.description,
        content: s.content,
        strategy: s.strategy,
      }));
    setInlineSkills(inlineSkills);
  }, [skills, setInlineSkills]);

  return null;
}

function SkillToolRegistrar({
  registry,
  skills,
}: {
  registry: SkillRegistry;
  skills: ResolvedSkill[];
}) {
  useTool(
    {
      name: "load_skill",
      description:
        "Load a skill by name to get full instructions for a specialized task.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the skill to load.",
          },
        },
        required: ["name"],
      },
      handler: async ({ name }: { name: string }) => {
        const skill = registry.get(name);
        if (!skill) {
          const available =
            registry
              .getAuto()
              .map((s) => s.name)
              .join(", ") || "none";
          return {
            success: false,
            error: `Skill "${name}" not found. Available skills: ${available}`,
          };
        }
        const sourceTypeMap = {
          inline: "client-inline",
          url: "remote-url",
          file: "server-dir",
        } as const;
        return {
          success: true,
          name: skill.name,
          description: skill.description,
          strategy: skill.strategy ?? "auto",
          content: skill.content,
          source: sourceTypeMap[skill.source.type],
        };
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skills],
  );

  return null;
}

// ============================================
// Main SkillProvider
// ============================================

export function SkillProvider({
  children,
  skills: skillsProp,
}: SkillProviderProps) {
  // Stable registry instance
  const registryRef = useRef<SkillRegistry | null>(null);
  if (registryRef.current === null) {
    registryRef.current = new SkillRegistry();
  }
  const registry = registryRef.current;

  // Reactive skills snapshot (triggers re-renders when skills change)
  const [skills, setSkills] = useState<ResolvedSkill[]>([]);

  // Register skills passed as props
  useEffect(() => {
    if (!skillsProp?.length) return;

    for (const def of skillsProp) {
      if (def.source.type !== "inline") {
        // url/file skills need content resolved — not supported client-side
        console.warn(
          `[copilot-sdk/skills] Client-side SkillProvider only supports inline skills. ` +
            `Skill "${def.name}" has source type "${def.source.type}" and will be skipped. ` +
            `Use loadSkills() on the server for file/url skills.`,
        );
        continue;
      }

      const resolved: ResolvedSkill = {
        ...def,
        content: def.source.content,
      };

      registry.register(resolved);
    }

    setSkills(registry.getAll());

    // Cleanup prop-provided skills on unmount or prop change
    return () => {
      for (const def of skillsProp ?? []) {
        registry.unregister(def.name);
      }
      setSkills(registry.getAll());
    };
  }, [skillsProp]);

  // Context-exposed register/unregister (for useSkill hook)
  const register = useCallback((skill: ResolvedSkill) => {
    registry.register(skill);
    setSkills(registry.getAll());
  }, []);

  const unregister = useCallback((name: string) => {
    registry.unregister(name);
    setSkills(registry.getAll());
  }, []);

  const contextValue = useMemo(
    () => ({ registry, register, unregister, skills }),
    [register, unregister, skills],
  );

  return (
    <SkillContext.Provider value={contextValue}>
      <SkillContextInjector registry={registry} skills={skills} />
      <SkillToolRegistrar registry={registry} skills={skills} />
      <SkillRequestSync skills={skills} />
      {children}
    </SkillContext.Provider>
  );
}
