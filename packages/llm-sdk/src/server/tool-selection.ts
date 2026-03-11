import type {
  AnthropicProviderToolOptions,
  OpenAIProviderToolOptions,
  ProviderToolRuntimeOptions,
  ToolDefinition,
  ToolSearchConfig,
  ToolSelectionConfig,
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

const BM25_K1 = 1.2;
const BM25_B = 0.75;

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
  if (typeof content === "string") {
    return content;
  }
  if (!content) {
    return "";
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function buildToolQuery(messages: ToolSelectionMessage[]): string {
  return messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .slice(-3)
    .map((message) => stringifyContent(message.content))
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
  if (!normalized) {
    return false;
  }

  if (normalized === "*" || normalized === "all") {
    return true;
  }
  if (normalized === tool.name.toLowerCase()) {
    return true;
  }
  if (normalized.startsWith("group:")) {
    return (tool.group ?? "").toLowerCase() === normalized.slice(6);
  }
  if (normalized.startsWith("category:")) {
    return (tool.category ?? "").toLowerCase() === normalized.slice(9);
  }
  if (normalized.startsWith("profile:")) {
    return (tool.profiles ?? [])
      .map((value) => value.toLowerCase())
      .includes(normalized.slice(8));
  }
  if (activeProfile && normalized === activeProfile.toLowerCase()) {
    return (tool.profiles ?? [])
      .map((value) => value.toLowerCase())
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
  if (activeProfile && tool.profiles?.includes(activeProfile)) {
    score += 2;
  }

  for (const token of queryTokens) {
    if (tool.name.toLowerCase() === token) {
      score += 6;
    } else if (tool.name.toLowerCase().includes(token)) {
      score += 4;
    } else if (haystack.includes(token)) {
      score += 2;
    }
  }

  return score;
}

export function filterToolsByProfile(params: {
  tools: ToolDefinition[];
  config?: ToolSelectionConfig;
  activeProfile?: string;
}): ToolDefinition[] {
  const available = params.tools.filter((tool) => tool.available !== false);
  const config = params.config;
  if (!config?.enabled) {
    return available;
  }

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
      if (tool.profiles?.length) {
        return tool.profiles.includes(activeProfile);
      }
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
    const termFreq = tokens.filter((token) => token === term).length;
    if (termFreq === 0) {
      continue;
    }

    const termIDF = idf.get(term) ?? 0;
    const numerator = termFreq * (BM25_K1 + 1);
    const denominator =
      termFreq + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
    score += termIDF * (numerator / denominator);
  }

  const nameLower = tool.name.toLowerCase();
  for (const term of queryTerms) {
    if (nameLower === term) {
      score += 3;
    } else if (nameLower.includes(term)) {
      score += 1.5;
    }
  }

  if (activeProfile && tool.profiles?.includes(activeProfile)) {
    score += 0.75;
  }

  return score;
}

export function selectTools(params: {
  tools: ToolDefinition[];
  messages: ToolSelectionMessage[];
  config?: ToolSelectionConfig;
  activeProfile?: string;
  forceIncludeNames?: string[];
}): ToolDefinition[] {
  const config = params.config;
  const available = filterToolsByProfile({
    tools: params.tools,
    config,
    activeProfile: params.activeProfile,
  });
  if (!config?.enabled) {
    return available;
  }
  const activeProfile = params.activeProfile ?? config.defaultProfile;
  const forceIncludeNames = new Set(params.forceIncludeNames ?? []);
  let filtered = available;
  const strictDeferredLoading =
    config.search?.enabled && config.search.strictDeferredLoading === true;

  if (strictDeferredLoading) {
    filtered = filtered.filter(
      (tool) => !tool.deferLoading || forceIncludeNames.has(tool.name),
    );
  }

  if (!config.dynamicSelection?.enabled) {
    if (forceIncludeNames.size === 0) {
      return filtered;
    }
    const merged = new Map(filtered.map((tool) => [tool.name, tool]));
    for (const tool of available) {
      if (forceIncludeNames.has(tool.name)) {
        merged.set(tool.name, tool);
      }
    }
    return [...merged.values()];
  }

  if (filtered.length === 0) {
    return filtered;
  }

  const maxTools = Math.max(
    1,
    Math.min(
      config.dynamicSelection.maxTools ?? filtered.length,
      filtered.length,
    ),
  );
  const queryTokens = unique(tokenize(buildToolQuery(params.messages)));
  const ranked = [...filtered].sort((left, right) => {
    const scoreDiff =
      scoreTool(right, queryTokens, activeProfile) -
      scoreTool(left, queryTokens, activeProfile);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return left.name.localeCompare(right.name);
  });

  if (forceIncludeNames.size === 0) {
    return ranked.slice(0, maxTools);
  }

  const forced = ranked.filter((tool) => forceIncludeNames.has(tool.name));
  const others = ranked.filter((tool) => !forceIncludeNames.has(tool.name));
  const remainingSlots = Math.max(0, maxTools - forced.length);
  return [...forced, ...others.slice(0, remainingSlots)];
}

export function searchTools(params: {
  tools: ToolDefinition[];
  query: string;
  config?: ToolSelectionConfig;
  activeProfile?: string;
  limit?: number;
  excludeNames?: string[];
  includeSelected?: boolean;
}): ToolSearchMatch[] {
  const queryTerms = unique(tokenize(params.query));
  if (queryTerms.length === 0) {
    return [];
  }

  const candidates = filterToolsByProfile({
    tools: params.tools,
    config: params.config,
    activeProfile: params.activeProfile,
  }).filter((tool) => {
    if ((params.excludeNames ?? []).includes(tool.name)) {
      return false;
    }
    if (params.includeSelected) {
      return true;
    }
    return tool.deferLoading === true;
  });

  if (candidates.length === 0) {
    return [];
  }

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

  const minScore = params.config?.search?.minScore ?? 0.1;
  const limit = Math.max(
    1,
    params.limit ?? params.config?.search?.maxResults ?? 5,
  );
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
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return left.tool.name.localeCompare(right.tool.name);
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
  if (!model) {
    return false;
  }

  if (model.includes("haiku")) {
    return false;
  }

  return (
    /(?:^|[-_ ])(?:sonnet|opus)[-_ ]?4(?:$|[-_. ])/.test(model) ||
    /claude[-_ ](?:sonnet|opus)[-_ ]?4/.test(model) ||
    /claude[-_ ]?4[-_ ](?:sonnet|opus)/.test(model)
  );
}

export function supportsOpenAINativeToolSearch(modelName?: string): boolean {
  const model = normalizeModelName(modelName);
  if (!model) {
    return false;
  }

  const match = model.match(/^gpt-5(?:[._-](\d+))?(?:$|[._-])/);
  if (!match) {
    return false;
  }

  const minorVersion = match[1] ? Number.parseInt(match[1], 10) : Number.NaN;
  if (!Number.isFinite(minorVersion)) {
    return false;
  }

  return minorVersion >= 4;
}

export function resolveNativeToolSearch(params: {
  providerName: string;
  modelName?: string;
  config?: ToolSelectionConfig;
}): ResolvedNativeToolSearch | null {
  const searchConfig = params.config?.search;
  if (!searchConfig?.enabled) {
    return null;
  }

  const mode = searchConfig.mode ?? "auto";
  if (mode === "manual") {
    return null;
  }

  if (
    params.providerName === "anthropic" &&
    supportsAnthropicNativeToolSearch(params.modelName)
  ) {
    return {
      provider: "anthropic",
      variant: searchConfig.anthropicVariant ?? "bm25",
    };
  }

  if (
    params.providerName === "openai" &&
    supportsOpenAINativeToolSearch(params.modelName)
  ) {
    return {
      provider: "openai",
      useResponsesApi: true,
    };
  }

  return mode === "native" ? null : null;
}

export function shouldExposeToolSearch(params: {
  tools: ToolDefinition[];
  selectedTools: ToolDefinition[];
  config?: ToolSelectionConfig;
}): boolean {
  const searchConfig = params.config?.search;
  if (!searchConfig?.enabled) {
    return false;
  }

  const deferredCount = params.tools.filter((tool) => tool.deferLoading).length;
  if (deferredCount === 0) {
    return false;
  }

  const threshold = searchConfig.exposeWhenToolCountExceeds ?? 8;
  return (
    params.tools.length >= threshold ||
    deferredCount > Math.max(0, params.selectedTools.length)
  );
}

export function buildProviderToolOptions(params: {
  providerName: string;
  modelName?: string;
  selectedTools: ToolDefinition[];
  config?: ToolSelectionConfig;
  metaToolName?: string;
}): ProviderToolRuntimeOptions | undefined {
  const nativeHints = params.config?.nativeProviderHints;
  const resolvedNativeSearch = resolveNativeToolSearch({
    providerName: params.providerName,
    modelName: params.modelName,
    config: params.config,
  });
  const effectiveTools = params.metaToolName
    ? params.selectedTools.filter((tool) => tool.name !== params.metaToolName)
    : params.selectedTools;

  if (params.providerName === "openai") {
    const hints = nativeHints?.openai;
    if (!hints && !resolvedNativeSearch) {
      return undefined;
    }

    let toolChoice: OpenAIProviderToolOptions["toolChoice"];
    if (hints?.toolChoice === "required") {
      toolChoice = "required";
    } else if (hints?.toolChoice === "single" && effectiveTools.length === 1) {
      toolChoice = {
        type: "function",
        name: effectiveTools[0].name,
      };
    } else if (hints?.toolChoice === "auto") {
      toolChoice = "auto";
    }

    return {
      openai: {
        toolChoice,
        parallelToolCalls: hints?.parallelToolCalls,
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
    const hints = nativeHints?.anthropic;
    if (!hints && !resolvedNativeSearch) {
      return undefined;
    }

    let toolChoice: AnthropicProviderToolOptions["toolChoice"];
    if (hints?.toolChoice === "any") {
      toolChoice = "any";
    } else if (hints?.toolChoice === "single" && effectiveTools.length === 1) {
      toolChoice = {
        type: "tool",
        name: effectiveTools[0].name,
      };
    } else if (hints?.toolChoice === "auto") {
      toolChoice = "auto";
    }

    return {
      anthropic: {
        toolChoice,
        disableParallelToolUse: hints?.disableParallelToolUse,
        nativeToolSearch:
          resolvedNativeSearch?.provider === "anthropic"
            ? {
                enabled: true,
                variant: resolvedNativeSearch.variant ?? "bm25",
              }
            : undefined,
      },
    };
  }

  return undefined;
}
