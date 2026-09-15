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

const htmlAsText: HtmlHandler = (state, node) => {
  const result = {
    type: "text" as const,
    value: (node as { value: string }).value,
  };
  state.patch(node, result);
  return result;
};

const HTML_AS_TEXT = {
  handlers: { html: htmlAsText },
} satisfies RemarkRehypeOptions;

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
