import Link from "next/link";

const demos = [
  {
    name: "Non-Streaming",
    href: "/non-streaming",
    description: "runtime.generate() with CopilotChat",
  },
  {
    name: "Theme Demo",
    href: "/theme-demo",
    description: "9 theme presets with live preview",
  },
  {
    name: "Multi-Provider",
    href: "/providers",
    description: "OpenAI, Anthropic, Google side-by-side",
  },
  {
    name: "Compound Components",
    href: "/compound-test",
    description: "Custom home screen with Chat.Home, Chat.Input",
  },
  {
    name: "Tool Types",
    href: "/tool-types-demo",
    description: "Different tool rendering patterns",
  },
  {
    name: "Tool Scale Lab",
    href: "/tool-scale",
    description: "100-tool profile, search, and deferred-loading demo",
  },
  {
    name: "Widgets",
    href: "/widgets",
    description: "Standalone UI components",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="text-2xl font-bold">Copilot SDK</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Experimental Examples
          </p>
        </header>

        <nav className="space-y-2">
          {demos.map((demo) => (
            <Link
              key={demo.href}
              href={demo.href}
              className="block p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="font-medium">{demo.name}</div>
              <div className="text-sm text-muted-foreground">
                {demo.description}
              </div>
            </Link>
          ))}
        </nav>

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-muted rounded border">Cmd+J</kbd>{" "}
          toggle dark mode
        </footer>
      </div>
    </div>
  );
}
