// Tool registration must be stable across renders.
//
// Tools are usually declared inline, so each render passes new objects that
// mean the same thing. 2.6.0 re-registered on identity and every registration
// updated provider state, so inline schemas (and SkillProvider's own
// load_skill tool) re-rendered forever. These tests render the built package
// with react-test-renderer and fail fast instead of hanging if a loop returns.
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");

const sdkRoot = path.resolve(__dirname, "../packages/copilot-sdk");
const sdkRequire = createRequire(path.join(sdkRoot, "package.json"));
const React = sdkRequire("react");
const TestRenderer = sdkRequire("react-test-renderer");
const { z } = sdkRequire("zod");
const {
  CopilotProvider,
  SkillProvider,
  defineSkill,
  useCopilot,
  useTool,
  useTools,
  useToolWithSchema,
  useToolsWithSchema,
} = sdkRequire("./dist/react/index.cjs");

const h = React.createElement;
const { act } = TestRenderer;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// A loop renders without end; throwing past this cap turns a hang into a failure.
const RENDER_CAP = 50;
let renders;
let depthErrors;
let originalError;
let copilot;
let mounted;

beforeEach(() => {
  renders = new Map();
  depthErrors = 0;
  copilot = undefined;
  mounted = [];
  originalError = console.error;
  console.error = (...args) => {
    if (String(args[0]).includes("Maximum update depth")) depthErrors++;
    else if (!String(args[0]).includes("The above error occurred")) {
      originalError(...args);
    }
  };
});

afterEach(async () => {
  for (const root of mounted) await act(async () => root.unmount());
  console.error = originalError;
});

function countRender(label) {
  const count = (renders.get(label) ?? 0) + 1;
  renders.set(label, count);
  if (count > RENDER_CAP) throw new Error(`${label} re-rendered in a loop`);
}

/** Captures the copilot context so tests can read what is registered. */
function Probe() {
  copilot = useCopilot();
  countRender("Probe");
  return null;
}

async function mount(children, { strict = false } = {}) {
  let element = h(
    CopilotProvider,
    { runtimeUrl: "/api/copilot" },
    children,
    h(Probe),
  );
  if (strict) element = h(React.StrictMode, null, element);
  let root;
  await act(async () => {
    root = TestRenderer.create(element);
  });
  mounted.push(root);
  return root;
}

async function update(root, children) {
  await act(async () => {
    root.update(
      h(CopilotProvider, { runtimeUrl: "/api/copilot" }, children, h(Probe)),
    );
  });
}

const fresh = () => copilot.getRegisteredTools();
const shown = (name) => copilot.registeredTools.find((t) => t.name === name);
const live = (name) => fresh().find((t) => t.name === name);

function assertSettled() {
  assert.equal(depthErrors, 0, "React reported an update-depth loop");
  for (const [label, count] of renders) {
    assert.ok(count <= 10, `${label} rendered ${count} times`);
  }
}

// ---------------------------------------------------------------------------
// The loop itself
// ---------------------------------------------------------------------------

function InlineJsonTool({ label = "x" }) {
  countRender("InlineJsonTool");
  useTool({
    name: "inline_json",
    description: `Inline JSON schema ${label}`,
    inputSchema: { type: "object", properties: { id: { type: "string" } } },
    handler: async () => ({ success: true }),
  });
  return null;
}

test("useTool with an inline JSON schema settles and registers once", async () => {
  await mount(h(InlineJsonTool));
  assertSettled();
  assert.equal(fresh().filter((t) => t.name === "inline_json").length, 1);
  assert.ok(shown("inline_json"), "registeredTools shows the tool");
});

test("useTool with an inline Zod schema settles", async () => {
  function InlineZodTool() {
    countRender("InlineZodTool");
    useTool({
      name: "inline_zod",
      description: "Inline Zod schema",
      inputSchema: z.object({ query: z.string() }),
      handler: async () => ({ success: true }),
    });
    return null;
  }
  await mount(h(InlineZodTool));
  assertSettled();
  assert.deepEqual(live("inline_zod").inputSchema.required, ["query"]);
});

