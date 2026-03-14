/**
 * Frontmatter parser for skill .md files
 *
 * Parses YAML-like frontmatter blocks delimited by ---
 * Supports single-line scalars only (no external YAML dependency).
 *
 * Example skill file:
 * ---
 * name: code-review
 * description: Performs thorough code reviews
 * strategy: auto
 * version: 1.0.0
 * ---
 *
 * ## Instructions
 * When reviewing code...
 */

export interface ParsedFrontmatter {
  name?: string;
  description?: string;
  strategy?: string;
  version?: string;
}

export interface ParsedSkillFile {
  frontmatter: ParsedFrontmatter;
  content: string;
}

/**
 * Parse a skill markdown file.
 * Extracts frontmatter fields and returns the body content (without --- block).
 */
export function parseSkillFile(raw: string): ParsedSkillFile {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = frontmatterRegex.exec(raw);

  if (!match) {
    return { frontmatter: {}, content: raw.trim() };
  }

  const frontmatterBlock = match[1];
  const frontmatter = parseFrontmatterBlock(frontmatterBlock);

  // Content is everything after the closing ---
  const afterFrontmatter = raw.slice(match.index + match[0].length);
  const content = afterFrontmatter.replace(/^\r?\n/, "").trim();

  return { frontmatter, content };
}

/**
 * Parse individual frontmatter key: value pairs (single-line scalars only).
 */
function parseFrontmatterBlock(block: string): ParsedFrontmatter {
  const result: ParsedFrontmatter = {};
  const lines = block.split(/\r?\n/);

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (!key || !value) continue;

    // Only accept known keys, ignore others
    switch (key) {
      case "name":
        result.name = stripQuotes(value);
        break;
      case "description":
        result.description = stripQuotes(value);
        break;
      case "strategy":
        result.strategy = stripQuotes(value);
        break;
      case "version":
        result.version = stripQuotes(value);
        break;
    }
  }

  return result;
}

/** Strip optional surrounding quotes from a YAML scalar value */
function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
