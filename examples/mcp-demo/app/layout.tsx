import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Demo - YourGPT Copilot SDK",
  description:
    "Demo of MCP (Model Context Protocol) integration with Copilot SDK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
