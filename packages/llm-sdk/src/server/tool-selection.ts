import type {
  ToolDefinition,
  ToolProfile,
  AnthropicProviderToolOptions,
  OpenAIProviderToolOptions,
  ProviderToolRuntimeOptions,
} from "../core/stream-events";

type ToolSelectionMessage = {
  role: string;
  content?: unknown;
};

export interface ToolSearchMatch {
  name: string;
  description: string;
  location?: ToolDefinition["location"];
  category?: string;
  group?: string;
  profiles?: string[];
  searchKeywords?: string[];
  score: number;
}

export interface ResolvedNativeToolSearch {
  provider: "anthropic" | "openai";
  variant?: "bm25" | "regex";
  useResponsesApi?: boolean;
}

/**
 * Internal tool selection configuration.
 * Built by resolveEffectiveToolSelectionConfig in runtime.ts.
 * Not part of the public API.
 */
export interface InternalToolSelectionConfig {
  maxEagerTools: number;
  maxResults: number;
  exposeWhenExceeds: number;
  defaultProfile?: string;
  profiles?: Record<string, ToolProfile>;
  includeUnprofiled?: boolean;
  toolChoice?: "auto" | "required";
  parallelCalls?: boolean;
}

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const MIN_SCORE = 0.1;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function buildToolQuery(messages: ToolSelectionMessage[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-3)
    .map((m) => stringifyContent(m.content))
    .filter(Boolean)
    .join(" ");
}

