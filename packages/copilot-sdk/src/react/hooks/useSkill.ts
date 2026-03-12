"use client";

/**
 * useSkill — register a skill from a React component
 *
 * Registers the skill on mount, unregisters on unmount.
 * Must be used inside <SkillProvider>.
 *
 * Only inline skills are supported client-side.
 * For file/url skills use loadSkills() on the server.
 *
 * @example
 * ```tsx
 * function CheckoutPage() {
 *   useSkill({
 *     name: "checkout-flow",
 *     description: "Guides the user through checkout",
 *     strategy: "auto",
 *     source: {
 *       type: "inline",
 *       content: "When helping with checkout...",
 *     },
 *   });
 *
 *   return <CheckoutUI />;
 * }
 * ```
 */

import { useEffect } from "react";
import { useSkillContext } from "../skill/SkillContext";
import type { SkillDefinition, ResolvedSkill } from "../../skill-system/types";

const DEV_CONTENT_WARN_THRESHOLD = 2000;

export function useSkill(skill: SkillDefinition): void {
  const { register, unregister } = useSkillContext();

  // Warn in development if inline content is too large
  if (
    process.env.NODE_ENV !== "production" &&
    skill.source.type === "inline" &&
    skill.source.content.length > DEV_CONTENT_WARN_THRESHOLD
  ) {
    console.warn(
      `[copilot-sdk/skills] Inline skill "${skill.name}" has ${skill.source.content.length} characters. ` +
        `Inline skills are sent on every request — keep them under ${DEV_CONTENT_WARN_THRESHOLD} characters. ` +
        `Consider using a file or URL skill instead.`,
    );
  }

  useEffect(() => {
    if (skill.source.type !== "inline") {
      console.warn(
        `[copilot-sdk/skills] useSkill only supports inline skills client-side. ` +
          `Skill "${skill.name}" has source type "${skill.source.type}" and will be skipped.`,
      );
      return;
    }

    const resolved: ResolvedSkill = {
      ...skill,
      content: skill.source.content,
    };

    register(resolved);

    return () => {
      unregister(skill.name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    skill.name,
    skill.source.type === "inline" ? skill.source.content : "",
    skill.strategy,
    skill.description,
  ]);
}
