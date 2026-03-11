import type {
  ContextUsage,
  ContextSummarizationConfig,
  ToolDefinition,
  ToolOptimizationConfig,
  ToolResultTruncationConfig,
  ToolTruncationStrategy,
} from "../core";
import type { ChatRequest } from "./interfaces";
import type { UIMessage } from "./types";

const DEFAULT_CHARS_PER_TOKEN = 4;
const DEFAULT_SAFETY_MARGIN = 1.2;
const DEFAULT_INPUT_HEADROOM_RATIO = 0.75;
const DEFAULT_SYSTEM_PROMPT_SHARE = 0.15;
const DEFAULT_HISTORY_SHARE = 0.5;
const DEFAULT_TOOL_RESULTS_SHARE = 0.3;
const DEFAULT_TOOL_DEFINITIONS_SHARE = 0.05;
const DEFAULT_MAX_TOOL_RESULT_CONTEXT_SHARE = 0.3;
const DEFAULT_TOOL_RESULT_HARD_MAX_CHARS = 400_000;
const DEFAULT_TOOL_RESULT_MIN_KEEP_CHARS = 2_000;
const DEFAULT_TOOL_RESULT_STRATEGY: ToolTruncationStrategy = "head-tail";
const DEFAULT_RECENT_HISTORY_PRESERVE = 6;
const TOOL_RESULT_TRUNCATION_NOTICE =
  "\n\n[tool result truncated to fit prompt budget]";
const TOOL_RESULT_COMPACTION_NOTICE =
  "[tool result compacted to preserve context budget]";
const SYSTEM_PROMPT_TRUNCATION_NOTICE =
  "\n\n[system prompt truncated to fit prompt budget]";
const HISTORY_SUMMARY_HEADER = "Conversation summary of earlier context:";
const HISTORY_SUMMARY_COMPACTION_NOTICE =
  "\n\n[summary compacted to preserve context continuity]";
const DEFAULT_SUMMARY_TRIGGER = 12;
const DEFAULT_SUMMARY_CHUNK_SIZE = 10;
const DEFAULT_SUMMARY_MAX_CHARS = 1_600;
const SUMMARY_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "before",
  "being",
  "could",
  "from",
  "have",
  "into",
  "just",
  "more",
  "need",
  "only",
  "over",
  "same",
  "some",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "very",
  "want",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

type RequestMessage = ChatRequest["messages"][number];
type RequestTool = {
  name: string;
  description: string;
  category?: string;
  group?: string;
  deferLoading?: boolean;
  profiles?: string[];
  searchKeywords?: string[];
  inputSchema: unknown;
};

type PreparedBuckets = {
  systemPrompt: string | undefined;
  transformedMessages: RequestMessage[];
  historyMessages: RequestMessage[];
  toolResultMessages: RequestMessage[];
  requestTools: RequestTool[] | undefined;
};

function clampRatio(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value as number));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function abbreviateText(text: string, maxChars = 220): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function estimateTokens(
  text: string,
  charsPerToken = DEFAULT_CHARS_PER_TOKEN,
): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / Math.max(1, charsPerToken));
}

function estimateMessageTokens(
  message: RequestMessage,
  charsPerToken = DEFAULT_CHARS_PER_TOKEN,
): number {
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content ?? "");
  const toolCalls = message.tool_calls
    ? JSON.stringify(message.tool_calls)
    : "";
  const attachments = message.attachments
    ? JSON.stringify(message.attachments)
    : "";
  return estimateTokens(
    `${message.role}\n${content}\n${toolCalls}\n${attachments}`,
    charsPerToken,
  );
}

function estimateToolTokens(
  tool: RequestTool,
  charsPerToken = DEFAULT_CHARS_PER_TOKEN,
): number {
  return estimateTokens(JSON.stringify(tool), charsPerToken);
}

