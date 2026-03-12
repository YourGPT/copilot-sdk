/**
 * loadSkills() — Server-side skill loader
 *
 * Loads skills from three sources with precedence:
 *   server-dir > remote-url > client-inline
 *
 * Returns skills, diagnostics, buildSystemPrompt(), and the load_skill tool.
 *
 * Node.js only — uses fs and fetch.
 */

import type {
  LoadSkillsOptions,
  LoadSkillsResult,
  ResolvedSkill,
  SkillDiagnostic,
  SkillDiagnosticWinner,
  SkillStrategy,
} from "./types";
import { parseSkillFile } from "./frontmatter";
import { SkillRegistry } from "./registry";

const VALID_STRATEGIES = new Set<SkillStrategy>(["eager", "auto", "manual"]);

function isValidStrategy(s: string): s is SkillStrategy {
  return VALID_STRATEGIES.has(s as SkillStrategy);
}

/**
 * Load skills from server directory, remote URLs, and/or inline client skills.
 *
 * @example
 * ```typescript
 * import { loadSkills } from '@yourgpt/copilot-sdk/server';
 *
 * const { skills, buildSystemPrompt, tools } = await loadSkills({
 *   dir: path.join(process.cwd(), 'skills'),
 * });
 *
 * // Use in your API route
 * const systemPrompt = buildSystemPrompt('You are a helpful assistant.');
 * ```
 */
export async function loadSkills(
  options: LoadSkillsOptions = {},
): Promise<LoadSkillsResult> {
  const registry = new SkillRegistry();
  const diagnostics: SkillDiagnostic[] = [];

  // Track which names came from which source (for collision detection)
  const sourceMap = new Map<string, SkillDiagnosticWinner>();

  // ──────────────────────────────────────────────────
  // Source 1: Server directory (highest precedence)
  // ──────────────────────────────────────────────────
  if (options.dir) {
    const dirSkills = await loadFromDir(options.dir);
    for (const skill of dirSkills) {
      registry.register(skill);
      sourceMap.set(skill.name, "server-dir");
    }
  }

  // ──────────────────────────────────────────────────
  // Source 2: Remote URLs (medium precedence)
  // ──────────────────────────────────────────────────
  if (options.remoteUrls?.length) {
    const urlSkills = await loadFromUrls(options.remoteUrls);
    for (const skill of urlSkills) {
      const existingSource = sourceMap.get(skill.name);
      if (existingSource) {
        diagnostics.push({
          type: "collision",
          name: skill.name,
          winner: existingSource,
          loser: "remote-url",
        });
        continue; // Skip — lower precedence source loses
      }
      registry.register(skill);
      sourceMap.set(skill.name, "remote-url");
    }
  }

  // ──────────────────────────────────────────────────
  // Source 3: Client inline (lowest precedence)
  // ──────────────────────────────────────────────────
  if (options.clientSkills?.length) {
    for (const inline of options.clientSkills) {
      const existingSource = sourceMap.get(inline.name);
      if (existingSource) {
        diagnostics.push({
          type: "collision",
          name: inline.name,
          winner: existingSource,
          loser: "client-inline",
        });
        continue;
      }

      const skill: ResolvedSkill = {
        name: inline.name,
        description: inline.description,
        content: inline.content,
        strategy: inline.strategy ?? "auto",
        source: { type: "inline", content: inline.content },
      };
      registry.register(skill);
      sourceMap.set(inline.name, "client-inline");
    }
  }

  // ──────────────────────────────────────────────────
  // Build result
  // ──────────────────────────────────────────────────
  return {
    skills: registry.getAll(),
    diagnostics,

    buildSystemPrompt(basePrompt?: string): string {
      const parts: string[] = [];

      if (basePrompt) {
        parts.push(basePrompt);
      }

      // Prepend eager skill content (always active)
      const eagerContent = registry.buildEagerContent();
      if (eagerContent) {
        parts.push(eagerContent);
      }

      // Append auto catalog (discoverable via load_skill)
      const catalog = registry.buildCatalog();
      if (catalog) {
        parts.push(
          `You have access to specialized skills. Call load_skill({ name }) when relevant.\n\n${catalog}`,
        );
      }

      return parts.join("\n\n").trim();
    },

    tools: {
      load_skill: {
        description:
          "Load a skill by name to get full instructions for a specialized task.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the skill to load.",
            },
          },
          required: ["name"],
        },
        execute: async ({ name }: { name: string }) => {
          const skill = registry.get(name);
          if (!skill) {
            return {
              error: `Skill "${name}" not found. Available skills: ${
                registry
                  .getAuto()
                  .map((s) => s.name)
                  .join(", ") || "none"
              }`,
            };
          }
          const sourceTypeMap = {
            inline: "client-inline",
            url: "remote-url",
            file: "server-dir",
          } as const;
          return {
            name: skill.name,
            description: skill.description,
            strategy: skill.strategy ?? "auto",
            content: skill.content,
            source: sourceTypeMap[skill.source.type],
          };
        },
      },
    },
  };
}