test("useToolWithSchema with an inline z.object settles", async () => {
  function InlineSchemaTool() {
    countRender("InlineSchemaTool");
    useToolWithSchema({
      name: "with_schema",
      description: "Inline schema",
      schema: z.object({ path: z.string() }),
      handler: async () => ({ success: true }),
    });
    return null;
  }
  await mount(h(InlineSchemaTool));
  assertSettled();
  assert.ok(live("with_schema"));
});

test("useTools with an inline toolset settles", async () => {
  function InlineToolset() {
    countRender("InlineToolset");
    useTools({
      lookup: {
        description: "lookup",
        location: "client",
        inputSchema: { type: "object", properties: {} },
        handler: () => ({ success: true }),
      },
    });
    return null;
  }
  await mount(h(InlineToolset));
  assertSettled();
  assert.ok(live("lookup"));
});

test("SkillProvider settles with an inline skills array and registers load_skill", async () => {
  const skill = defineSkill({
    name: "demo",
    description: "Demo skill",
    source: { type: "inline", content: "Say hello." },
  });
  function Child() {
    countRender("SkillChild");
    return null;
  }
  const tree = () => h(SkillProvider, { skills: [skill] }, h(Child));
  const root = await mount(tree());
  // A parent re-render passes a brand-new skills array with the same content.
  for (let i = 0; i < 3; i++) await update(root, tree());
  assertSettled();
  assert.ok(live("load_skill"), "load_skill is registered");
  const result = await live("load_skill").handler({ name: "demo" });
  assert.equal(result.success, true);
  assert.equal(result.content, "Say hello.");
});

test("a custom component that registers in an effect without deps cannot loop the provider", async () => {
  // Pre-2.6 code like this was harmless; the provider must not turn it into a loop.
  function ManualRegister() {
    countRender("ManualRegister");
    const { registerTool, unregisterTool } = useCopilot();
    React.useEffect(() => {
      registerTool({
        name: "manual",
        description: "Registered by hand",
        location: "client",
        inputSchema: { type: "object", properties: {} },
        handler: async () => ({ success: true }),
      });
      return () => unregisterTool("manual");
    });
    return null;
  }
  await mount(h(ManualRegister));
  assertSettled();
  assert.ok(shown("manual"));
});

// ---------------------------------------------------------------------------
// Real changes still reach the provider and the chat
// ---------------------------------------------------------------------------

test("re-rendering with the same content keeps the registered definition", async () => {
  const root = await mount(h(InlineJsonTool));
  const before = live("inline_json");
  for (let i = 0; i < 3; i++) await update(root, h(InlineJsonTool));
  assert.equal(
    live("inline_json"),
    before,
    "no re-registration on equal content",
  );
  assertSettled();
});

test("a changed description re-registers and shows in registeredTools", async () => {
  const root = await mount(h(InlineJsonTool, { label: "one" }));
  assert.equal(shown("inline_json").description, "Inline JSON schema one");
  await update(root, h(InlineJsonTool, { label: "two" }));
  assert.equal(live("inline_json").description, "Inline JSON schema two");
  assert.equal(shown("inline_json").description, "Inline JSON schema two");
  assertSettled();
});

test("a changed schema re-registers with the new schema", async () => {
  function SchemaTool({ field }) {
    useTool({
      name: "schema_change",
      description: "Schema change",
      inputSchema: {
        type: "object",
        properties: { [field]: { type: "string" } },
      },
      handler: async () => ({ success: true }),
    });
    return null;
  }
  const root = await mount(h(SchemaTool, { field: "a" }));
  await update(root, h(SchemaTool, { field: "b" }));
  assert.deepEqual(Object.keys(live("schema_change").inputSchema.properties), [
    "b",
  ]);
  assertSettled();
});

test("availability and hidden flags still update registeredTools", async () => {
  function FlagTool({ available, hidden }) {
    useTools({
      flagged: {
        description: "flagged",
        location: "client",
        available,
        hidden,
        inputSchema: { type: "object", properties: {} },
        handler: () => ({ success: true }),
      },
    });
    return null;
  }
  const root = await mount(h(FlagTool, { available: true, hidden: false }));
  assert.equal(shown("flagged").available, true);
  await update(root, h(FlagTool, { available: false, hidden: true }));
  assert.equal(shown("flagged").available, false);
  assert.equal(shown("flagged").hidden, true);
  assertSettled();
});

