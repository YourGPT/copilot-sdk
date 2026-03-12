/**
 * SkillRegistry — manages registered skills
 *
 * Shared between server (loadSkills) and client (SkillProvider).
 * Framework-agnostic — no React dependencies.
 */

import type { ResolvedSkill, SkillStrategy } from "./types";

export class SkillRegistry {
  private skills = new Map<string, ResolvedSkill>();

  /**
   * Register a skill. Silently overwrites if name already exists.
   * Use collision detection in loadSkills() instead.
   */
  register(skill: ResolvedSkill): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * Unregister a skill by name.
   */
  unregister(name: string): void {
    this.skills.delete(name);
  }

  /**
   * Get a skill by name.
   */
  get(name: string): ResolvedSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all registered skills.
   */
  getAll(): ResolvedSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get all skills with strategy === "eager".
   * These are injected directly into the system prompt.
   */
  getEager(): ResolvedSkill[] {
    return this.getAll().filter((s) => this.resolveStrategy(s) === "eager");
  }

  /**
   * Get all skills with strategy === "auto".
   * These appear in the catalog and are loadable on demand.
   */
  getAuto(): ResolvedSkill[] {
    return this.getAll().filter((s) => this.resolveStrategy(s) === "auto");
  }

  /**
   * Check if a skill is registered.
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Number of registered skills.
   */
  get count(): number {
    return this.skills.size;
  }

  /**
   * Build a skill catalog string for "auto" skills.
   * Appended to the system prompt so the AI can discover available skills.
   */
  buildCatalog(): string {
    const autoSkills = this.getAuto();
    if (autoSkills.length === 0) return "";

    const lines = autoSkills.map((s) => `- ${s.name}: ${s.description}`);
    return `Available skills:\n${lines.join("\n")}`;
  }

  /**
   * Concatenate content of all "eager" skills.
   * These instructions are always active without requiring load_skill.
   */
  buildEagerContent(): string {
    const eagerSkills = this.getEager();
    if (eagerSkills.length === 0) return "";

    return eagerSkills
      .map((s) => `## Skill: ${s.name}\n\n${s.content}`)
      .join("\n\n---\n\n");
  }

  /**
   * Resolve content for a skill by name.
   * For inline/file/url skills, content is already resolved at registration time.
   */
  async resolveContent(name: string): Promise<string | undefined> {
    const skill = this.skills.get(name);
    return skill?.content;
  }

  private resolveStrategy(skill: ResolvedSkill): SkillStrategy {
    return skill.strategy ?? "auto";
  }
}