// ──────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────

async function loadFromDir(dir: string): Promise<ResolvedSkill[]> {
  // Dynamic import to avoid bundling fs in browser builds
  const { readdir, readFile } = await import("fs/promises");
  const path = await import("path");

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    // Directory doesn't exist or unreadable — not an error
    return [];
  }

  const skills: ResolvedSkill[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry);

    if (entry.endsWith(".md")) {
      // Flat .md file
      const skill = await loadSkillFromFile(entryPath, readFile, path);
      if (skill) skills.push(skill);
    } else {
      // Check for folder-based skill: entry/SKILL.md
      const skillMdPath = path.join(entryPath, "SKILL.md");
      try {
        const skill = await loadSkillFromFile(skillMdPath, readFile, path);
        if (skill) skills.push(skill);
      } catch {
        // Not a skill folder — skip
      }
    }
  }

  return skills;
}

async function loadSkillFromFile(
  filePath: string,
  readFile: (path: string, encoding: "utf-8") => Promise<string>,
  path: { basename: (p: string, ext?: string) => string },
): Promise<ResolvedSkill | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return null;
  }

  const { frontmatter, content } = parseSkillFile(raw);

  // Derive name from frontmatter or filename
  const fileName = path.basename(filePath, ".md");
  const name =
    frontmatter.name ?? (fileName === "SKILL" ? undefined : fileName);

  if (!name) {
    console.warn(
      `[copilot-sdk/skills] Skipping skill at ${filePath}: no name in frontmatter and could not derive from filename`,
    );
    return null;
  }

  const strategy =
    frontmatter.strategy && isValidStrategy(frontmatter.strategy)
      ? frontmatter.strategy
      : "auto";

  return {
    name,
    description: frontmatter.description ?? `Skill: ${name}`,
    content,
    strategy,
    version: frontmatter.version,
    source: { type: "file", path: filePath },
  };
}

async function loadFromUrls(urls: string[]): Promise<ResolvedSkill[]> {
  const skills: ResolvedSkill[] = [];

  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(
            `[copilot-sdk/skills] Failed to fetch skill from ${url}: HTTP ${res.status}`,
          );
          return;
        }
        const raw = await res.text();
        const { frontmatter, content } = parseSkillFile(raw);

        if (!frontmatter.name) {
          console.warn(
            `[copilot-sdk/skills] Skipping remote skill at ${url}: no name in frontmatter`,
          );
          return;
        }

        const strategy =
          frontmatter.strategy && isValidStrategy(frontmatter.strategy)
            ? frontmatter.strategy
            : "auto";

        skills.push({
          name: frontmatter.name,
          description: frontmatter.description ?? `Skill: ${frontmatter.name}`,
          content,
          strategy,
          version: frontmatter.version,
          source: { type: "url", url },
        });
      } catch (err) {
        console.warn(
          `[copilot-sdk/skills] Error loading remote skill from ${url}:`,
          err,
        );
      }
    }),
  );

  return skills;
}