test("mounting and unmounting a tool updates registeredTools", async () => {
  const root = await mount(null);
  assert.equal(shown("inline_json"), undefined);
  await update(root, h(InlineJsonTool));
  assert.ok(shown("inline_json"), "shown after mount");
  await update(root, null);
  assert.equal(shown("inline_json"), undefined, "gone after unmount");
  assertSettled();
});

test("render, title and handler use the latest closures without re-registering", async () => {
  function Counter({ count }) {
    useTool({
      name: "counter",
      description: "Counter",
      inputSchema: { type: "object", properties: {} },
      title: () => `count ${count}`,
      render: () => `rendered ${count}`,
      handler: async () => ({ success: true, data: count }),
    });
    return null;
  }
  const root = await mount(h(Counter, { count: 1 }));
  const registered = live("counter");
  await update(root, h(Counter, { count: 2 }));
  assert.equal(live("counter"), registered, "same registration");
  assert.equal(registered.title({}), "count 2");
  assert.equal(registered.render({}), "rendered 2");
  assert.equal((await registered.handler({})).data, 2);
  assertSettled();
});

test("switching a field between text and a function re-registers", async () => {
  function Titled({ dynamic }) {
    useTool({
      name: "titled",
      description: "Titled",
      inputSchema: { type: "object", properties: {} },
      title: dynamic ? () => "from function" : "plain text",
      handler: async () => ({ success: true }),
    });
    return null;
  }
  const root = await mount(h(Titled, { dynamic: false }));
  assert.equal(live("titled").title, "plain text");
  await update(root, h(Titled, { dynamic: true }));
  assert.equal(typeof live("titled").title, "function");
  assert.equal(live("titled").title({}), "from function");
  assertSettled();
});

test("explicit dependencies still force re-registration", async () => {
  function WithDeps({ version }) {
    useTool(
      {
        name: "with_deps",
        description: "With deps",
        inputSchema: { type: "object", properties: {} },
        handler: async () => ({ success: true }),
      },
      [version],
    );
    return null;
  }
  const root = await mount(h(WithDeps, { version: 1 }));
  const before = live("with_deps");
  await update(root, h(WithDeps, { version: 2 }));
  assert.notEqual(
    live("with_deps"),
    before,
    "re-registered for a new dependency",
  );
  assertSettled();
});

test("tools stay registered under StrictMode double effects", async () => {
  await mount(h(InlineJsonTool), { strict: true });
  assertSettled();
  assert.ok(shown("inline_json"));
  assert.equal(fresh().filter((t) => t.name === "inline_json").length, 1);
});

test("property order in an inline schema does not cause re-registration", async () => {
  function Reordered({ flip }) {
    const properties = flip
      ? { b: { type: "string" }, a: { type: "string" } }
      : { a: { type: "string" }, b: { type: "string" } };
    useTool({
      name: "reordered",
      description: "Reordered",
      inputSchema: { type: "object", properties },
      handler: async () => ({ success: true }),
    });
    return null;
  }
  const root = await mount(h(Reordered, { flip: false }));
  const before = live("reordered");
  await update(root, h(Reordered, { flip: true }));
  assert.equal(live("reordered"), before);
  assertSettled();
});

test("a self-referencing schema does not crash the signature", async () => {
  function Circular() {
    const schema = { type: "object", properties: {} };
    schema.properties.self = schema;
    useTool({
      name: "circular",
      description: "Circular",
      inputSchema: schema,
      handler: async () => ({ success: true }),
    });
    return null;
  }
  await mount(h(Circular));
  assertSettled();
  assert.ok(live("circular"));
});

// ---------------------------------------------------------------------------
// registeredTools always exposes the latest closures
// ---------------------------------------------------------------------------

test("registeredTools serves the new component after a same-name handoff", async () => {
  function RouteA() {
    useTool({
      name: "navigate",
      description: "Navigate",
      inputSchema: { type: "object", properties: {} },
      render: () => "page A",
      handler: async () => ({ success: true, data: "A" }),
    });
    return null;
  }
  function RouteB() {
    useTool({
      name: "navigate",
      description: "Navigate",
      inputSchema: { type: "object", properties: {} },
      render: () => "page B",
      handler: async () => ({ success: true, data: "B" }),
    });
    return null;
  }
  const root = await mount(h(RouteA));
  assert.equal(shown("navigate").render({}), "page A");
  await update(root, h(RouteB));
  assert.equal(shown("navigate").render({}), "page B");
  assert.equal((await shown("navigate").handler({})).data, "B");
  assertSettled();
});

