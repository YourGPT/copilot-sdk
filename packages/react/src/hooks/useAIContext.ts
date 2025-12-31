"use client";

import { useEffect, useRef } from "react";
import { useCopilot } from "../provider/CopilotProvider";

/**
 * Context item for AI
 */
export interface AIContextItem {
  /** Unique key for this context */
  key: string;
  /** Data to provide to AI (will be JSON stringified) */
  data: unknown;
  /** Optional description to help AI understand the context */
  description?: string;
  /** Parent context ID for hierarchical/nested contexts */
  parentId?: string;
}

/**
 * Hook to provide app state/context to the AI
 *
 * This hook allows you to inject React state into the AI's context,
 * so it can understand and reference your app's current state.
 *
 * @returns Context ID that can be used as `parentId` for nested contexts
 *
 * @example Basic usage
 * ```tsx
 * function CartPage() {
 *   const [cart, setCart] = useState([]);
 *
 *   // Provide cart data to AI
 *   useAIContext({
 *     key: 'cart',
 *     data: cart,
 *     description: 'User shopping cart items',
 *   });
 *
 *   return <CartUI cart={cart} />;
 * }
 * ```
 *
 * @example Nested/hierarchical contexts
 * ```tsx
 * function EmployeeList({ employees }) {
 *   // Parent context - returns ID for nesting
 *   const listId = useAIContext({
 *     key: 'employees',
 *     data: { count: employees.length },
 *     description: 'Employee list',
 *   });
 *
 *   return employees.map(emp => (
 *     <Employee key={emp.id} employee={emp} parentContextId={listId} />
 *   ));
 * }
 *
 * function Employee({ employee, parentContextId }) {
 *   // Child context - nested under parent
 *   useAIContext({
 *     key: `employee-${employee.id}`,
 *     data: employee,
 *     description: employee.name,
 *     parentId: parentContextId,  // Links to parent context
 *   });
 *
 *   return <div>{employee.name}</div>;
 * }
 * ```
 */
export function useAIContext(item: AIContextItem): string | undefined {
  const { addContext, removeContext } = useCopilot();
  const contextIdRef = useRef<string | null>(null);

  // Serialize data for stable dependency comparison (string comparison vs object reference)
  const serializedData =
    typeof item.data === "string" ? item.data : JSON.stringify(item.data);

  useEffect(() => {
    // Format the context value with pretty printing
    const formattedValue =
      typeof item.data === "string"
        ? item.data
        : JSON.stringify(item.data, null, 2);

    const contextString = item.description
      ? `${item.description}:\n${formattedValue}`
      : `${item.key}:\n${formattedValue}`;

    // Add context with optional parentId and store the ID
    contextIdRef.current = addContext(contextString, item.parentId);

    // Cleanup: remove context when component unmounts or deps change
    return () => {
      if (contextIdRef.current) {
        removeContext(contextIdRef.current);
        contextIdRef.current = null;
      }
    };
    // Use serializedData (string) instead of item.data (object) to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    item.key,
    serializedData,
    item.description,
    item.parentId,
    addContext,
    removeContext,
  ]);

  // Return context ID for use as parentId in nested contexts
  return contextIdRef.current ?? undefined;
}

/**
 * Hook to provide multiple context items at once
 *
 * @example
 * ```tsx
 * useAIContexts([
 *   { key: 'user', data: currentUser },
 *   { key: 'cart', data: cartItems },
 *   { key: 'page', data: { route: '/checkout', step: 2 } },
 * ]);
 * ```
 */
export function useAIContexts(items: AIContextItem[]): void {
  const { addContext, removeContext } = useCopilot();
  const contextIdsRef = useRef<string[]>([]);

  // Serialize items for stable dependency comparison (avoids infinite loops with inline arrays)
  const serializedItems = JSON.stringify(
    items.map((item) => ({
      key: item.key,
      data: item.data,
      description: item.description,
      parentId: item.parentId,
    })),
  );

  useEffect(() => {
    // Clear previous contexts
    contextIdsRef.current.forEach((id) => removeContext(id));
    contextIdsRef.current = [];

    // Parse serialized items
    const parsedItems = JSON.parse(serializedItems) as AIContextItem[];

    // Add new contexts
    for (const item of parsedItems) {
      const formattedValue =
        typeof item.data === "string"
          ? item.data
          : JSON.stringify(item.data, null, 2);

      const contextString = item.description
        ? `${item.description}:\n${formattedValue}`
        : `${item.key}:\n${formattedValue}`;

      // Support parentId for nested contexts
      const id = addContext(contextString, item.parentId);
      contextIdsRef.current.push(id);
    }

    // Cleanup
    return () => {
      contextIdsRef.current.forEach((id) => removeContext(id));
      contextIdsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedItems, addContext, removeContext]);
}
