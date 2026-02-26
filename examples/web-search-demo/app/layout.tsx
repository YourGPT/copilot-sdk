import type { Metadata } from "next";
import "./globals.css";
import "@yourgpt/copilot-sdk/ui/themes/modern-minimal.css";

export const metadata: Metadata = {
  title: "Web Search Demo - YourGPT Copilot SDK",
  description:
    "AI assistant with real-time web search capabilities using YourGPT Copilot SDK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
