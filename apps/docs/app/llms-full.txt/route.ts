import { source } from "@/lib/source";
import fs from "fs/promises";
import path from "path";

const baseUrl = "https://copilot-sdk.yourgpt.ai";

export const revalidate = false;

async function getDocFiles(): Promise<Map<string, string>> {
  const docsDir = path.join(process.cwd(), "content/docs");
  const files = await fs.readdir(docsDir, { recursive: true });
  const mdxFiles = new Map<string, string>();

  for (const file of files) {
    if (typeof file === "string" && file.endsWith(".mdx")) {
      const filePath = path.join(docsDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      // Convert file path to URL path (e.g., "react/index.mdx" -> "/docs/react")
      const urlPath =
        "/docs/" + file.replace(/\/index\.mdx$/, "").replace(/\.mdx$/, "");
      mdxFiles.set(urlPath === "/docs/" ? "/docs" : urlPath, content);
    }
  }

  return mdxFiles;
}

export async function GET() {
  const pages = source.getPages();
  const docFiles = await getDocFiles();

  const sections: string[] = [
    "# Copilot SDK - Full Documentation",
    "",
    "> Open-source SDK for building AI assistants with App Context Awareness.",
    "",
    "---",
    "",
  ];

  for (const page of pages) {
    const content = docFiles.get(page.url);

    if (content) {
      // Remove frontmatter
      const contentWithoutFrontmatter = content.replace(
        /^---[\s\S]*?---\n/,
        "",
      );
      // Remove import statements
      const cleanContent = contentWithoutFrontmatter
        .replace(/^import\s+.*?;\n/gm, "")
        .trim();

      sections.push(`## ${page.data.title}`);
      sections.push(`URL: ${baseUrl}${page.url}`);
      if (page.data.description) {
        sections.push(`Description: ${page.data.description}`);
      }
      sections.push("");
      sections.push(cleanContent);
      sections.push("");
      sections.push("---");
      sections.push("");
    }
  }

  return new Response(sections.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