function buildToolQuery(messages: UIMessage[]): string {
  return messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .slice(-3)
    .map((message) => message.content)
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

function truncateText(
  text: string,
  maxChars: number,
  strategy: ToolTruncationStrategy,
  notice = TOOL_RESULT_TRUNCATION_NOTICE,
): string {
  if (text.length <= maxChars) {
    return text;
  }

  const bodyBudget = Math.max(1, maxChars - notice.length);
  if (strategy === "head") {
    return text.slice(0, bodyBudget) + notice;
  }

  if (strategy === "head-tail" || strategy === "smart") {
    const tailLooksImportant =
      strategy === "smart"
        ? /\b(error|exception|failed|traceback|summary|result|done|complete)\b/i.test(
            text.slice(-2000),
          )
        : true;
    if (tailLooksImportant && bodyBudget > 32) {
      const tailBudget = Math.min(Math.floor(bodyBudget * 0.3), 4_000);
      const headBudget = Math.max(1, bodyBudget - tailBudget - 32);
      return (
        text.slice(0, headBudget) +
        "\n\n[... omitted ...]\n\n" +
        text.slice(-tailBudget) +
        notice
      );
    }
  }

  return text.slice(0, bodyBudget) + notice;
}

function isHistorySummaryMessage(message: RequestMessage): boolean {
  return (
    message.role === "system" &&
    typeof message.content === "string" &&
    message.content.startsWith(HISTORY_SUMMARY_HEADER)
  );
}

function collectTopKeywords(messages: RequestMessage[]): string[] {
  const counts = new Map<string, number>();
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    for (const token of tokenize(stringifyContent(message.content))) {
      if (token.length < 3 || SUMMARY_STOP_WORDS.has(token)) {
        continue;
      }
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      const countDiff = right[1] - left[1];
      if (countDiff !== 0) {
        return countDiff;
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 5)
    .map(([token]) => token);
}

function collectToolCallNames(messages: RequestMessage[]): Map<string, string> {
  const toolCallNames = new Map<string, string>();
  for (const message of messages) {
    if (message.role !== "assistant" || !message.tool_calls?.length) {
      continue;
    }
    for (const toolCall of message.tool_calls) {
      const parsedToolCall = toolCall as {
        id?: string;
        function?: { name?: string };
      };
      if (parsedToolCall.id && parsedToolCall.function?.name) {
        toolCallNames.set(parsedToolCall.id, parsedToolCall.function.name);
      }
    }
  }
  return toolCallNames;
}

function compressSummaryContent(
  content: string,
  maxChars: number,
  fallbackBehavior: ContextSummarizationConfig["fallbackBehavior"] | undefined,
): string {
  if (content.length <= maxChars) {
    return content;
  }
  if (fallbackBehavior === "error") {
    throw new Error("History summary exceeded configured continuity budget.");
  }
  if (fallbackBehavior === "statistical") {
    const lines = content.split("\n");
    const retained = lines.filter((line) =>
      /^(Conversation summary|Stats:|- Messages compacted:|- User turns compacted:|- Assistant turns compacted:|- Tool results compacted:|- Latest user request before preserved window:|- Latest assistant response before preserved window:)/.test(
        line,
      ),
    );
    const statistical = retained.join("\n");
    if (statistical.length <= maxChars) {
      return statistical;
    }
  }
  return truncateText(
    content,
    maxChars,
    "head",
    HISTORY_SUMMARY_COMPACTION_NOTICE,
  );
}

function buildHistorySummary(
  messages: RequestMessage[],
  summarization?: ContextSummarizationConfig,
  maxChars = DEFAULT_SUMMARY_MAX_CHARS,
): RequestMessage | null {
  if (messages.length === 0) {
    return null;
  }

  if (summarization?.enabled === false) {
    return null;
  }

  const previousSummaries = messages.filter(isHistorySummaryMessage);
  const rawMessages = messages.filter(
    (message) => !isHistorySummaryMessage(message),
  );
  const focusWindowSize = Math.max(
    1,
    summarization?.chunkSize ?? DEFAULT_SUMMARY_CHUNK_SIZE,
  );
  const detailedThreshold = Math.max(
    1,
    summarization?.triggerAt ?? DEFAULT_SUMMARY_TRIGGER,
  );
  const focusMessages = rawMessages.slice(-focusWindowSize);
  const userMessages = rawMessages.filter((message) => message.role === "user");
  const assistantMessages = rawMessages.filter(
    (message) => message.role === "assistant",
  );
  const toolMessages = rawMessages.filter((message) => message.role === "tool");
  const recentUser =
    abbreviateText(stringifyContent(userMessages.at(-1)?.content), 240) ||
    "n/a";
  const recentAssistant =
    abbreviateText(stringifyContent(assistantMessages.at(-1)?.content), 240) ||
    "n/a";
  const recentUserGoals = userMessages
    .slice(-3)
    .map((message) => abbreviateText(stringifyContent(message.content), 180))
    .filter(Boolean);
  const recentAssistantNotes = assistantMessages
    .map((message) => abbreviateText(stringifyContent(message.content), 180))
    .filter(Boolean)
    .slice(-2);
  const toolCallNames = collectToolCallNames(rawMessages);
  const toolActivity = unique([
    ...focusMessages
      .filter((message) => message.role === "assistant")
      .flatMap((message) =>
        (message.tool_calls ?? [])
          .map((toolCall) => {
            const parsedToolCall = toolCall as {
              function?: { name?: string };
            };
            return parsedToolCall.function?.name;
          })
          .filter((name): name is string => Boolean(name)),
      ),
    ...toolMessages
      .slice(-2)
      .map((message) => {
        const toolName = message.tool_call_id
          ? toolCallNames.get(message.tool_call_id)
          : undefined;
        const snippet = abbreviateText(stringifyContent(message.content), 120);
        return toolName && snippet
          ? `${toolName}: ${snippet}`
          : (toolName ?? snippet);
      })
      .filter(Boolean),
  ]).slice(-4);
  const priorSummaryCarryForward = previousSummaries
    .map((message) =>
      abbreviateText(
        stringifyContent(message.content).replace(
          `${HISTORY_SUMMARY_HEADER}\n`,
          "",
        ),
        180,
      ),
    )
    .filter(Boolean)
    .slice(-2);
  const topKeywords =
    rawMessages.length >= detailedThreshold
      ? collectTopKeywords(
          focusMessages.length > 0 ? focusMessages : rawMessages,
        )
      : [];

  const lines = [
    HISTORY_SUMMARY_HEADER,
    "Stats:",
    `- Messages compacted: ${messages.length}`,
    `- User turns compacted: ${userMessages.length}`,
    `- Assistant turns compacted: ${assistantMessages.length}`,
    `- Tool results compacted: ${toolMessages.length}`,
  ];

  if (previousSummaries.length > 0) {
    lines.push(`- Previous summaries merged: ${previousSummaries.length}`);
  }
  if (rawMessages.length > focusMessages.length) {
    lines.push(
      `- Older compacted messages outside the detailed window: ${rawMessages.length - focusMessages.length}`,
    );
  }
  if (topKeywords.length > 0) {
    lines.push(`- Recurring user topics: ${topKeywords.join(", ")}`);
  }
  if (recentUser !== "n/a") {
    lines.push(`- Latest user request before preserved window: ${recentUser}`);
  }
  if (recentAssistant !== "n/a") {
    lines.push(
      `- Latest assistant response before preserved window: ${recentAssistant}`,
    );
  }
  if (recentUserGoals.length > 0) {
    lines.push("Carry forward user goals:");
    for (const goal of recentUserGoals) {
      lines.push(`- ${goal}`);
    }
  }
  if (recentAssistantNotes.length > 0) {
    lines.push("Carry forward assistant commitments:");
    for (const note of recentAssistantNotes) {
      lines.push(`- ${note}`);
    }
  }
  if (toolActivity.length > 0) {
    lines.push("Recent tool activity:");
    for (const item of toolActivity) {
      lines.push(`- ${item}`);
    }
  }
  if (priorSummaryCarryForward.length > 0) {
    lines.push("Earlier carried-forward context:");
    for (const item of priorSummaryCarryForward) {
      lines.push(`- ${item}`);
    }
  }

  const content = compressSummaryContent(
    lines.join("\n"),
    maxChars,
    summarization?.fallbackBehavior,
  );

  return {
    role: "system",
    content,
  };
}

function buildToolDefinitions(
  selectedTools: ToolDefinition[],
): RequestTool[] | undefined {
  if (selectedTools.length === 0) {
    return undefined;
  }

  return selectedTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    category: tool.category,
    group: tool.group,
    deferLoading: tool.deferLoading,
    profiles: tool.profiles,
    searchKeywords: tool.searchKeywords,
    inputSchema: tool.inputSchema,
  }));
}

