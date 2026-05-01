/**
 * Google Provider
 *
 * Modern pattern: google('gemini-2.0-flash') returns a LanguageModel
 * Legacy pattern: createGoogle({ apiKey }) returns an AIProvider
 *
 * Features:
 * - Vision (images)
 * - Audio input
 * - Video input
 * - PDF documents
 * - Tools/Function calling
 * - Massive context windows (up to 2M tokens)
 */

// NEW: Modern pattern - google() function
export { google, createGoogle as createGoogleModel } from "./provider";
export type { GoogleProviderOptions } from "./provider";

import { createOpenAIAdapter } from "../../adapters/openai";
import {
  createCallableProvider,
  type AIProvider,
  type ProviderCapabilities,
  type GoogleProviderConfig,
} from "../types";

// Gemini OpenAI-compatible endpoint
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

// ============================================
// Model Definitions
// ============================================

interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  audio: boolean;
  video: boolean;
  pdf: boolean;
  maxTokens: number;
  outputTokens: number;
}

const GOOGLE_MODELS: Record<string, ModelCapabilities> = {
  // Gemini 2.0 series (latest)
  "gemini-2.0-flash": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    pdf: true,
    maxTokens: 1000000,
    outputTokens: 8192,
  },
  "gemini-2.0-flash-lite": {
    vision: true,
    tools: true,
    audio: false,
    video: false,
    pdf: true,
    maxTokens: 1000000,
    outputTokens: 8192,
  },

  // Gemini 2.5 series (experimental)
  "gemini-2.5-pro-preview-05-06": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    pdf: true,
    maxTokens: 1000000,
    outputTokens: 65536,
  },
  "gemini-2.5-flash-preview-05-20": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    pdf: true,
    maxTokens: 1000000,
    outputTokens: 65536,
  },

  // Gemini 1.5 series
  "gemini-1.5-pro": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    pdf: true,
    maxTokens: 2000000,
    outputTokens: 8192,
  },
  "gemini-1.5-pro-latest": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    pdf: true,
    maxTokens: 2000000,
    outputTokens: 8192,
  },
  "gemini-1.5-flash": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    pdf: true,
    maxTokens: 1000000,
    outputTokens: 8192,
  },
  "gemini-1.5-flash-latest": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    pdf: true,
    maxTokens: 1000000,
    outputTokens: 8192,
  },
  "gemini-1.5-flash-8b": {
    vision: true,
    tools: true,
    audio: false,
    video: false,
    pdf: true,
    maxTokens: 1000000,
    outputTokens: 8192,
  },

  // Gemini 3 series (thinking models)
  "gemini-3.1-flash-lite-preview": {
    vision: true,
    tools: true,
    audio: false,
    video: false,
    pdf: true,
    maxTokens: 1000000,
    outputTokens: 32768,
  },
  "gemini-3.1-flash-preview": {
    vision: true,
    tools: true,
    audio: false,
    video: false,
    pdf: true,
    maxTokens: 1000000,
    outputTokens: 32768,
  },

  // Gemini 1.0 series (legacy)
  "gemini-1.0-pro": {
    vision: false,
    tools: true,
    audio: false,
    video: false,
    pdf: false,
    maxTokens: 30720,
    outputTokens: 2048,
  },
};

// ============================================
// Provider Implementation
// ============================================

/**
 * Create a Google provider (callable, Vercel AI SDK style)
 *
 * @example
 * ```typescript
 * const google = createGoogle({ apiKey: '...' });
 *
 * // Callable - Vercel AI SDK style
 * const model = google('gemini-2.0-flash');
 *
 * // Also supports method call (backward compatible)
 * const model2 = google.languageModel('gemini-2.0-flash');
 *
 * // Check capabilities
 * const caps = google.getCapabilities('gemini-2.0-flash');
 * if (caps.supportsVideo) {
 *   // Show video upload button
 * }
 * ```
 */
export function createGoogle(config: GoogleProviderConfig = {}): AIProvider {
  const apiKey = config.apiKey ?? process.env.GOOGLE_API_KEY ?? "";

  // Create the callable function
  const providerFn = (modelId: string) => {
    return createOpenAIAdapter({
      apiKey,
      model: modelId,
      baseUrl: config.baseUrl || GEMINI_BASE_URL,
    });
  };

  // Get capabilities helper
  const getCapabilities = (modelId: string): ProviderCapabilities => {
    const model = GOOGLE_MODELS[modelId] ?? GOOGLE_MODELS["gemini-2.0-flash"];

    return {
      supportsVision: model.vision,
      supportsTools: model.tools,
      supportsThinking: false,
      supportsStreaming: true,
      supportsPDF: model.pdf,
      supportsAudio: model.audio,
      supportsVideo: model.video,
      maxTokens: model.maxTokens,
      supportedImageTypes: model.vision
        ? [
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
            "image/heic",
            "image/heif",
          ]
        : [],
      supportedAudioTypes: model.audio
        ? [
            "audio/mp3",
            "audio/wav",
            "audio/aiff",
            "audio/aac",
            "audio/ogg",
            "audio/flac",
          ]
        : [],
      supportedVideoTypes: model.video
        ? [
            "video/mp4",
            "video/mpeg",
            "video/mov",
            "video/avi",
            "video/webm",
            "video/mkv",
          ]
        : [],
      supportsJsonMode: true,
      supportsSystemMessages: true,
    };
  };

  return createCallableProvider(providerFn, {
    name: "google",
    supportedModels: Object.keys(GOOGLE_MODELS),
    getCapabilities,
  });
}

// Alias for consistency
export const createGoogleProvider = createGoogle;
