/**
 * Google Provider
 *
 * Wraps the GoogleAdapter with provider interface.
 * Adds model capabilities and metadata for multimodal support.
 *
 * Features:
 * - Vision (images)
 * - Audio input
 * - Video input
 * - PDF documents
 * - Tools/Function calling
 * - Massive context windows (up to 2M tokens)
 */

import { createGoogleAdapter } from "../../adapters/google";
import type {
  AIProvider,
  ProviderCapabilities,
  GoogleProviderConfig,
} from "../types";

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
 * Create a Google provider
 *
 * @example
 * ```typescript
 * const google = createGoogle({
 *   apiKey: '...',
 * });
 * const adapter = google.languageModel('gemini-2.0-flash');
 * const caps = google.getCapabilities('gemini-2.0-flash');
 *
 * if (caps.supportsVideo) {
 *   // Show video upload button
 * }
 * ```
 */
export function createGoogle(config: GoogleProviderConfig = {}): AIProvider {
  const apiKey = config.apiKey ?? process.env.GOOGLE_API_KEY ?? "";

  return {
    name: "google",
    supportedModels: Object.keys(GOOGLE_MODELS),

    languageModel(modelId: string) {
      return createGoogleAdapter({
        apiKey,
        model: modelId,
        baseUrl: config.baseUrl,
        safetySettings: config.safetySettings,
      });
    },

    getCapabilities(modelId: string): ProviderCapabilities {
      const model = GOOGLE_MODELS[modelId] ?? GOOGLE_MODELS["gemini-2.0-flash"];

      return {
        supportsVision: model.vision,
        supportsTools: model.tools,
        supportsThinking: false, // Gemini doesn't have extended thinking like Claude
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
        supportsJsonMode: true, // Gemini supports JSON mode
        supportsSystemMessages: true,
      };
    },
  };
}

// Alias for consistency
export const createGoogleProvider = createGoogle;