function resolveTruncationConfig(params: {
  tool?: ToolDefinition;
  config?: ToolOptimizationConfig;
}): Required<ToolResultTruncationConfig> {
  const charsPerToken =
    params.config?.contextManagement?.tokenEstimation?.charsPerToken ??
    DEFAULT_CHARS_PER_TOKEN;
  const contextWindowTokens =
    params.config?.contextBudget?.budget?.contextWindowTokens;
  const globalConfig = params.config?.toolResultConfig?.truncation;
  const perToolConfig = params.tool?.resultConfig?.truncation;
  const merged = { ...globalConfig, ...perToolConfig };
  const hardMaxChars =
    merged.hardMaxChars ??
    (contextWindowTokens
      ? Math.floor(
          contextWindowTokens *
            clampRatio(
              merged.maxContextShare,
              DEFAULT_MAX_TOOL_RESULT_CONTEXT_SHARE,
            ) *
            charsPerToken,
        )
      : DEFAULT_TOOL_RESULT_HARD_MAX_CHARS);

  return {
    enabled: merged.enabled ?? true,
    maxContextShare: clampRatio(
      merged.maxContextShare,
      DEFAULT_MAX_TOOL_RESULT_CONTEXT_SHARE,
    ),
    hardMaxChars: Math.max(1, hardMaxChars),
    minKeepChars: Math.max(
      256,
      merged.minKeepChars ?? DEFAULT_TOOL_RESULT_MIN_KEEP_CHARS,
    ),
    strategy: merged.strategy ?? DEFAULT_TOOL_RESULT_STRATEGY,
    preserveErrors: merged.preserveErrors ?? true,
  };
}

