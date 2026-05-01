import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { createElement } from "react";
import {
  Rocket,
  Package,
  Atom,
  Palette,
  Zap,
  Code2,
  Settings,
  Blocks,
  Hammer,
  Plug,
  Globe,
  Layers,
  MonitorSmartphone,
  RefreshCw,
  Box,
  Anchor,
  Component,
  SquareCode,
  Triangle,
  Image,
  Lightbulb,
  Database,
} from "lucide-react";

// Custom icons
import {
  BrainIcon,
  RobotIcon,
  NotebookIcon,
  RocketIcon,
  MessageQuestionIcon,
  AiChip1,
  Grid1,
  SlidersHorizontalIcon,
  AiBookIcon,
  MagicWandIcon,
  PuzzleIcon,
  BubbleChatIcon,
  FileCodeIcon,
  ServerStackIcon,
  AiMagicIcon,
} from "@/components/icons";

const icons: Record<string, React.ComponentType> = {
  // Lucide icons
  Rocket,
  Package,
  Atom,
  Palette,
  Zap,
  Code2,
  Settings,
  Blocks,
  Hammer,
  Plug,
  Globe,
  Layers,
  MonitorSmartphone,
  RefreshCw,
  Box,
  Anchor,
  Component,
  SquareCode,
  TriangleRight: Triangle,
  Image,
  Lightbulb,
  Database,
  // Custom icons
  Brain: BrainIcon,
  Robot: RobotIcon,
  Notebook: NotebookIcon,
  RocketCustom: RocketIcon,
  MessageQuestion: MessageQuestionIcon,
  AiChip1: AiChip1,
  Grid1: Grid1,
  // Hugeicons duotone
  SlidersHorizontal: SlidersHorizontalIcon,
  AiBook: AiBookIcon,
  MagicWand: MagicWandIcon,
  Puzzle: PuzzleIcon,
  BubbleChat: BubbleChatIcon,
  FileCode: FileCodeIcon,
  Server: ServerStackIcon,
  AiMagic: AiMagicIcon,
};

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (!icon || !(icon in icons)) return;
    return createElement(icons[icon]);
  },
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/og/${segments.join("/")}`,
  };
}
