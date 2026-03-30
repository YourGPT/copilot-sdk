"use client";

/**
 * useAttachments — Core hook for file upload management in chat inputs.
 *
 * Works with both the SDK's default input and custom user inputs.
 * Handles file validation, upload progress, cancellation, and drag-drop.
 *
 * @example
 * ```tsx
 * const { attachments, addFiles, removeAttachment, getReadyAttachments, dragHandlers } =
 *   useAttachments({ upload: "/api/copilot/upload", maxFiles: 5 });
 * ```
 */

import { useState, useCallback, useRef, useMemo } from "react";
import type { MessageAttachment } from "../../core/types/message";

// ── Types ──────────────────────────────────────────────────────────────────

export type AttachmentStatus = "uploading" | "ready" | "error";

export interface PendingAttachment {
  id: string;
  file: File;
  /** Object URL for image preview */
  preview?: string;
  status: AttachmentStatus;
  /** Upload progress 0-100 */
  progress: number;
  error?: string;
  /** Final attachment data when ready */
  attachment?: MessageAttachment;
}

export type UploadConfig =
  | string
  | {
      url: string;
      headers?: Record<string, string> | (() => Record<string, string>);
      body?: Record<string, unknown> | (() => Record<string, unknown>);
    }
  | ((file: File) => Promise<MessageAttachment>);

export interface UseAttachmentsConfig {
  /** Upload handler — string (URL), object (URL+options), or function (custom) */
  upload?: UploadConfig;
  /** Maximum number of files (default: 5) */
  maxFiles?: number;
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Allowed MIME types (default: images + PDF) */
  allowedFileTypes?: string[];
}

export interface UseAttachmentsReturn {
  /** Current pending attachments */
  attachments: PendingAttachment[];
  /** Whether files are being dragged over the drop zone */
  isDragging: boolean;
  /** Add files (from file picker or drop) */
  addFiles: (files: FileList | File[]) => void;
  /** Remove a pending attachment */
  removeAttachment: (id: string) => void;
  /** Cancel an in-progress upload */
  cancelUpload: (id: string) => void;
  /** Retry a failed upload */
  retryUpload: (id: string) => void;
  /** Clear all attachments */
  clearAll: () => void;
  /** Get ready attachments as MessageAttachment[] for sending */
  getReadyAttachments: () => MessageAttachment[];
  /** Whether any attachments exist */
  hasAttachments: boolean;
  /** Whether any upload is in progress */
  isUploading: boolean;
  /** Whether message can be sent (has ready attachments, none still uploading) */
  canSend: boolean;
  /** Drag-drop event handlers — spread on the container element */
  dragHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  /** Open native file picker */
  openFilePicker: () => void;
  /** Ref for hidden file input */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** Handler for file input change */
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES = [
  "image/*",
  "application/pdf",
  "text/csv",
  "text/plain",
  "text/markdown",
  "application/json",
  ".csv",
  ".txt",
  ".md",
  ".json",
];

/** MIME types that are text-based — read as text, no upload needed */
const TEXT_MIME_TYPES = new Set([
  "text/csv",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
  "application/csv",
]);

function isTextFile(file: File): boolean {
  if (TEXT_MIME_TYPES.has(file.type)) return true;
  const ext = file.name.toLowerCase().split(".").pop();
  return ext === "csv" || ext === "txt" || ext === "md" || ext === "json";
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getAttachmentType(mimeType: string): MessageAttachment["type"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

function isTypeAllowed(file: File, allowedTypes: string[]): boolean {
  for (const type of allowedTypes) {
    if (type === file.type) return true;
    if (type.endsWith("/*") && file.type.startsWith(type.slice(0, -1)))
      return true;
    if (type.startsWith(".") && file.name.toLowerCase().endsWith(type))
      return true;
  }
  return false;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function createPreview(file: File): string | undefined {
  if (file.type.startsWith("image/")) {
    return URL.createObjectURL(file);
  }
  return undefined;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAttachments(
  config: UseAttachmentsConfig = {},
): UseAttachmentsReturn {
  const {
    upload,
    maxFiles = DEFAULT_MAX_FILES,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    allowedFileTypes = DEFAULT_ALLOWED_TYPES,
  } = config;

  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const abortControllers = useRef(new Map<string, AbortController>());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounter = useRef(0);

  // ── Upload a single file ─────────────────────────────────────────────

  const uploadFile = useCallback(
    async (id: string, file: File) => {
      const updateProgress = (progress: number) => {
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, progress } : a)),
        );
      };

      const markReady = (attachment: MessageAttachment) => {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, status: "ready" as const, progress: 100, attachment }
              : a,
          ),
        );
      };