function buildToolResultContent(
  result: unknown,
  tool?: ToolDefinition,
  args?: Record<string, unknown>,
): string {
  if (typeof result === "string") {
    return result;
  }

  const typedResult = (result ?? null) as
    | ({
        _aiResponseMode?: "none" | "brief" | "full";
        _aiContext?: string;
        _aiContent?: unknown;
        _uiResources?: unknown;
      } & Record<string, unknown>)
    | null;
  const responseMode =
    typedResult?._aiResponseMode ?? tool?.aiResponseMode ?? "full";

  if (typedResult?._aiContent) {
    return JSON.stringify(typedResult._aiContent);
  }

  let aiContext = typedResult?._aiContext;
  if (!aiContext && tool?.aiContext) {
    aiContext =
      typeof tool.aiContext === "function"
        ? tool.aiContext(
            (typedResult ?? { success: true }) as never,
            args ?? {},
          )
        : tool.aiContext;
  }

  switch (responseMode) {
    case "none":
      return aiContext ?? "[Result displayed to user]";
    case "brief":
      return aiContext ?? "[Tool executed successfully]";
    case "full":
    default: {
      if (aiContext) {
        const {
          _aiResponseMode,
          _aiContext,
          _aiContent,
          _uiResources,
          ...dataOnly
        } = typedResult ?? {};
        return `${aiContext}\n\nFull data: ${JSON.stringify(dataOnly)}`;
      }
      if (typedResult?._uiResources) {
        const { _uiResources, ...dataOnly } = typedResult;
        return JSON.stringify(dataOnly);
      }
      return JSON.stringify(result);
    }
  }
}

export function buildToolResultContentForPrompt(
  result: unknown,
  tool: ToolDefinition | undefined,
  args: Record<string, unknown>,
  config: ToolOptimizationConfig | undefined,
): string {
  const text = buildToolResultContent(result, tool, args);
  const truncation = resolveTruncationConfig({ tool, config });
  if (!truncation.enabled) {
    return text;
  }

  if (
    truncation.preserveErrors &&
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof (result as { error?: unknown }).error === "string"
  ) {
    return text;
  }

  const maxChars = Math.max(truncation.minKeepChars, truncation.hardMaxChars);
  return truncateText(text, maxChars, truncation.strategy);
}

function sliceHistoryToMaxMessages(params: {
  historyMessages: RequestMessage[];
  maxMessages: number | undefined;
  pruneStrategy: "oldest" | "least-relevant" | "summarize" | undefined;
  summarization?: ContextSummarizationConfig;
}): RequestMessage[] {
  const { historyMessages, maxMessages, pruneStrategy, summarization } = params;
  if (!maxMessages || historyMessages.length <= maxMessages) {
    return historyMessages;
  }

  const dropped = historyMessages.slice(
    0,
    historyMessages.length - maxMessages,
  );
  const kept = historyMessages.slice(-maxMessages);
  if (pruneStrategy === "summarize") {
    const summary = buildHistorySummary(dropped, summarization);
    return summary ? [summary, ...kept] : kept;
  }
  return kept;
}

