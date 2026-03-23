import type { UIMessage } from "@yourgpt/copilot-sdk/react";

const PREFIX = "slack-demo:";

export function loadMessages(channelId: string): UIMessage[] {
  try {
    const raw = localStorage.getItem(`${PREFIX}${channelId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMessages(channelId: string, messages: UIMessage[]): void {
  try {
    localStorage.setItem(`${PREFIX}${channelId}`, JSON.stringify(messages));
  } catch {}
}

export function clearMessages(channelId: string): void {
  localStorage.removeItem(`${PREFIX}${channelId}`);
}
