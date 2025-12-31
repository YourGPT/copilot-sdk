"use client";

import * as React from "react";

// ============================================
// Types
// ============================================

export interface CopilotUIConfig {
  /**
   * Debug mode - shows JSON args/results in collapsible sections
   * @default false
   */
  debug?: boolean;

  /**
   * Default expanded state for debug content
   * @default false
   */
  defaultDebugExpanded?: boolean;
}

export interface CopilotUIContextValue extends CopilotUIConfig {
  /** Computed: whether debug mode is active */
  isDebug: boolean;
}

// ============================================
// Context
// ============================================

const CopilotUIContext = React.createContext<CopilotUIContextValue | null>(
  null,
);

/**
 * Hook to access CopilotUI configuration
 *
 * Returns defaults if no provider is present (allows standalone component usage)
 */
export function useCopilotUI(): CopilotUIContextValue {
  const context = React.useContext(CopilotUIContext);

  // Return defaults if no provider (allows standalone usage)
  if (!context) {
    return {
      debug: false,
      defaultDebugExpanded: false,
      isDebug: false,
    };
  }

  return context;
}

// ============================================
// Provider
// ============================================

export interface CopilotUIProviderProps extends CopilotUIConfig {
  children: React.ReactNode;
}

/**
 * Provider for global UI configuration (debug mode, etc.)
 *
 * @example
 * ```tsx
 * <CopilotUIProvider debug={process.env.NODE_ENV === "development"}>
 *   <Chat messages={messages} />
 * </CopilotUIProvider>
 * ```
 */
export function CopilotUIProvider({
  children,
  debug = false,
  defaultDebugExpanded = false,
}: CopilotUIProviderProps) {
  const value = React.useMemo<CopilotUIContextValue>(
    () => ({
      debug,
      defaultDebugExpanded,
      isDebug: debug,
    }),
    [debug, defaultDebugExpanded],
  );

  return (
    <CopilotUIContext.Provider value={value}>
      {children}
    </CopilotUIContext.Provider>
  );
}