test("registeredTools follows a manual registration keyed on state", async () => {
  function Manual({ count }) {
    const { registerTool, unregisterTool } = useCopilot();
    React.useEffect(() => {
      registerTool({
        name: "manual",
        description: "Manual",
        location: "client",
        inputSchema: { type: "object", properties: {} },
        render: () => `count ${count}`,
        handler: async () => ({ success: true }),
      });
      return () => unregisterTool("manual");
    }, [count, registerTool, unregisterTool]);
    return null;
  }
  const root = await mount(h(Manual, { count: 1 }));
  assert.equal(shown("manual").render({}), "count 1");
  await update(root, h(Manual, { count: 2 }));
  assert.equal(shown("manual").render({}), "count 2");
  assertSettled();
});

test("re-registering a mutated definition object updates registeredTools", async () => {
  const shared = {
    name: "mutable",
    description: "Mutable",
    location: "client",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({ success: true }),
    hidden: false,
  };
  function Mutate({ hidden }) {
    const { registerTool, unregisterTool } = useCopilot();
    React.useEffect(() => {
      shared.hidden = hidden;
      registerTool(shared);
      return () => unregisterTool("mutable");
    }, [hidden, registerTool, unregisterTool]);
    return null;
  }
  const root = await mount(h(Mutate, { hidden: false }));
  const before = copilot.registeredTools;
  await update(root, h(Mutate, { hidden: true }));
  assert.equal(shown("mutable").hidden, true);
  assert.notEqual(
    copilot.registeredTools,
    before,
    "a content change yields a new array",
  );
  assertSettled();
});

// ---------------------------------------------------------------------------
// Every hook forwards every field and calls the latest functions
// ---------------------------------------------------------------------------

test("useToolsWithSchema forwards render and calls the latest one", async () => {
  function Charts({ label }) {
    useToolsWithSchema([
      {
        name: "chart",
        description: "Chart",
        schema: z.object({ x: z.string() }),
        handler: async () => ({ success: true }),
        render: () => `chart ${label}`,
      },
    ]);
    return null;
  }
  const root = await mount(h(Charts, { label: "one" }));
  const registered = live("chart");
  assert.equal(registered.render({}), "chart one");
  await update(root, h(Charts, { label: "two" }));
  assert.equal(live("chart"), registered, "same registration");
  assert.equal(registered.render({}), "chart two");
  assertSettled();
});

test("a tool without toModelOutput registers none", async () => {
  await mount(h(InlineJsonTool));
  assert.equal(live("inline_json").toModelOutput, undefined);
});

test("registered functions keep their names", async () => {
  function renderCounter() {
    return "r";
  }
  function Named() {
    useTool({
      name: "named",
      description: "Named",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ success: true }),
      render: renderCounter,
    });
    return null;
  }
  await mount(h(Named));
  assert.equal(live("named").render.name, "renderCounter");
  assert.equal(live("named").render({}), "r");
});

// ---------------------------------------------------------------------------
// The content key sees every value
// ---------------------------------------------------------------------------

test("Dates and Sets in a config take part in the content key", async () => {
  function Dated({ since, keywords }) {
    useTool({
      name: "dated",
      description: "Dated",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ success: true }),
      searchKeywords: keywords,
      resultConfig: { since },
    });
    return null;
  }
  const root = await mount(
    h(Dated, { since: new Date("2020-01-01"), keywords: new Set(["a"]) }),
  );
  const before = live("dated");
  await update(
    root,
    h(Dated, { since: new Date("2020-01-01"), keywords: new Set(["a"]) }),
  );
  assert.equal(live("dated"), before, "equal values do not re-register");
  await update(
    root,
    h(Dated, { since: new Date("2021-01-01"), keywords: new Set(["b"]) }),
  );
  assert.notEqual(live("dated"), before, "changed values re-register");
  assert.deepEqual([...live("dated").searchKeywords], ["b"]);
  assertSettled();
});

