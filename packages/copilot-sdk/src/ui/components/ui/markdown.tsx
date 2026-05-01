import { memo, ComponentProps } from "react";
import { Streamdown, LinkSafetyConfig } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";

export type MarkdownProps = {
  children: string;
  id?: string;
  className?: string;
  isStreaming?: boolean;
  /** Link safety modal configuration. Disabled by default. */
  linkSafety?: LinkSafetyConfig;
};

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
}: MarkdownProps) {
  return (
    <div className={className}>
      <Streamdown
        plugins={{ code, math }}
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
