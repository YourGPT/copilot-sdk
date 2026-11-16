/**
 * Content signatures for tool definitions.
 *
 * Tools are usually declared inline in a component, so every render hands the
 * SDK brand-new objects and functions that mean exactly the same thing. Keying
 * registration on identity re-registers each tool on every render, and since
 * registering updates provider state, that re-render registers again: an
 * infinite loop. These helpers describe a tool by what it *is* instead.
 *
 * - Plain data (name, description, schema, flags, arrays) is serialized, with
 *   object keys sorted so property order never matters. Dates, regular
 *   expressions, Maps and Sets serialize by value as well.
 * - Functions count only by presence ("ƒ"). Their latest version is reached
 *   through a ref (see `withLatestFunctions`), so a new closure never needs a
 *   new registration.
 */

import type { ToolDefinition } from "../../core";

const FUNCTION = "ƒ";
const UNREADABLE = Symbol("unreadable");

/** Reads a property without letting a throwing getter take the render down. */
function read(object: Record<string, unknown>, key: string): unknown {
  try {
    return object[key];
  } catch {
    return UNREADABLE;
  }
}

function serialize(value: unknown, seen: WeakSet<object>): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (value === UNREADABLE) return '"[unreadable]"';
  switch (typeof value) {
    case "function":
      return `"${FUNCTION}"`;
    case "bigint":
      return `"${value.toString()}n"`;
    case "symbol":
      return `"${String(value)}"`;
    case "object":
      break;
    default:
      return JSON.stringify(value) ?? "null";
  }

  const object = value as Record<string, unknown>;
  // React elements reference their owner fiber: walking them is slow and unstable.
  if ("$$typeof" in object) return '"[element]"';
  if (value instanceof Date) {
    const time = value.getTime();
    return JSON.stringify(
      Number.isNaN(time) ? "[invalid date]" : value.toISOString(),
    );
  }
  if (value instanceof RegExp) return JSON.stringify(String(value));
  if (seen.has(object)) return '"[circular]"';
  seen.add(object);
  try {
    if (Array.isArray(object)) {
      return `[${object.map((item) => serialize(item, seen)).join(",")}]`;
    }
    if (value instanceof Set) {
      const items = [...value].map((item) => serialize(item, seen)).sort();
      return `{"[set]":[${items.join(",")}]}`;
    }
    if (value instanceof Map) {
      const entries = [...value]
        .map(
          ([key, item]) => `[${serialize(key, seen)},${serialize(item, seen)}]`,
        )
        .sort();
      return `{"[map]":[${entries.join(",")}]}`;
    }
    const entries: string[] = [];
    for (const key of Object.keys(object).sort()) {
      const item = serialize(read(object, key), seen);
      if (item !== "undefined") entries.push(`${JSON.stringify(key)}:${item}`);
    }
    return `{${entries.join(",")}}`;
  } finally {
    seen.delete(object);
  }
}

/** A deterministic string describing a value by content, not identity. */
export function stableSignature(value: unknown): string {
  return serialize(value, new WeakSet());
}

const toolSignatures = new WeakMap<ToolDefinition, string>();

/**
 * Signature of a set of active tools, in registration order. Equal strings
 * mean the provider has nothing new to show, so its state need not change.
 *
 * Each definition's signature is cached by identity, so registering one tool
 * costs one serialization rather than one per registered tool. The tool being
 * registered is passed as `refresh` and always re-serialized: a caller may
 * mutate a definition and register the same object again.
 */
export function toolSetSignature(
  tools: readonly ToolDefinition[],
  refresh?: ToolDefinition,
): string {
  return tools
    .map((tool) => {
      let signature = tool === refresh ? undefined : toolSignatures.get(tool);
      if (signature === undefined) {
        signature = stableSignature(tool);
        toolSignatures.set(tool, signature);
      }
      return signature;
    })
    .join("\n");
}

type AnyFunction = ((...args: unknown[]) => unknown) & { displayName?: string };

/** What a handler returns once its tool has left the toolset. */
const unavailableToolResult = () => ({
  success: false,
  error: "Tool is no longer available",
});

/**
 * Replace each function on `definition` with a wrapper that calls the latest
 * version from `latest()` at call time. Lets a registered tool use fresh
 * closures (handler, render, titles, approval text) without being registered
 * again. Wrappers keep the original's `name` and `displayName`. They are
 * called, never mounted: `render` is invoked as a plain function, so its
 * identity may change between registrations without remounting anything.
 *
 * Each function is invoked as a method on the latest entry, so a handler
 * written as `handler(params) { return this.helper(params) }` keeps working.
 * When `latest()` has no entry (the key left the toolset, or the component
 * unmounted while a call was waiting on approval), `handler` reports the tool
 * as unavailable instead of running the removed closure; display functions
 * fall back to the original.
 */
export function withLatestFunctions<T extends object>(
  definition: T,
  latest: () => object | undefined,
): T {
  const result = { ...definition } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (typeof result[key] !== "function") continue;
    const original = result[key] as AnyFunction;
    const wrapper: AnyFunction = (...args: unknown[]) => {
      const entry = latest() as Record<string, unknown> | undefined;
      const current = entry?.[key];
      if (typeof current === "function") {
        return (current as AnyFunction).apply(entry, args);
      }
      // Shape changes (function → string) re-register, so this is only a guard.
      if (current !== undefined) return current;
      if (key === "handler") return unavailableToolResult();
      return original(...args);
    };
    Object.defineProperty(wrapper, "name", {
      value: original.name,
      configurable: true,
    });
    if (original.displayName !== undefined) {
      wrapper.displayName = original.displayName;
    }
    result[key] = wrapper;
  }
  return result as T;
}
