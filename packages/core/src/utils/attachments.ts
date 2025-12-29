/**
 * Attachment Processing Utilities
 *
 * Utilities for validating, processing, and converting file attachments
 * for use in chat messages.
 */

import type { MessageAttachment } from "../types/message";

/**
 * Default maximum file size (5MB)
 */
export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Supported MIME types by category
 */
export const SUPPORTED_MIME_TYPES = {
  image: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ],
  pdf: ["application/pdf"],
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm"],
  video: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
} as const;

/**
 * All supported MIME types
 */
export const ALL_SUPPORTED_MIME_TYPES = [
  ...SUPPORTED_MIME_TYPES.image,
  ...SUPPORTED_MIME_TYPES.pdf,
  ...SUPPORTED_MIME_TYPES.audio,
  ...SUPPORTED_MIME_TYPES.video,
];

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Get attachment type from MIME type
 */
export function getAttachmentType(
  mimeType: string,
): "image" | "file" | "audio" | "video" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

/**
 * Validate file size
 */
export function validateFileSize(
  file: File,
  maxSize: number = DEFAULT_MAX_FILE_SIZE,
): ValidationResult {
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB.`,
    };
  }
  return { valid: true };
}

/**
 * Validate file type against allowed types
 */
export function validateFileType(
  file: File,
  allowedTypes?: string[],
): ValidationResult {
  const types = allowedTypes || ALL_SUPPORTED_MIME_TYPES;

  // Check exact match first
  if (types.includes(file.type)) {
    return { valid: true };
  }

  // Check wildcard patterns (e.g., "image/*")
  for (const type of types) {
    if (type.endsWith("/*")) {
      const category = type.slice(0, -2);
      if (file.type.startsWith(category + "/")) {
        return { valid: true };
      }
    }
  }

  return {
    valid: false,
    error: `File type "${file.type}" is not supported. Allowed types: ${types.join(", ")}`,
  };
}

/**
 * Convert a File to base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
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

/**
 * Process a File into a MessageAttachment
 */
export async function processFileToAttachment(
  file: File,
): Promise<MessageAttachment> {
  const data = await fileToBase64(file);
  const type = getAttachmentType(file.type);

  return {
    type,
    data,
    mimeType: file.type,
    filename: file.name,
  };
}

/**
 * Validate and process a file
 * Returns the attachment or throws an error
 */
export async function validateAndProcessFile(
  file: File,
  options?: {
    maxSize?: number;
    allowedTypes?: string[];
  },
): Promise<MessageAttachment> {
  // Validate size
  const sizeResult = validateFileSize(file, options?.maxSize);
  if (!sizeResult.valid) {
    throw new Error(sizeResult.error);
  }

  // Validate type
  const typeResult = validateFileType(file, options?.allowedTypes);
  if (!typeResult.valid) {
    throw new Error(typeResult.error);
  }

  // Process file
  return processFileToAttachment(file);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
  );
}

/**
 * Get accept string for file input based on supported types
 */
export function getAcceptString(options?: {
  images?: boolean;
  pdfs?: boolean;
  audio?: boolean;
  video?: boolean;
}): string {
  const types: string[] = [];

  if (options?.images !== false) {
    types.push(...SUPPORTED_MIME_TYPES.image);
  }
  if (options?.pdfs) {
    types.push(...SUPPORTED_MIME_TYPES.pdf);
  }
  if (options?.audio) {
    types.push(...SUPPORTED_MIME_TYPES.audio);
  }
  if (options?.video) {
    types.push(...SUPPORTED_MIME_TYPES.video);
  }

  // If no specific options, default to images
  if (types.length === 0) {
    types.push(...SUPPORTED_MIME_TYPES.image);
  }

  return types.join(",");
}

/**
 * Generate unique attachment ID
 */
export function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
