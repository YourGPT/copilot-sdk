/**
 * useThread — Session/thread management hook
 *
 * Provides clean semantics for managing the active session/thread.
 * When yourgptConfig or onCreateSession is configured, the session ID
 * IS the thread ID — they are the same identity.
 *
 * Use this hook instead of calling setActiveThread/renewSession directly.
 */

import { useCopilot } from "../provider/CopilotProvider";

export interface UseThreadReturn {
  /**
   * Current session/thread ID.
   * undefined until the first session is created (new thread not yet sent).
   */
  threadId: string | undefined;

  /**
   * Current session creation status.
   * - "idle"     — no session config, or threadId already set
   * - "creating" — session creation request in flight
   * - "ready"    — threadId is set and usable
   * - "error"    — session creation failed
   */
  sessionStatus: "idle" | "creating" | "ready" | "error";

  /**
   * Switch to an existing thread/session.
   * Pass the session ID from your persistence layer — it is used as-is,
   * no new session creation call is made.
   */
  switchThread: (sessionId: string) => void;

  /**
   * Start a fresh thread.
   * Clears the current session; a new session is created on the next sendMessage.
   * onThreadChange fires with the new session ID once it is assigned.
   */
  newThread: () => void;

  /**
   * Force a new session to be created on the next sendMessage.
   * Call this when the current session has expired or credits are exhausted.
   * onThreadChange fires with the new session ID once it is assigned.
   */
  renewSession: () => void;
}

/**
 * useThread — Clean hook for session/thread management
 *
 * @example
 * ```tsx
 * function ChatHeader() {
 *   const { threadId, sessionStatus, newThread, switchThread, renewSession } = useThread();
 *
 *   const loadThread = (stored: { sessionId: string }) => {
 *     switchThread(stored.sessionId);   // session ID IS the thread ID
 *   };
 *
 *   return (
 *     <>
 *       {sessionStatus === "creating" && <Spinner />}
 *       <button onClick={newThread}>New Chat</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useThread(): UseThreadReturn {
  const { threadId, setActiveThread, renewSession, sessionStatus } =
    useCopilot();

  return {
    threadId,
    sessionStatus,
    switchThread: setActiveThread,
    newThread: () => setActiveThread(null),
    renewSession,
  };
}
