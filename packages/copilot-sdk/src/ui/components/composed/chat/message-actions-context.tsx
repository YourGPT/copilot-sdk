"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { ChatMessage } from "./types";

export interface RegisteredAction {
  id: string;
  icon: React.ReactNode;
  tooltip: string;
  onClick: (props: { message: ChatMessage }) => void;
  hidden?: boolean | ((props: { message: ChatMessage }) => boolean);
  className?: string;
}

interface MessageActionsContextType {
  getActions: (role: "user" | "assistant") => RegisteredAction[];
  registerActions: (
    role: "user" | "assistant",
    actions: RegisteredAction[],
  ) => void;
  clearActions: (role: "user" | "assistant") => void;
}

const MessageActionsContext = createContext<MessageActionsContextType | null>(
  null,
);

export function MessageActionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [registry, setRegistry] = useState<Record<string, RegisteredAction[]>>(
    {},
  );

  const registerActions = useCallback(
    (role: "user" | "assistant", actions: RegisteredAction[]) => {
      setRegistry((prev) => ({ ...prev, [role]: actions }));
    },
    [],
  );

  const clearActions = useCallback((role: "user" | "assistant") => {
    setRegistry((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
  }, []);

  const getActions = useCallback(
    (role: "user" | "assistant") => registry[role] ?? [],
    [registry],
  );

  return (
    <MessageActionsContext.Provider
      value={{ getActions, registerActions, clearActions }}
    >
      {children}
    </MessageActionsContext.Provider>
  );
}

export function useMessageActionsContext() {
  return useContext(MessageActionsContext);
}
