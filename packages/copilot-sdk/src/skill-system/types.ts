/**
 * Skills System — Type Definitions
 *
 * Skills are instruction playbooks the AI loads on demand.
 * Separate from Tools (execution layer) — skills shape behavior, tools do work.
 */

export type SkillStrategy = "eager" | "auto" | "manual";

export type SkillSource =
  | { type: "inline"; content: string }
  | { type: "url"; url: string }
  | { type: "file"; path: string };

export interface SkillDefinition {
  name: string;
  description: string;
  source: SkillSource;
  /** @default "auto" */
  strategy?: SkillStrategy;
  version?: string;
}

export interface ResolvedSkill extends SkillDefinition {
  /** Fully resolved content string */
  content: string;
}

export type SkillDiagnosticWinner =
  | "server-dir"
  | "remote-url"
  | "client-inline";

export interface SkillDiagnostic {
  type: "collision";
  name: string;
  winner: SkillDiagnosticWinner;
  loser: SkillDiagnosticWinner;
}

export interface ClientInlineSkill {
  name: string;
  description: string;
  content: string;
  strategy?: SkillStrategy;
}

export interface LoadSkillsOptions {
  /** Path to /skills directory (server-only) */
  dir?: string;
  /** Remote .md URLs to fetch */
  remoteUrls?: string[];
  /** Inline skills from useSkill() hooks */
  clientSkills?: ClientInlineSkill[];
}

export interface LoadSkillsResult {
  skills: ResolvedSkill[];
  diagnostics: SkillDiagnostic[];
  /**
   * Build a complete system prompt incorporating eager + auto skill catalog.
   * Prepends eager skill content, appends auto catalog.
   */
  buildSystemPrompt(basePrompt?: string): string;
  /**
   * The load_skill tool definition ready to register with your AI framework.
   * Returns structured result: { name, description, strategy, content, source }
   */
  tools: {
    load_skill: {
      description: string;
      parameters: {
        type: "object";
        properties: { name: { type: "string"; description: string } };
        required: ["name"];
      };
      execute: (args: {
        name: string;
      }) => Promise<LoadSkillResult | LoadSkillError>;
    };
  };
}

export interface LoadSkillResult {
  name: string;
  description: string;
  strategy: SkillStrategy;
  content: string;
  source: "server-dir" | "remote-url" | "client-inline";
}

export interface LoadSkillError {
  error: string;
}