function compactHistoryToTokenBudget(params: {
  historyMessages: RequestMessage[];
  maxTokens: number | undefined;
  preserveRecent: number;
  charsPerToken: number;
  pruneStrategy: "oldest" | "least-relevant" | "summarize" | undefined;
  summarization?: ContextSummarizationConfig;
}): RequestMessage[] {
  const {
    maxTokens,
    preserveRecent,
    charsPerToken,
    pruneStrategy,
    summarization,
  } = params;
  let historyMessages = params.historyMessages;
  if (!maxTokens) {
    return historyMessages;
  }

  const getHistoryTokens = () =>
    historyMessages.reduce(
      (sum, message) => sum + estimateMessageTokens(message, charsPerToken),
      0,
    );

  while (historyMessages.length > 1 && getHistoryTokens() > maxTokens) {
    const prunableCount = Math.max(0, historyMessages.length - preserveRecent);
    if (prunableCount <= 0) {
      const firstMessage = historyMessages[0];
      if (
        isHistorySummaryMessage(firstMessage) &&
        typeof firstMessage.content === "string"
      ) {
        const compactedSummary = compressSummaryContent(
          firstMessage.content,
          Math.max(400, Math.floor(maxTokens * charsPerToken * 0.25)),
          summarization?.fallbackBehavior,
        );
        if (compactedSummary !== firstMessage.content) {
          historyMessages = [
            { ...firstMessage, content: compactedSummary },
            ...historyMessages.slice(1),
          ];
          continue;
        }
      }
      historyMessages = historyMessages.slice(1);
      continue;
    }

    const pruned = historyMessages.slice(0, prunableCount);
    const kept = historyMessages.slice(prunableCount);
    if (pruneStrategy === "summarize") {
      const summary = buildHistorySummary(
        pruned,
        summarization,
        Math.max(500, Math.floor(maxTokens * charsPerToken * 0.35)),
      );
      historyMessages = summary ? [summary, ...kept] : kept;
    } else {
      historyMessages = kept;
    }
  }

  return historyMessages;
}

function compactToolResultsToBudget(params: {
  toolResultMessages: RequestMessage[];
  maxTokens: number | undefined;
  charsPerToken: number;
}): RequestMessage[] {
  let toolResultMessages = params.toolResultMessages;
  if (!params.maxTokens) {
    return toolResultMessages;
  }

  const getToolResultTokens = () =>
    toolResultMessages.reduce(
      (sum, message) =>
        sum + estimateMessageTokens(message, params.charsPerToken),
      0,
    );

  while (
    toolResultMessages.length > 0 &&
    getToolResultTokens() > params.maxTokens
  ) {
    const index = toolResultMessages.findIndex(
      (message) => message.content !== TOOL_RESULT_COMPACTION_NOTICE,
    );
    if (index === -1) {
      break;
    }

    toolResultMessages = toolResultMessages.map((message, currentIndex) =>
      currentIndex === index
        ? { ...message, content: TOOL_RESULT_COMPACTION_NOTICE }
        : message,
    );
  }

  return toolResultMessages;
}

function fitToolsToBudget(params: {
  tools: RequestTool[] | undefined;
  maxTokens: number | undefined;
  charsPerToken: number;
}): RequestTool[] | undefined {
  let tools = params.tools;
  if (!tools?.length || !params.maxTokens) {
    return tools;
  }

  const getToolTokens = () =>
    tools!.reduce(
      (sum, tool) => sum + estimateToolTokens(tool, params.charsPerToken),
      0,
    );

  while (tools.length > 0 && getToolTokens() > params.maxTokens) {
    tools = tools.slice(0, -1);
  }

  return tools;
}

function truncateSystemPromptToBudget(params: {
  systemPrompt: string | undefined;
  maxTokens: number | undefined;
  charsPerToken: number;
}): string | undefined {
  const { systemPrompt, maxTokens, charsPerToken } = params;
  if (!systemPrompt || !maxTokens) {
    return systemPrompt;
  }

  const maxChars = maxTokens * charsPerToken;
  if (systemPrompt.length <= maxChars) {
    return systemPrompt;
  }

  return truncateText(
    systemPrompt,
    maxChars,
    "head",
    SYSTEM_PROMPT_TRUNCATION_NOTICE,
  );
}

