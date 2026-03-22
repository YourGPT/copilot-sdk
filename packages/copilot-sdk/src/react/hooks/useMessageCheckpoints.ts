"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useCopilot } from "../provider/CopilotProvider";
import type { UIMessage } from "../../chat";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageCheckpoint {
  /** Unique checkpoint ID */
  id: string;
  /** ID of the user message that triggered this checkpoint */
  messageId: string;
  /** When this checkpoint was created */
  timestamp: number;
  /** Optional human-readable label */
  label?: string;
  /** Full message list BEFORE the user message was processed */
  messages: UIMessage[];
}

export interface UseMessageCheckpointsReturn {
  /** All saved checkpoints, oldest first */
  checkpoints: MessageCheckpoint[];
  /** True if a checkpoint exists for the given user message ID */
  hasCheckpoint: (messageId: string) => boolean;
  /** Get the checkpoint for a user message ID, or undefined */
  getCheckpoint: (messageId: string) => MessageCheckpoint | undefined;
  /**
   * Restore chat to the state before the user message with the given ID.
   * Returns the checkpoint if found, undefined otherwise.
   * Checkpoints created after this one are pruned.
   */
  restore: (messageId: string) => MessageCheckpoint | undefined;
  /**
   * Manually save a checkpoint for a message ID.
   * Auto-save already runs on every new user message — use this for
   * programmatic checkpoints (e.g. before a destructive tool call).
   */
  save: (messageId: string, label?: string) => MessageCheckpoint | undefined;
  /** Clear all saved checkpoints */
  clear: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useMessageCheckpoints
 *
 * Automatically saves a checkpoint before each user message is sent to the
 * agent. Each checkpoint captures the full chat state that existed BEFORE
 * that user message, so restoring it rolls the conversation back to exactly
 * that point.
 *
 * Generic — works for any agentic app (flow builders, code editors, document
 * assistants, etc.). App-specific side effects (e.g. restoring a canvas or
 * database state) can be layered on top via the returned `restore` value.
 *
 * @example
 * ```tsx
 * // Inside <CopilotChat> children
 * function MyCheckpointActions() {
 *   const { hasCheckpoint, restore } = useMessageCheckpoints();
 *   return (
 *     <CopilotChat.MessageActions role="user">
 *       <CopilotChat.Action
 *         icon={<RotateCcw className="size-3.5" />}
 *         tooltip="Restore to before this message"
 *         onClick={({ message }) => restore(message.id)}
 *         hidden={({ message }) => !hasCheckpoint(message.id)}
 *       />
 *     </CopilotChat.MessageActions>
 *   );
 * }
 * ```
 */
export function useMessageCheckpoints(): UseMessageCheckpointsReturn {
  const { messages, setMessages } = useCopilot();

  // messageId → checkpoint
  const checkpointMapRef = useRef<Map<string, MessageCheckpoint>>(new Map());
  // How many user messages we've seen so far
  const prevUserMsgCountRef = useRef(0);
  // Revision counter drives re-renders of consumers
  const [revision, bump] = useReducer((n: number) => n + 1, 0);

  // ── Auto-save on new user message ──────────────────────────────────────────
  useEffect(() => {
    const userMessages = messages.filter((m) => m.role === "user");
    const count = userMessages.length;

    if (count > prevUserMsgCountRef.current) {
      const newUserMsg = userMessages[count - 1];

      if (!checkpointMapRef.current.has(newUserMsg.id)) {
        const msgIndex = messages.findIndex((m) => m.id === newUserMsg.id);
        checkpointMapRef.current.set(newUserMsg.id, {
          id: `cp_${newUserMsg.id}`,
          messageId: newUserMsg.id,
          timestamp: Date.now(),
          messages: structuredClone(messages.slice(0, msgIndex)),
        });
        bump();
      }

      prevUserMsgCountRef.current = count;
    }
  }, [messages]);

  // ── API ────────────────────────────────────────────────────────────────────

  const hasCheckpoint = useCallback(
    (messageId: string) => checkpointMapRef.current.has(messageId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision],
  );

  const getCheckpoint = useCallback(
    (messageId: string) => checkpointMapRef.current.get(messageId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision],
  );

  const restore = useCallback(
    (messageId: string): MessageCheckpoint | undefined => {
      const cp = checkpointMapRef.current.get(messageId);
      if (!cp) return undefined;

      // Roll back chat messages
      setMessages(cp.messages);

      // Prune checkpoints that came after this point
      checkpointMapRef.current.forEach((c, k) => {
        if (c.timestamp > cp.timestamp) checkpointMapRef.current.delete(k);
      });
      prevUserMsgCountRef.current = cp.messages.filter(
        (m) => m.role === "user",
      ).length;

      bump();
      return cp;
    },
    [setMessages],
  );

  const save = useCallback(
    (messageId: string, label?: string): MessageCheckpoint | undefined => {
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return undefined;

      const cp: MessageCheckpoint = {
        id: `cp_${messageId}`,
        messageId,
        timestamp: Date.now(),
        label,
        messages: structuredClone(messages.slice(0, msgIndex)),
      };
      checkpointMapRef.current.set(messageId, cp);
      bump();
      return cp;
    },
    [messages],
  );

  const clear = useCallback(() => {
    checkpointMapRef.current.clear();
    prevUserMsgCountRef.current = 0;
    bump();
  }, []);

  const checkpoints = useMemo(
    () =>
      Array.from(checkpointMapRef.current.values()).sort(
        (a, b) => a.timestamp - b.timestamp,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision],
  );

  return { checkpoints, hasCheckpoint, getCheckpoint, restore, save, clear };
}