test("a throwing getter on a config value does not break registration", async () => {
  function Getter() {
    useTool({
      name: "getter",
      description: "Getter",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ success: true }),
      resultConfig: {
        get boom() {
          throw new Error("boom");
        },
      },
    });
    return null;
  }
  await mount(h(Getter));
  assertSettled();
  assert.ok(live("getter"));
});

// ---------------------------------------------------------------------------
// No wasted work
// ---------------------------------------------------------------------------

test("a stable Zod schema is converted once", async () => {
  const reads = [];
  const schema = new Proxy(z.object({ x: z.string() }), {
    get(target, key) {
      reads.push(key);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  function Stable() {
    useToolsWithSchema([
      {
        name: "stable",
        description: "Stable",
        schema,
        handler: async () => ({ success: true }),
      },
    ]);
    return null;
  }
  const root = await mount(h(Stable));
  assert.ok(reads.length > 0, "converted on mount");
  reads.length = 0;
  await update(root, h(Stable));
  assert.equal(reads.length, 0, "not converted again on a no-change re-render");
  assertSettled();
});

test("a skills change does not re-register load_skill", async () => {
  const one = defineSkill({
    name: "one",
    description: "One",
    source: { type: "inline", content: "one" },
  });
  const two = defineSkill({
    name: "two",
    description: "Two",
    source: { type: "inline", content: "two" },
  });
  const root = await mount(h(SkillProvider, { skills: [one] }));
  const before = live("load_skill");
  await update(root, h(SkillProvider, { skills: [one, two] }));
  assert.equal(live("load_skill"), before, "load_skill registered once");
  assert.equal(
    (await live("load_skill").handler({ name: "two" })).content,
    "two",
  );
  assertSettled();
});

// ---------------------------------------------------------------------------
// Latest-closure wrappers: `this`, removed tools, per-render content
// ---------------------------------------------------------------------------

test("handlers written as methods keep `this`", async () => {
  function Methods() {
    useTools({
      lookup: {
        description: "lookup",
        inputSchema: { type: "object", properties: {} },
        helper(params) {
          return { success: true, via: "helper", params };
        },
        handler(params) {
          return this.helper(params);
        },
      },
    });
    useTool({
      name: "single",
      description: "single",
      inputSchema: { type: "object", properties: {} },
      helper() {
        return "ok";
      },
      handler() {
        return { success: true, value: this.helper() };
      },
    });
    return null;
  }
  await mount(h(Methods));
  assert.deepEqual(await live("lookup").handler({ q: 1 }, {}), {
    success: true,
    via: "helper",
    params: { q: 1 },
  });
  assert.equal((await live("single").handler({}, {})).value, "ok");
  assertSettled();
});

test("a tool dropped from a toolset reports unavailable instead of running its old handler", async () => {
  let ran = 0;
  const toolset = (withB) => ({
    a: {
      description: "a",
      inputSchema: { type: "object", properties: {} },
      handler: () => ({ success: true }),
    },
    ...(withB
      ? {
          b: {
            description: "b",
            inputSchema: { type: "object", properties: {} },
            handler: () => {
              ran++;
              return { success: true };
            },
          },
        }
      : {}),
  });
  function Toolset({ withB }) {
    useTools(toolset(withB));
    return null;
  }
  const root = await mount(h(Toolset, { withB: true }));
  // The chat loop holds the definition while a call waits on approval.
  const held = live("b");
  await update(root, h(Toolset, { withB: false }));
  assert.equal(live("b"), undefined, "b is unregistered");
  assert.deepEqual(await held.handler({}, {}), {
    success: false,
    error: "Tool is no longer available",
  });
  assert.equal(ran, 0, "the removed handler did not run");
  assertSettled();
});

test("a config that changes on every render is named in a warning before React gives up", async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(String(args[0]));
  let tick = 0;
  function Clock() {
    countRender("Clock");
    useTool({
      name: "now",
      description: `Time is ${++tick}`,
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ success: true }),
    });
    return null;
  }
  let threw;
  try {
    await mount(h(Clock));
  } catch (error) {
    threw = error;
  } finally {
    console.warn = originalWarn;
  }
  assert.ok(threw || depthErrors > 0, "the loop is still a loop");
  assert.ok(
    warnings.some((w) => w.includes('Tool "now"')),
    "the warning names the tool",
  );
});