function calculateBuckets(params: {
  systemPrompt: string | undefined;
  historyMessages: RequestMessage[];
  toolResultMessages: RequestMessage[];
  requestTools: RequestTool[] | undefined;
  charsPerToken: number;
  availableBudget: number;
  warnings: string[];
}): ContextUsage {
  const systemPromptTokens = estimateTokens(
    params.systemPrompt ?? "",
    params.charsPerToken,
  );
  const historyTokens = params.historyMessages.reduce(
    (sum, message) =>
      sum + estimateMessageTokens(message, params.charsPerToken),
    0,
  );
  const toolResultsTokens = params.toolResultMessages.reduce(
    (sum, message) =>
      sum + estimateMessageTokens(message, params.charsPerToken),
    0,
  );
  const toolDefinitionTokens = (params.requestTools ?? []).reduce(
    (sum, tool) => sum + estimateToolTokens(tool, params.charsPerToken),
    0,
  );
  const total =
    systemPromptTokens +
    historyTokens +
    toolResultsTokens +
    toolDefinitionTokens;
  const budget = Number.isFinite(params.availableBudget)
    ? params.availableBudget
    : total;
  const toPart = (tokens: number) => ({
    tokens,
    percent: budget > 0 ? Number(((tokens / budget) * 100).toFixed(2)) : 0,
  });

  return {
    total: toPart(total),
    breakdown: {
      systemPrompt: toPart(systemPromptTokens),
      history: toPart(historyTokens),
      toolResults: toPart(toolResultsTokens),
      tools: toPart(toolDefinitionTokens),
    },
    budget: {
      available: budget,
      remaining: Math.max(0, budget - total),
    },
    warnings: unique(params.warnings),
  };
}

function mergeBucketsInOriginalOrder(params: {
  transformedMessages: RequestMessage[];
  historyMessages: RequestMessage[];
  toolResultMessages: RequestMessage[];
}): RequestMessage[] {
  const historyQueue = [...params.historyMessages];
  const toolQueue = [...params.toolResultMessages];

  return params.transformedMessages.flatMap((message) => {
    if (message.role === "tool") {
      const nextTool = toolQueue.shift();
      return nextTool ? [nextTool] : [];
    }
    const nextHistory = historyQueue.shift();
    return nextHistory ? [nextHistory] : [];
  });
}

export class ChatContextOptimizer {
  private config: ToolOptimizationConfig | undefined;
  private activeProfile: string | undefined;
  private lastContextUsage: ContextUsage | null = null;

  constructor(config?: ToolOptimizationConfig) {
    this.config = config;
    this.activeProfile = config?.toolProfiles?.defaultProfile;
  }

  updateConfig(config?: ToolOptimizationConfig): void {
    this.config = config;
    if (!this.activeProfile) {
      this.activeProfile = config?.toolProfiles?.defaultProfile;
    }
  }

  setActiveProfile(profile?: string): void {
    this.activeProfile = profile?.trim() || undefined;
  }

  getContextUsage(): ContextUsage | null {
    return this.lastContextUsage;
  }

