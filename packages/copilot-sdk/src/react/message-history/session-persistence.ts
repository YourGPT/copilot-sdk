/**
 * Session Persistence
 *
 * Phase 4: Persist display history + compaction state across reloads.
 * - compactionState → localStorage (small, fast, sync on init)
 * - displayMessages → IndexedDB (can be large, async)
 */

import type { DisplayMessage, SessionCompactionState } from "./types";

const IDB_DB_NAME = "copilot-sdk";
const IDB_STORE = "sessions";
const IDB_VERSION = 1;

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

// ── IndexedDB: display messages ───────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);

    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE, { keyPath: "sessionId" });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDisplayMessages(
  storageKey: string,
  messages: DisplayMessage[],
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({
      sessionId: storageKey,
      messages,
      savedAt: Date.now(),
    });
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB unavailable — fail silently
  }
}

export async function loadDisplayMessages(
  storageKey: string,
): Promise<DisplayMessage[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(storageKey);

    const result = await new Promise<
      { messages: DisplayMessage[] } | undefined
    >((res, rej) => {
      req.onsuccess = () => res(req.result as { messages: DisplayMessage[] });
      req.onerror = () => rej(req.error);
    });

    db.close();
    return result?.messages ?? null;
  } catch {
    return null;
  }
}

export async function clearDisplayMessages(storageKey: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(storageKey);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

// ── Full session clear ────────────────────────────────────────────

export async function clearSession(storageKey: string): Promise<void> {
  clearCompactionState(storageKey);
  await clearDisplayMessages(storageKey);
}
