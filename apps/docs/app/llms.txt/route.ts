import { source } from "@/lib/source";

const baseUrl = "https://copilot-sdk.yourgpt.ai";

export const revalidate = false;

export function GET() {
  const pages = source.getPages();

  const content = `# Copilot SDK

> Open-source SDK for building AI assistants with App Context Awareness.

## Documentation Pages

${pages.map((page) => `- [${page.data.title}](${baseUrl}${page.url}): ${page.data.description || ""}`).join("\n")}

## Full Documentation

For the complete documentation content, see: ${baseUrl}/llms-full.txt
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