  prepare(params: {
    messages: UIMessage[];
    tools?: ToolDefinition[];
    systemPrompt?: string;
  }): {
    messages: RequestMessage[];
    tools?: RequestTool[];
    contextUsage: ContextUsage;
    warnings: string[];
  } {
    const charsPerToken =
      this.config?.contextManagement?.tokenEstimation?.charsPerToken ??
      DEFAULT_CHARS_PER_TOKEN;
    const safetyMargin =
      this.config?.contextManagement?.tokenEstimation?.safetyMargin ??
      DEFAULT_SAFETY_MARGIN;
    const warnings: string[] = [];
    const contextManagement = this.config?.contextManagement;
    const contextBudget = this.config?.contextBudget;
    const allTools = params.tools ?? [];
    const selectedTools = this.selectTools(allTools, params.messages);
    const transformedMessages = this.transformMessages(
      params.messages,
      allTools,
    );
    const preserveRecent =
      contextManagement?.summarization?.preserveRecent ??
      DEFAULT_RECENT_HISTORY_PRESERVE;

    let buckets: PreparedBuckets = {
      systemPrompt: params.systemPrompt,
      transformedMessages,
      historyMessages: transformedMessages.filter(
        (message) => message.role !== "tool",
      ),
      toolResultMessages: transformedMessages.filter(
        (message) => message.role === "tool",
      ),
      requestTools: buildToolDefinitions(selectedTools),
    };

    if (contextManagement?.enabled) {
      buckets.historyMessages = sliceHistoryToMaxMessages({
        historyMessages: buckets.historyMessages,
        maxMessages: contextManagement.history?.maxMessages,
        pruneStrategy: contextManagement.history?.pruneStrategy,
        summarization: contextManagement?.summarization,
      });
    }

    const budgetConfig = contextBudget?.budget;
    const contextWindowTokens = budgetConfig?.contextWindowTokens;
    const inputHeadroomRatio = clampRatio(
      budgetConfig?.inputHeadroomRatio,
      DEFAULT_INPUT_HEADROOM_RATIO,
    );
    const availableBudget = contextWindowTokens
      ? Math.max(1, Math.floor(contextWindowTokens * inputHeadroomRatio))
      : Number.POSITIVE_INFINITY;

    const sharedBudget = Number.isFinite(availableBudget)
      ? availableBudget
      : undefined;
    const systemPromptBudget = sharedBudget
      ? Math.max(
          1,
          Math.floor(
            sharedBudget *
              clampRatio(
                budgetConfig?.systemPromptShare,
                DEFAULT_SYSTEM_PROMPT_SHARE,
              ),
          ),
        )
      : undefined;
    const historyBudgetByShare = sharedBudget
      ? Math.max(
          1,
          Math.floor(
            sharedBudget *
              clampRatio(budgetConfig?.historyShare, DEFAULT_HISTORY_SHARE),
          ),
        )
      : undefined;
    const historyBudgetByConfig =
      contextManagement?.enabled && contextManagement.history?.maxTokens
        ? Math.floor(contextManagement.history.maxTokens / safetyMargin)
        : undefined;
    const historyBudget =
      historyBudgetByShare && historyBudgetByConfig
        ? Math.min(historyBudgetByShare, historyBudgetByConfig)
        : (historyBudgetByShare ?? historyBudgetByConfig);
    const toolResultsBudget = sharedBudget
      ? Math.max(
          1,
          Math.floor(
            sharedBudget *
              clampRatio(
                budgetConfig?.toolResultsShare,
                DEFAULT_TOOL_RESULTS_SHARE,
              ),
          ),
        )
      : undefined;
    const toolDefinitionsBudget = sharedBudget
      ? Math.max(
          1,
          Math.floor(
            sharedBudget *
              clampRatio(
                budgetConfig?.toolDefinitionsShare,
                DEFAULT_TOOL_DEFINITIONS_SHARE,
              ),
          ),
        )
      : undefined;

    if (contextBudget?.enabled) {
      buckets.systemPrompt = truncateSystemPromptToBudget({
        systemPrompt: buckets.systemPrompt,
        maxTokens: systemPromptBudget,
        charsPerToken,
      });
    }

    buckets.historyMessages = compactHistoryToTokenBudget({
      historyMessages: buckets.historyMessages,
      maxTokens: historyBudget,
      preserveRecent,
      charsPerToken,
      pruneStrategy: contextManagement?.history?.pruneStrategy,
      summarization: contextManagement?.summarization,
    });

    buckets.toolResultMessages = compactToolResultsToBudget({
      toolResultMessages: buckets.toolResultMessages,
      maxTokens: toolResultsBudget,
      charsPerToken,
    });

    buckets.requestTools = fitToolsToBudget({
      tools: buckets.requestTools,
      maxTokens: toolDefinitionsBudget,
      charsPerToken,
    });

    let usage = calculateBuckets({
      ...buckets,
      charsPerToken,
      availableBudget,
      warnings,
    });

    if (
      Number.isFinite(availableBudget) &&
      usage.total.tokens > availableBudget
    ) {
      // Final global fallback: preserve recent history, compact tool results first, then trim history and tools.
      buckets.toolResultMessages = compactToolResultsToBudget({
        toolResultMessages: buckets.toolResultMessages,
        maxTokens: Math.max(
          1,
          usage.breakdown.toolResults.tokens -
            usage.total.tokens +
            availableBudget,
        ),
        charsPerToken,
      });

      usage = calculateBuckets({
        ...buckets,
        charsPerToken,
        availableBudget,
        warnings,
      });

      if (usage.total.tokens > availableBudget) {
        const overflow = usage.total.tokens - availableBudget;
        buckets.historyMessages = compactHistoryToTokenBudget({
          historyMessages: buckets.historyMessages,
          maxTokens: Math.max(1, usage.breakdown.history.tokens - overflow),
          preserveRecent,
          charsPerToken,
          pruneStrategy: contextManagement?.history?.pruneStrategy,
        });
        usage = calculateBuckets({
          ...buckets,
          charsPerToken,
          availableBudget,
          warnings,
        });
      }

      if (usage.total.tokens > availableBudget) {
        buckets.requestTools = fitToolsToBudget({
          tools: buckets.requestTools,
          maxTokens: Math.max(
            1,
            usage.breakdown.tools.tokens -
              (usage.total.tokens - availableBudget),
          ),
          charsPerToken,
        });
        usage = calculateBuckets({
          ...buckets,
          charsPerToken,
          availableBudget,
          warnings,
        });
      }
    }

    if (
      Number.isFinite(availableBudget) &&
      usage.total.tokens > availableBudget
    ) {
      warnings.push(
        `Prompt budget exceeded: using ${usage.total.tokens} tokens of ${availableBudget}.`,
      );
      usage = {
        ...usage,
        warnings: unique(warnings),
      };
      if (contextBudget?.enforcement?.mode === "error") {
        throw new Error(warnings[warnings.length - 1]);
      }
      contextBudget?.enforcement?.onBudgetExceeded?.(usage);
    } else {
      usage = {
        ...usage,
        warnings: unique(warnings),
      };
    }

    contextBudget?.monitoring?.onUsageUpdate?.(usage);
    this.lastContextUsage = usage;

    return {
      messages: mergeBucketsInOriginalOrder(buckets),
      tools: buckets.requestTools,
      contextUsage: usage,
      warnings: usage.warnings,
    };
  }

