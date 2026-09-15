import { memo, ComponentProps } from "react";
import { Streamdown, LinkSafetyConfig, StreamdownProps } from "streamdown";
import { code } from "@streamdown/code";

export type MarkdownProps = {
  children: string;
  id?: string;
  className?: string;
  isStreaming?: boolean;
  /** Link safety modal configuration. Disabled by default. */
  linkSafety?: LinkSafetyConfig;
  /**
   * How raw HTML in the markdown is treated.
   * - "literal" (default): shown as typed. A chat surface shows text; a person pasting
   *   `<script>` wants to see it, and a model asked to "send this snippet" returns it as
   *   text too — often unfenced. Under "render" both vanish (see below).
   * - "render": parsed into elements. Opt in only for trusted, deliberately-HTML content.
   */
  rawHtml?: "render" | "literal";
};

// Streamdown always runs rehype-raw, so raw HTML in the markdown becomes real DOM: the
// sanitizer then strips `<script>` outright — an assistant reply consisting of a script tag
// renders as an EMPTY bubble — and rewrites the rest into whatever its allow-list permits.
// Neither `skipHtml` nor `allowedTags` prevents that: both act AFTER the raw pass.
//
// The conversion from markdown (mdast) to HTML (hast) is the last point before that pass, and
// remark-rehype exposes it as a per-node handler. Turning an `html` node into a `text` node
// there means the raw parser never sees markup at all. Preferred over passing `remarkPlugins`:
// that prop REPLACES Streamdown's defaults rather than merging, so every default (remark-gfm —
// tables, strikethrough, autolinks, task lists) would have to be repeated here and kept in sync
// with upstream forever. This hook leaves the whole default pipeline, and the rehype
// sanitization that follows it, untouched.
type RemarkRehypeOptions = NonNullable<StreamdownProps["remarkRehypeOptions"]>;
// Derived from Streamdown's own prop type rather than importing mdast-util-to-hast directly:
// that package is a transitive dependency here, so naming it would add coupling (and a version
// to keep in step) for two parameter types.
type HtmlHandler = NonNullable<
  NonNullable<RemarkRehypeOptions["handlers"]>["html"]
>;
type HastContent = Exclude<ReturnType<HtmlHandler>, undefined | unknown[]>;

// mdast parents whose children are flow (block) content. An `html` node under one of these is
// a block-level HTML node; anywhere else (paragraph, heading, table cell, emphasis, link...) it
// is inline. Listing the flow parents rather than the phrasing ones keeps the default the safe
// one: an unknown parent is treated as inline and gets a bare text node.
const FLOW_PARENTS = new Set([
  "root",
  "blockquote",
  "listItem",
  "footnoteDefinition",
]);

const htmlAsText: HtmlHandler = (state, node, parent) => {
  const value = (node as { value: string }).value;

  // Inline HTML already sits inside an element, so a bare text node lands in place.
  if (parent && !FLOW_PARENTS.has(parent.type)) {
    const text = { type: "text" as const, value };
    state.patch(node, text);
    return text;
  }

  // Block-level HTML is a direct child of the root (or a blockquote / list item), and the
  // root handler does not wrap text in <p>. Left bare it would collapse onto one line under
  // `whitespace-normal` and get neither paragraph spacing nor the streaming caret. Wrap it
  // and turn its newlines into <br> so a multi-line snippet still reads as typed.
  // (Indentation still collapses; only <pre> would keep it, and Streamdown treats <pre> as a
  // code block.)
  const children: HastContent[] = [];
  value.split("\n").forEach((line, i) => {
    if (i > 0) {
      children.push({
        type: "element",
        tagName: "br",
        properties: {},
        children: [],
      });
    }
    children.push({ type: "text", value: line });
  });
  const result = {
    type: "element" as const,
    tagName: "p",
    properties: {},
    children,
  };
  state.patch(node, result);
  return result;
};

const HTML_AS_TEXT: RemarkRehypeOptions = Object.assign(
  { handlers: { html: htmlAsText } } satisfies RemarkRehypeOptions,
  // Streamdown keys its module-global processor cache by `JSON.stringify(remarkRehypeOptions)`,
  // and JSON drops function values — so this object would serialise to `{"handlers":{}}`, the
  // same key as any other <Streamdown> on the page that passes its own `handlers`. Whichever
  // mounted first would supply the processor for both. remark-rehype ignores unknown options,
  // so this marker exists only to make the cache key distinct.
  { __csdkRawHtml: "literal" },
);

// Hoisted so the identity is stable across renders — an inline object would be a new value
// every time and defeat Streamdown's internal memoisation.
const PLUGINS = { code };

// Normalized heading component for chat UI (same size, just bold)
// Ignore Streamdown's className to prevent its text-3xl etc. from overriding
const createHeading = (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") => {
  const HeadingComponent = ({
    children,
    className: _,
    ...props
  }: ComponentProps<typeof Tag>) => (
    <Tag className="text-[1em] font-semibold my-2 first:mt-0" {...props}>
      {children}
    </Tag>
  );
  HeadingComponent.displayName = Tag.toUpperCase();
  return HeadingComponent;
};

const headingComponents = {
  h1: createHeading("h1"),
  h2: createHeading("h2"),
  h3: createHeading("h3"),
  h4: createHeading("h4"),
  h5: createHeading("h5"),
  h6: createHeading("h6"),
};

function MarkdownComponent({
  children,
  className,
  isStreaming = false,
  linkSafety = { enabled: false },
  rawHtml = "literal",
}: MarkdownProps) {
  return (
    <div className={className}>
      <Streamdown
        // Remount when the policy flips. Streamdown memoises its rendered elements by source
        // POSITION, and switching `rawHtml` leaves every position unchanged — so without a new
        // key the already-rendered output survives the switch (literal text stays literal after
        // switching to "render", and vice versa) until the message text itself changes.
        key={rawHtml}
        plugins={PLUGINS}
        remarkRehypeOptions={rawHtml === "literal" ? HTML_AS_TEXT : undefined}
        isAnimating={isStreaming}
        components={headingComponents}
        linkSafety={linkSafety}
      >
        {children}
      </Streamdown>
    </div>
  );
}

const Markdown = memo(MarkdownComponent);
Markdown.displayName = "Markdown";

export { Markdown };
export type { LinkSafetyConfig } from "streamdown";
