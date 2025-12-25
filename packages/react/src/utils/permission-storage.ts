"use client";

import type {
  ToolPermission,
  PermissionStorageAdapter,
  PermissionStorageConfig,
  PermissionLevel,
} from "@yourgpt/core";

const DEFAULT_KEY_PREFIX = "yourgpt-permissions";

/**
 * Create a permission storage adapter based on config
 */
export function createPermissionStorage(
  config: PermissionStorageConfig,
): PermissionStorageAdapter {
  switch (config.type) {
    case "localStorage":
      return createBrowserStorageAdapter(
        typeof window !== "undefined" ? localStorage : null,
        config.keyPrefix,
      );
    case "sessionStorage":
      return createBrowserStorageAdapter(
        typeof window !== "undefined" ? sessionStorage : null,
        config.keyPrefix,
      );
    case "memory":
    default:
      return createMemoryStorageAdapter();
  }
}

/**
 * Browser storage adapter (localStorage or sessionStorage)
 */
function createBrowserStorageAdapter(
  storage: Storage | null,
  keyPrefix = DEFAULT_KEY_PREFIX,
): PermissionStorageAdapter {
  const getStorageKey = () => keyPrefix;

  const loadPermissions = (): Map<string, ToolPermission> => {
    if (!storage) return new Map();
    try {
      const data = storage.getItem(getStorageKey());
      if (!data) return new Map();
      const parsed = JSON.parse(data) as ToolPermission[];
      return new Map(parsed.map((p) => [p.toolName, p]));
    } catch {
      return new Map();
    }
  };

  const savePermissions = (permissions: Map<string, ToolPermission>): void => {
    if (!storage) return;
    try {
      storage.setItem(
        getStorageKey(),
        JSON.stringify(Array.from(permissions.values())),
      );
    } catch (e) {
      console.warn("[PermissionStorage] Failed to save permissions:", e);
    }
  };

  return {
    async get(toolName: string): Promise<ToolPermission | null> {
      const permissions = loadPermissions();
      return permissions.get(toolName) || null;
    },

    async set(permission: ToolPermission): Promise<void> {
      const permissions = loadPermissions();
      permissions.set(permission.toolName, permission);
      savePermissions(permissions);
    },

    async remove(toolName: string): Promise<void> {
      const permissions = loadPermissions();
      permissions.delete(toolName);
      savePermissions(permissions);
    },

    async getAll(): Promise<ToolPermission[]> {
      const permissions = loadPermissions();
      return Array.from(permissions.values());
    },

    async clear(): Promise<void> {
      if (!storage) return;
      storage.removeItem(getStorageKey());
    },
  };
}

/**
 * In-memory storage adapter (for SSR or testing)
 */
function createMemoryStorageAdapter(): PermissionStorageAdapter {
  const permissions = new Map<string, ToolPermission>();

  return {
    async get(toolName: string): Promise<ToolPermission | null> {
      return permissions.get(toolName) || null;
    },

    async set(permission: ToolPermission): Promise<void> {
      permissions.set(permission.toolName, permission);
    },

    async remove(toolName: string): Promise<void> {
      permissions.delete(toolName);
    },

    async getAll(): Promise<ToolPermission[]> {
      return Array.from(permissions.values());
    },

    async clear(): Promise<void> {
      permissions.clear();
    },
  };
}

/**
 * Create a session-only permission cache
 * Used for "session" permission level (in-memory, cleared on page close)
 */
export function createSessionPermissionCache(): Map<string, PermissionLevel> {
  return new Map<string, PermissionLevel>();
}