  private selectTools(
    tools: ToolDefinition[],
    messages: UIMessage[],
  ): ToolDefinition[] {
    if (!tools.length) {
      return [];
    }

    const available = tools.filter((tool) => tool.available !== false);
    const profileConfig = this.config?.toolProfiles;
    if (!profileConfig?.enabled) {
      return available;
    }

    const activeProfile = this.activeProfile ?? profileConfig.defaultProfile;
    const includeUnprofiled = profileConfig.includeUnprofiled ?? true;
    const profile = activeProfile
      ? profileConfig.profiles?.[activeProfile]
      : undefined;
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

    if (!profileConfig.dynamicSelection?.enabled) {
      return filtered;
    }

    const maxTools = Math.max(
      1,
      Math.min(
        profileConfig.dynamicSelection.maxTools ?? filtered.length,
        filtered.length,
      ),
    );
    const queryTokens = tokenize(buildToolQuery(messages));
    return [...filtered]
      .sort((left, right) => {
        const scoreDiff =
          scoreTool(right, queryTokens, activeProfile) -
          scoreTool(left, queryTokens, activeProfile);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return left.name.localeCompare(right.name);
      })
      .slice(0, maxTools);
  }

  private transformMessages(
    messages: UIMessage[],
    allTools: ToolDefinition[],
  ): RequestMessage[] {
    const toolCallMap = new Map<
      string,
      { toolName: string; args: Record<string, unknown> }
    >();
    for (const message of messages) {
      if (message.role !== "assistant" || !message.toolCalls?.length) {
        continue;
      }
      for (const toolCall of message.toolCalls) {
        try {
          toolCallMap.set(toolCall.id, {
            toolName: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments),
          });
        } catch {
          toolCallMap.set(toolCall.id, {
            toolName: toolCall.function.name,
            args: {},
          });
        }
      }
    }

    const toolDefMap = new Map(
      allTools.map((tool) => [tool.name, tool] as const),
    );

    return messages.map((message) => {
      if (message.role !== "tool") {
        return {
          role: message.role,
          content: message.content,
          tool_calls: message.toolCalls,
          tool_call_id: message.toolCallId,
          attachments: message.attachments,
        };
      }

      const toolCall = message.toolCallId
        ? toolCallMap.get(message.toolCallId)
        : undefined;
      const tool = toolCall ? toolDefMap.get(toolCall.toolName) : undefined;
      let content = message.content;

      try {
        const parsed = JSON.parse(message.content);
        content = buildToolResultContentForPrompt(
          parsed,
          tool,
          toolCall?.args ?? {},
          this.config,
        );
      } catch {
        content = buildToolResultContentForPrompt(
          message.content,
          tool,
          toolCall?.args ?? {},
          this.config,
        );
      }

      return {
        role: message.role,
        content,
        tool_call_id: message.toolCallId,
      };
    });
  }
}