function buildSearchText(tool: ToolDefinition): string {
  return [
    tool.name.replace(/_/g, " "),
    tool.description,
    tool.category ?? "",
    tool.group ?? "",
    ...(tool.profiles ?? []),
    ...(tool.searchKeywords ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function matchesSelector(
  tool: ToolDefinition,
  selector: string,
  activeProfile?: string,
): boolean {
  const normalized = selector.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "*" || normalized === "all") return true;
  if (normalized === tool.name.toLowerCase()) return true;
  if (normalized.startsWith("group:")) {
    return (tool.group ?? "").toLowerCase() === normalized.slice(6);
  }
  if (normalized.startsWith("category:")) {
    return (tool.category ?? "").toLowerCase() === normalized.slice(9);
  }
  if (normalized.startsWith("profile:")) {
    return (tool.profiles ?? [])
      .map((v) => v.toLowerCase())
      .includes(normalized.slice(8));
  }
  if (activeProfile && normalized === activeProfile.toLowerCase()) {
    return (tool.profiles ?? [])
      .map((v) => v.toLowerCase())
      .includes(normalized);
  }
  return false;
}

function scoreTool(
  tool: ToolDefinition,
  queryTokens: string[],
  activeProfile?: string,
): number {
  const haystack = [
    tool.name,
    tool.description,
    tool.category,
    tool.group,
    ...(tool.profiles ?? []),
    ...(tool.searchKeywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = tool.deferLoading ? 0 : 2;
  if (activeProfile && tool.profiles?.includes(activeProfile)) score += 2;

  for (const token of queryTokens) {
    if (tool.name.toLowerCase() === token) score += 6;
    else if (tool.name.toLowerCase().includes(token)) score += 4;
    else if (haystack.includes(token)) score += 2;
  }

  return score;
}

export function filterToolsByProfile(params: {
  tools: ToolDefinition[];
  config?: InternalToolSelectionConfig;
  activeProfile?: string;
}): ToolDefinition[] {
  const available = params.tools.filter((tool) => tool.available !== false);
  const config = params.config;
  if (!config) return available;

  const activeProfile = params.activeProfile ?? config.defaultProfile;
  const includeUnprofiled = config.includeUnprofiled ?? true;
  const profile = activeProfile ? config.profiles?.[activeProfile] : undefined;
  let filtered = available;

  if (profile?.include?.length) {
    filtered = filtered.filter(
      (tool) =>
        profile.include!.some((selector) =>
          matchesSelector(tool, selector, activeProfile),
        ) ||
        (!!activeProfile && tool.profiles?.includes(activeProfile)),
    );
  } else if (activeProfile) {
    filtered = filtered.filter((tool) => {
      if (tool.profiles?.length) return tool.profiles.includes(activeProfile);
      return includeUnprofiled;
    });
  }

  if (profile?.exclude?.length) {
    filtered = filtered.filter(
      (tool) =>
        !profile.exclude!.some((selector) =>
          matchesSelector(tool, selector, activeProfile),
        ),
    );
  }

  return filtered;
}

function calculateBM25Score(
  tool: ToolDefinition,
  queryTerms: string[],
  idf: Map<string, number>,
  avgDocLength: number,
  activeProfile?: string,
): number {
  const text = buildSearchText(tool);
  const tokens = tokenize(text);
  const docLength = Math.max(1, tokens.length);

  let score = 0;
  for (const term of queryTerms) {
    const termFreq = tokens.filter((t) => t === term).length;
    if (termFreq === 0) continue;
    const termIDF = idf.get(term) ?? 0;
    const numerator = termFreq * (BM25_K1 + 1);
    const denominator =
      termFreq + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
    score += termIDF * (numerator / denominator);
  }

  const nameLower = tool.name.toLowerCase();
  for (const term of queryTerms) {
    if (nameLower === term) score += 3;
    else if (nameLower.includes(term)) score += 1.5;
  }

  if (activeProfile && tool.profiles?.includes(activeProfile)) score += 0.75;

  return score;
}

export function selectTools(params: {
  tools: ToolDefinition[];
  messages: ToolSelectionMessage[];
  config?: InternalToolSelectionConfig;
  activeProfile?: string;
  forceIncludeNames?: string[];
}): ToolDefinition[] {
  const config = params.config;
  const available = filterToolsByProfile({
    tools: params.tools,
    config,
    activeProfile: params.activeProfile,
  });

  // No config means no selection — return all available tools
  if (!config) return available;

  const activeProfile = params.activeProfile ?? config.defaultProfile;
  const forceIncludeNames = new Set(params.forceIncludeNames ?? []);

  // Always strip deferred tools from initial context (they're loaded via search)
  let filtered = available.filter(
    (tool) => !tool.deferLoading || forceIncludeNames.has(tool.name),
  );

  if (filtered.length === 0) return filtered;

  const maxTools = Math.max(1, Math.min(config.maxEagerTools, filtered.length));
  const queryTokens = unique(tokenize(buildToolQuery(params.messages)));
  const ranked = [...filtered].sort((a, b) => {
    const diff =
      scoreTool(b, queryTokens, activeProfile) -
      scoreTool(a, queryTokens, activeProfile);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  if (forceIncludeNames.size === 0) return ranked.slice(0, maxTools);

  const forced = ranked.filter((t) => forceIncludeNames.has(t.name));
  const others = ranked.filter((t) => !forceIncludeNames.has(t.name));
  const remaining = Math.max(0, maxTools - forced.length);
  return [...forced, ...others.slice(0, remaining)];
}

export function searchTools(params: {
  tools: ToolDefinition[];
  query: string;
  config?: InternalToolSelectionConfig;
  activeProfile?: string;
  limit?: number;
  excludeNames?: string[];
  includeSelected?: boolean;
}): ToolSearchMatch[] {
  const queryTerms = unique(tokenize(params.query));
  if (queryTerms.length === 0) return [];

  const candidates = filterToolsByProfile({
    tools: params.tools,
    config: params.config,
    activeProfile: params.activeProfile,
  }).filter((tool) => {
    if ((params.excludeNames ?? []).includes(tool.name)) return false;
    if (params.includeSelected) return true;
    return tool.deferLoading === true;
  });

  if (candidates.length === 0) return [];

  const docs = candidates.map((tool) => tokenize(buildSearchText(tool)));
  const avgDocLength =
    docs.reduce((sum, tokens) => sum + Math.max(1, tokens.length), 0) /
    docs.length;
  const idf = new Map<string, number>();

  for (const term of queryTerms) {
    const docFreq = docs.reduce(
      (count, tokens) => count + (tokens.includes(term) ? 1 : 0),
      0,
    );
    idf.set(
      term,
      Math.log((docs.length - docFreq + 0.5) / (docFreq + 0.5) + 1),
    );
  }

  const limit = Math.max(1, params.limit ?? params.config?.maxResults ?? 8);
  const activeProfile = params.activeProfile ?? params.config?.defaultProfile;

  return candidates
    .map((tool) => ({
      tool,
      score: calculateBM25Score(
        tool,
        queryTerms,
        idf,
        avgDocLength,
        activeProfile,
      ),
    }))
    .filter((entry) => entry.score >= MIN_SCORE)
    .sort((a, b) => {
      const diff = b.score - a.score;
      return diff !== 0 ? diff : a.tool.name.localeCompare(b.tool.name);
    })
    .slice(0, limit)
    .map(({ tool, score }) => ({
      name: tool.name,
      description: tool.description,
      location: tool.location,
      category: tool.category,
      group: tool.group,
      profiles: tool.profiles,
      searchKeywords: tool.searchKeywords,
      score: Number(score.toFixed(4)),
    }));
}

function normalizeModelName(modelName?: string): string {
  return (modelName ?? "").trim().toLowerCase();
}

export function supportsAnthropicNativeToolSearch(modelName?: string): boolean {
  const model = normalizeModelName(modelName);
  if (!model || model.includes("haiku")) return false;
  return (
    /(?:^|[-_ ])(?:sonnet|opus)[-_ ]?4(?:$|[-_. ])/.test(model) ||
    /claude[-_ ](?:sonnet|opus)[-_ ]?4/.test(model) ||
    /claude[-_ ]?4[-_ ](?:sonnet|opus)/.test(model)
  );
}

export function supportsOpenAINativeToolSearch(modelName?: string): boolean {
  const model = normalizeModelName(modelName);
  if (!model) return false;
  const match = model.match(/^gpt-5(?:[._-](\d+))?(?:$|[._-])/);
  if (!match) return false;
  const minorVersion = match[1] ? Number.parseInt(match[1], 10) : Number.NaN;
  if (!Number.isFinite(minorVersion)) return false;
  return minorVersion >= 4;
}

export function resolveNativeToolSearch(params: {
  providerName: string;
  modelName?: string;
  config?: InternalToolSelectionConfig;
}): ResolvedNativeToolSearch | null {
  // No config means no deferred tools — no need for native search
  if (!params.config) return null;

  if (
    params.providerName === "anthropic" &&
    supportsAnthropicNativeToolSearch(params.modelName)
  ) {
    return { provider: "anthropic", variant: "bm25" };
  }

  if (
    params.providerName === "openai" &&
    supportsOpenAINativeToolSearch(params.modelName)
  ) {
    return { provider: "openai", useResponsesApi: true };
  }

  return null;
}

export function shouldExposeToolSearch(params: {
  tools: ToolDefinition[];
  config?: InternalToolSelectionConfig;
}): boolean {
  if (!params.config) return false;
  const deferredCount = params.tools.filter((t) => t.deferLoading).length;
  if (deferredCount === 0) return false;
  return params.tools.length >= params.config.exposeWhenExceeds;
}

export function buildProviderToolOptions(params: {
  providerName: string;
  modelName?: string;
  selectedTools: ToolDefinition[];
  config?: InternalToolSelectionConfig;
  metaToolName?: string;
}): ProviderToolRuntimeOptions | undefined {
  const { toolChoice, parallelCalls } = params.config ?? {};
  const resolvedNativeSearch = resolveNativeToolSearch({
    providerName: params.providerName,
    modelName: params.modelName,
    config: params.config,
  });

  if (params.providerName === "openai") {
    if (
      toolChoice === undefined &&
      parallelCalls === undefined &&
      !resolvedNativeSearch
    ) {
      return undefined;
    }
    let oaiToolChoice: OpenAIProviderToolOptions["toolChoice"];
    if (toolChoice === "required") oaiToolChoice = "required";
    else if (toolChoice === "auto") oaiToolChoice = "auto";

    return {
      openai: {
        toolChoice: oaiToolChoice,
        parallelToolCalls: parallelCalls,
        nativeToolSearch:
          resolvedNativeSearch?.provider === "openai"
            ? {
                enabled: true,
                useResponsesApi: resolvedNativeSearch.useResponsesApi,
              }
            : undefined,
      },
    };
  }

  if (params.providerName === "anthropic") {
    if (
      toolChoice === undefined &&
      parallelCalls === undefined &&
      !resolvedNativeSearch
    ) {
      return undefined;
    }
    let anthropicToolChoice: AnthropicProviderToolOptions["toolChoice"];
    // "required" maps to Anthropic's "any" (force tool use)
    if (toolChoice === "required") anthropicToolChoice = "any";
    else if (toolChoice === "auto") anthropicToolChoice = "auto";

    return {
      anthropic: {
        toolChoice: anthropicToolChoice,
        // parallelCalls: false → disableParallelToolUse: true
        disableParallelToolUse: parallelCalls === false ? true : undefined,
        nativeToolSearch:
          resolvedNativeSearch?.provider === "anthropic"
            ? { enabled: true, variant: resolvedNativeSearch.variant ?? "bm25" }
            : undefined,
      },
    };
  }

  return undefined;
}
