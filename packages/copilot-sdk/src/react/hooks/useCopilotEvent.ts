"use client";

/**
 * useCopilotEvent — subscribe to raw stream events from the SDK
 *
 * Gives headless consumers direct access to every chunk that flows through
 * the streaming pipeline. Use this to build custom real-time UI without
 * depending on any built-in SDK components.
 *
 * @example — custom thinking step parser
 * ```tsx
 * useCopilotEvent('thinking:delta', (e) => {
 *   setThinking(prev => prev + e.content)
 * })
 * ```
 *
 * @example — tool execution badge
 * ```tsx
 * useCopilotEvent('action:start', (e) => setActiveTool(e.name))
 * useCopilotEvent('action:end',   (e) => setActiveTool(null))
 * ```
 *
 * @example — loop iteration counter
 * ```tsx
 * useCopilotEvent('loop:iteration', (e) => {
 *   setProgress(e.iteration / e.maxIterations)
 * })
 * ```
 *
 * @example — catch-all (every chunk type)
 * ```tsx
 * useCopilotEvent('*', (e) => console.log(e.type, e))
 * ```
 */

import { useEffect, useRef } from "react";
import { useCopilot } from "../provider/CopilotProvider";
import type { StreamChunkWithMessageId } from "../provider/CopilotProvider";
import type { StreamChunk } from "../../chat";

// Extract the 'type' discriminant from StreamChunk
type StreamChunkType = StreamChunk["type"];

// Map from event type → the specific chunk shape for that type
type ChunkOfType<T extends StreamChunkType | "*"> = T extends "*"
  ? StreamChunkWithMessageId
  : Extract<StreamChunk, { type: T }> & { messageId?: string };

/**
 * Subscribe to a specific stream event type (or all events with '*').
 *
 * The handler is called synchronously during streaming — keep it fast.
 * Handler identity doesn't need to be stable; the hook re-subscribes
 * automatically when it changes.
 *
 * @param eventType - Stream chunk type to listen for, or '*' for all
 * @param handler   - Callback invoked for each matching chunk
 */
export function useCopilotEvent<T extends StreamChunkType | "*">(
  eventType: T,
  handler: (chunk: ChunkOfType<T>) => void,
): void {
  const { subscribeToStreamEvents } = useCopilot();

  // Always use latest handler without resubscribing
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsub = subscribeToStreamEvents((chunk) => {
      if (eventType === "*" || chunk.type === eventType) {
        handlerRef.current(chunk as ChunkOfType<T>);
      }
    });
    return unsub;
    // eventType changes → resubscribe; handler changes → ref updated, no resubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeToStreamEvents, eventType]);
}
