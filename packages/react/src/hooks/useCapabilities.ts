"use client";

import { useState, useEffect, useCallback } from "react";
import { useYourGPTContext } from "../context/YourGPTContext";

/**
 * Provider capabilities for UI feature flags
 */
export interface ProviderCapabilities {
  /** Supports image inputs */
  supportsVision: boolean;
  /** Supports tool/function calling */
  supportsTools: boolean;
  /** Supports extended thinking (Claude, DeepSeek) */
  supportsThinking: boolean;
  /** Supports streaming responses */
  supportsStreaming: boolean;
  /** Supports PDF document inputs */
  supportsPDF: boolean;
  /** Supports audio inputs */
  supportsAudio: boolean;
  /** Supports video inputs */
  supportsVideo: boolean;
  /** Maximum context tokens */
  maxTokens: number;
  /** Supported image MIME types */
  supportedImageTypes: string[];
  /** Supported audio MIME types */
  supportedAudioTypes?: string[];
  /** Supported video MIME types */
  supportedVideoTypes?: string[];
  /** Supports JSON mode / structured output */
  supportsJsonMode?: boolean;
  /** Supports system messages */
  supportsSystemMessages?: boolean;
}

/**
 * Capabilities response from the server
 */
export interface CapabilitiesResponse {
  /** Provider name */
  provider: string;
  /** Current model ID */
  model: string;
  /** Model capabilities */
  capabilities: ProviderCapabilities;
  /** List of supported models for this provider */
  supportedModels: string[];
}

/**
 * Default capabilities (used when loading or on error)
 */
const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsVision: false,
  supportsTools: true,
  supportsThinking: false,
  supportsStreaming: true,
  supportsPDF: false,
  supportsAudio: false,
  supportsVideo: false,
  maxTokens: 8192,
  supportedImageTypes: [],
  supportsJsonMode: false,
  supportsSystemMessages: true,
};

/**
 * Hook to access model capabilities from the runtime
 *
 * @returns Capabilities state and actions
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const { capabilities, isLoading } = useCapabilities();
 *
 *   return (
 *     <div>
 *       {capabilities.supportsVision && (
 *         <ImageUploadButton />
 *       )}
 *       {capabilities.supportsAudio && (
 *         <AudioRecordButton />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCapabilities() {
  const { config } = useYourGPTContext();
  const [capabilities, setCapabilities] =
    useState<ProviderCapabilities>(DEFAULT_CAPABILITIES);
  const [provider, setProvider] = useState<string>("unknown");
  const [model, setModel] = useState<string>("unknown");
  const [supportedModels, setSupportedModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Build the capabilities URL from the runtime URL
  const capabilitiesUrl = config.runtimeUrl
    ? config.runtimeUrl.replace(/\/chat\/?$/, "/capabilities")
    : null;

  // Fetch capabilities from server
  const fetchCapabilities = useCallback(async () => {
    if (!capabilitiesUrl) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(capabilitiesUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch capabilities: ${response.status}`);
      }

      const data: CapabilitiesResponse = await response.json();

      setCapabilities(data.capabilities);
      setProvider(data.provider);
      setModel(data.model);
      setSupportedModels(data.supportedModels);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      // Keep default capabilities on error
    } finally {
      setIsLoading(false);
    }
  }, [capabilitiesUrl]);

  // Fetch on mount
  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  return {
    /** Current model capabilities */
    capabilities,
    /** Current provider name */
    provider,
    /** Current model ID */
    model,
    /** List of supported models for current provider */
    supportedModels,
    /** Whether capabilities are being loaded */
    isLoading,
    /** Error if fetch failed */
    error,
    /** Refetch capabilities */
    refetch: fetchCapabilities,
  };
}

/**
 * Hook to check if a specific feature is supported
 *
 * @param feature - The feature to check (e.g., 'vision', 'audio', 'video')
 * @returns Whether the feature is supported
 *
 * @example
 * ```tsx
 * function ImageButton() {
 *   const supportsVision = useFeatureSupport('vision');
 *
 *   if (!supportsVision) return null;
 *   return <button>Upload Image</button>;
 * }
 * ```
 */
export function useFeatureSupport(
  feature: keyof Pick<
    ProviderCapabilities,
    | "supportsVision"
    | "supportsTools"
    | "supportsThinking"
    | "supportsStreaming"
    | "supportsPDF"
    | "supportsAudio"
    | "supportsVideo"
    | "supportsJsonMode"
    | "supportsSystemMessages"
  >,
): boolean {
  const { capabilities } = useCapabilities();
  return capabilities[feature] ?? false;
}

/**
 * Hook to get supported media types
 *
 * @returns Object with supported media types
 *
 * @example
 * ```tsx
 * function MediaUpload() {
 *   const { imageTypes, audioTypes, videoTypes } = useSupportedMediaTypes();
 *
 *   return (
 *     <input
 *       type="file"
 *       accept={imageTypes.join(',')}
 *     />
 *   );
 * }
 * ```
 */
export function useSupportedMediaTypes() {
  const { capabilities } = useCapabilities();

  return {
    /** Supported image MIME types */
    imageTypes: capabilities.supportedImageTypes || [],
    /** Supported audio MIME types */
    audioTypes: capabilities.supportedAudioTypes || [],
    /** Supported video MIME types */
    videoTypes: capabilities.supportedVideoTypes || [],
    /** Whether any image types are supported */
    hasImageSupport: (capabilities.supportedImageTypes?.length ?? 0) > 0,
    /** Whether any audio types are supported */
    hasAudioSupport: (capabilities.supportedAudioTypes?.length ?? 0) > 0,
    /** Whether any video types are supported */
    hasVideoSupport: (capabilities.supportedVideoTypes?.length ?? 0) > 0,
  };
}
