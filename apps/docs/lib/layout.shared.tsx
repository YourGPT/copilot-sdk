import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BookOpen, Github } from "lucide-react";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "YourGPT Copilot",
    },
    links: [
      {
        type: "icon",
        icon: <BookOpen />,
        text: "Docs",
        url: "/docs",
        active: "nested-url",
      },
      {
        type: "icon",
        icon: <Github />,
        text: "GitHub",
        url: "https://github.com/YourGPT/copilot-sdk",
        external: true,
      },
    ],
  };
}