      const markError = (error: string) => {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: "error" as const, error } : a,
          ),
        );
      };

      try {
        const controller = new AbortController();
        abortControllers.current.set(id, controller);

        let result: MessageAttachment;

        // Text files: read content locally, no upload needed
        if (isTextFile(file)) {
          updateProgress(50);
          const textContent = await readFileAsText(file);
          result = {
            type: "file",
            data: textContent,
            mimeType: file.type || "text/plain",
            filename: file.name,
          };
          markReady(result);
          return;
        }

        if (typeof upload === "function") {
          // Custom function — no progress tracking (user handles it)
          updateProgress(50);
          result = await upload(file);
        } else if (upload) {
          // URL string or object — upload to server with progress
          const uploadConfig =
            typeof upload === "string" ? { url: upload } : upload;
          const extraHeaders =
            typeof uploadConfig.headers === "function"
              ? uploadConfig.headers()
              : uploadConfig.headers;
          const extraBody =
            typeof uploadConfig.body === "function"
              ? uploadConfig.body()
              : uploadConfig.body;

          const base64 = await fileToBase64(file);
          updateProgress(30);

          const body = JSON.stringify({
            data: base64,
            mimeType: file.type,
            filename: file.name,
            ...extraBody,
          });

          const res = await fetch(uploadConfig.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...extraHeaders },
            body,
            signal: controller.signal,
          });

          updateProgress(90);

          if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
          const json = await res.json();
          const url = json.url ?? json.data?.url;
          if (!url) throw new Error("Upload returned no URL");

          result = {
            type: getAttachmentType(file.type),
            url,
            mimeType: file.type,
            filename: file.name,
          };
        } else {
          // No upload config — fallback to base64
          updateProgress(50);
          const data = await fileToBase64(file);
          result = {
            type: getAttachmentType(file.type),
            data,
            mimeType: file.type,
            filename: file.name,
          };
        }

        markReady(result);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return; // cancelled
        markError((err as Error)?.message ?? "Upload failed");
      } finally {
        abortControllers.current.delete(id);
      }
    },
    [upload],
  );

  // ── Add files ────────────────────────────────────────────────────────

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remaining = maxFiles - attachments.length;
      if (remaining <= 0) return;

      const toAdd = fileArray.slice(0, remaining);

      const newAttachments: PendingAttachment[] = [];

      for (const file of toAdd) {
        // Validate type
        if (!isTypeAllowed(file, allowedFileTypes)) continue;
        // Validate size
        if (file.size > maxFileSize) continue;

        const id = generateId();
        const preview = createPreview(file);

        newAttachments.push({
          id,
          file,
          preview,
          status: "uploading",
          progress: 0,
        });
      }

      if (newAttachments.length === 0) return;

      setAttachments((prev) => [...prev, ...newAttachments]);

      // Start uploads
      for (const att of newAttachments) {
        uploadFile(att.id, att.file);
      }
    },
    [attachments.length, maxFiles, maxFileSize, allowedFileTypes, uploadFile],
  );

  // ── Remove ───────────────────────────────────────────────────────────

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((a) => a.id !== id);
    });
    // Cancel if still uploading
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
  }, []);

  // ── Cancel upload ────────────────────────────────────────────────────

  const cancelUpload = useCallback(
    (id: string) => {
      removeAttachment(id);
    },
    [removeAttachment],
  );

  // ── Retry ────────────────────────────────────────────────────────────

  const retryUpload = useCallback(
    (id: string) => {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: "uploading" as const,
                progress: 0,
                error: undefined,
              }
            : a,
        ),
      );
      const att = attachments.find((a) => a.id === id);
      if (att) uploadFile(id, att.file);
    },
    [attachments, uploadFile],
  );

  // ── Clear all ────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    for (const att of attachments) {
      if (att.preview) URL.revokeObjectURL(att.preview);
    }
    for (const controller of abortControllers.current.values()) {
      controller.abort();
    }
    abortControllers.current.clear();
    setAttachments([]);
  }, [attachments]);

  // ── Get ready attachments ────────────────────────────────────────────

  const getReadyAttachments = useCallback((): MessageAttachment[] => {
    return attachments
      .filter((a) => a.status === "ready" && a.attachment)
      .map((a) => a.attachment!);
  }, [attachments]);

  // ── Derived state ────────────────────────────────────────────────────

  const hasAttachments = attachments.length > 0;
  const isUploading = attachments.some((a) => a.status === "uploading");
  const canSend =
    hasAttachments &&
    attachments.some((a) => a.status === "ready") &&
    !isUploading;

  // ── Drag-drop handlers ───────────────────────────────────────────────

  const dragHandlers = useMemo(
    () => ({
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.types.includes("Files")) {
          setIsDragging(true);
        }
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
          setIsDragging(false);
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
          addFiles(e.dataTransfer.files);
        }
      },
    }),
    [addFiles],
  );

  // ── File input helpers ───────────────────────────────────────────────

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addFiles(e.target.files);
      }
      // Reset so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addFiles],
  );

  return {
    attachments,
    isDragging,
    addFiles,
    removeAttachment,
    cancelUpload,
    retryUpload,
    clearAll,
    getReadyAttachments,
    hasAttachments,
    isUploading,
    canSend,
    dragHandlers,
    openFilePicker,
    fileInputRef,
    onFileInputChange,
  };
}
