/**
 * Session Persistence
 *
 * Persist display history + compaction state across reloads.
 * Everything uses localStorage — no IndexedDB.
 */

import type { DisplayMessage, SessionCompactionState } from "./types";

// ── localStorage: compaction state ───────────────────────────────

export function saveCompactionState(
  storageKey: string,
  state: SessionCompactionState,
): void {
  try {
    localStorage.setItem(
      `${storageKey}-state`,
      JSON.stringify({ ...state, _savedAt: Date.now() }),
    );
  } catch {
    // localStorage unavailable (SSR, private mode, quota exceeded)
  }
}

export function loadCompactionState(
  storageKey: string,
): SessionCompactionState | null {
  try {
    const raw = localStorage.getItem(`${storageKey}-state`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCompactionState & {
      _savedAt?: number;
    };
    delete (parsed as { _savedAt?: number })._savedAt;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCompactionState(storageKey: string): void {
  try {
    localStorage.removeItem(`${storageKey}-state`);
  } catch {
    // ignore
  }
}

// ── localStorage: display messages ───────────────────────────────

export function saveDisplayMessages(
  storageKey: string,
  messages: DisplayMessage[],
): void {
  try {
    localStorage.setItem(
      `${storageKey}-messages`,
      JSON.stringify({ messages, savedAt: Date.now() }),
    );
  } catch {
    // localStorage unavailable or quota exceeded — fail silently
  }
}

export function loadDisplayMessages(
  storageKey: string,
): DisplayMessage[] | null {
  try {
    const raw = localStorage.getItem(`${storageKey}-messages`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { messages: DisplayMessage[] };
    return parsed?.messages ?? null;
  } catch {
    return null;
  }
}

export function clearDisplayMessages(storageKey: string): void {
  try {
    localStorage.removeItem(`${storageKey}-messages`);
  } catch {
    // ignore
  }
}

// ── Full session clear ────────────────────────────────────────────

export function clearSession(storageKey: string): void {
  clearCompactionState(storageKey);
  clearDisplayMessages(storageKey);
}
