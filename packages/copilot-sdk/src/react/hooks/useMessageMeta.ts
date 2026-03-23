"use client";

/**
 * useMessageMeta — reactive per-message custom metadata store
 *
 * Attach any data to a message ID and have all components reading that
 * message ID re-render automatically. The SDK has zero opinion on the shape —
 * consumers define their own types via the generic parameter.
 *
 * This is the companion to useCopilotEvent(): events flow in, you store what
 * you need here, and your UI reacts.
 *
 * @example — store thinking steps parsed from stream events
 * ```tsx
 * interface MyMeta {
 *   thinkingSteps?: ThinkingStep[]
 *   artifacts?: Artifact[]
 *   planStatus?: 'pending' | 'approved' | 'rejected'
 * }
 *
 * // Writer — anywhere in your app (e.g. inside useCopilotEvent handler)
 * const { updateMeta } = useMessageMeta<MyMeta>(messageId)
 * updateMeta(prev => ({
 *   ...prev,
 *   thinkingSteps: [...(prev.thinkingSteps ?? []), newStep]
 * }))
 *
 * // Reader — in your message component
 * const { meta } = useMessageMeta<MyMeta>(message.id)
 * const steps = meta.thinkingSteps ?? []
 * ```
 *
 * @example — artifact tracking
 * ```tsx
 * useCopilotEvent('action:end', (e) => {
 *   if (e.name === 'create_artifact' && e.result) {
 *     updateMeta(e.messageId!, prev => ({
 *       ...prev,
 *       artifacts: [...(prev.artifacts ?? []), e.result]
 *     }))
 *   }
 * })
 * ```
 */

import { useSyncExternalStore, useCallback } from "react";
import { useCopilot } from "../provider/CopilotProvider";

export interface UseMessageMetaReturn<T extends Record<string, unknown>> {
  /** Current metadata for this message. Empty object if nothing set yet. */
  meta: T;
  /**
   * Replace metadata entirely.
   */
  setMeta: (meta: T) => void;
  /**
   * Merge/update metadata using an updater function.
   * Receives previous meta, return next meta.
   */
  updateMeta: (updater: (prev: T) => T) => void;
}

/**
 * Read and write custom metadata for a specific message ID.
 *
 * @param messageId - The message to attach metadata to.
 *                   Pass undefined to get a no-op instance (safe for conditional use).
 */
export function useMessageMeta<
  T extends Record<string, unknown> = Record<string, unknown>,
>(messageId: string | undefined): UseMessageMetaReturn<T> {
  const { messageMeta } = useCopilot();

  // Subscribe to store changes — only re-render when this messageId's data changes
  const meta = useSyncExternalStore(
    messageMeta.subscribe,
    () => (messageId ? (messageMeta.getMeta(messageId) as T) : ({} as T)),
    () => ({}) as T,
  );

  const setMeta = useCallback(
    (next: T) => {
      if (!messageId) return;
      messageMeta.setMeta(messageId, next as Record<string, unknown>);
    },
    [messageMeta, messageId],
  );

  const updateMeta = useCallback(
    (updater: (prev: T) => T) => {
      if (!messageId) return;
      messageMeta.updateMeta(
        messageId,
        (prev) => updater(prev as T) as Record<string, unknown>,
      );
    },
    [messageMeta, messageId],
  );

  return { meta, setMeta, updateMeta };
}
