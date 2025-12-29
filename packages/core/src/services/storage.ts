/**
 * YourGPT Cloud Storage Service
 *
 * Provides managed file storage for premium users.
 * Files are uploaded to YourGPT cloud via presigned URLs.
 */

import type { MessageAttachment } from "../types/message";

/**
 * Upload result from storage service
 */
export interface UploadResult {
  /** Public URL of the uploaded file */
  url: string;
  /** Expiration timestamp (if applicable) */
  expiresAt?: number;
}

/**
 * Upload options
 */
export interface UploadOptions {
  /** Progress callback */
  onProgress?: (progress: number) => void;
}

/**
 * Storage service interface
 */
export interface StorageService {
  /** Check if cloud storage is available */
  isAvailable(): boolean;
  /** Upload file and get URL */
  upload(file: File, options?: UploadOptions): Promise<UploadResult>;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** YourGPT API key (must start with "ygpt_" for premium) */
  apiKey: string;
  /** Custom API endpoint */
  endpoint?: string;
  /** Maximum file size in bytes (default: 25MB for premium) */
  maxFileSize?: number;
}

/** Default max file size for cloud storage (25MB) */
export const CLOUD_MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Default YourGPT API endpoint */
export const DEFAULT_YOURGPT_ENDPOINT = "https://api.yourgpt.ai";

/**
 * Create YourGPT managed storage service
 *
 * @example
 * ```ts
 * const storage = createYourGPTStorage({
 *   apiKey: "ygpt_...",
 * });
 *
 * if (storage.isAvailable()) {
 *   const { url } = await storage.upload(file);
 *   // url = "https://cdn.yourgpt.ai/..."
 * }
 * ```
 */
export function createYourGPTStorage(config: StorageConfig): StorageService {
  const endpoint = config.endpoint || DEFAULT_YOURGPT_ENDPOINT;
  const maxFileSize = config.maxFileSize || CLOUD_MAX_FILE_SIZE;

  return {
    /**
     * Check if cloud storage is available
     * Premium API keys start with "ygpt_"
     */
    isAvailable(): boolean {
      return Boolean(config.apiKey?.startsWith("ygpt_"));
    },

    /**
     * Upload file to YourGPT cloud storage
     */
    async upload(file: File, options?: UploadOptions): Promise<UploadResult> {
      // Validate file size
      if (file.size > maxFileSize) {
        const sizeMB = (maxFileSize / (1024 * 1024)).toFixed(0);
        throw new Error(`File size exceeds ${sizeMB}MB limit`);
      }

      // 1. Request presigned upload URL from YourGPT API
      const presignResponse = await fetch(`${endpoint}/v1/storage/upload-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });

      if (!presignResponse.ok) {
        const error = await presignResponse.text();
        throw new Error(`Failed to get upload URL: ${error}`);
      }

      const { uploadUrl, publicUrl, expiresIn } = await presignResponse.json();

      // 2. Upload file directly to cloud storage using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      return {
        url: publicUrl,
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      };
    },
  };
}

/**
 * Helper to get attachment type from MIME type
 */
export function getAttachmentTypeFromMime(
  mimeType: string,
): "image" | "file" | "audio" | "video" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

/**
 * Process file to MessageAttachment using storage service
 *
 * - If storage is available, uploads to cloud and returns URL-based attachment
 * - Otherwise, converts to base64 (fallback for free tier)
 */
export async function processFileToAttachment(
  file: File,
  storage?: StorageService | null,
): Promise<MessageAttachment> {
  const type = getAttachmentTypeFromMime(file.type);

  // Premium: Upload to cloud storage
  if (storage?.isAvailable()) {
    const { url } = await storage.upload(file);
    return {
      type,
      url,
      mimeType: file.type,
      filename: file.name,
    };
  }

  // Free: Convert to base64
  const data = await fileToBase64(file);
  return {
    type,
    data,
    mimeType: file.type,
    filename: file.name,
  };
}

/**
 * Convert file to base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as base64"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
