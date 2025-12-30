import { RootProvider } from "fumadocs-ui/provider/next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Copilot SDK",
    default: "Copilot SDK - AI SDK for React",
  },
  description:
    "Open-source SDK for building AI-powered chat interfaces in React",
  metadataBase: new URL("https://copilot.yourgpt.ai"),
  openGraph: {
    title: "Copilot SDK - AI SDK for React",
    description:
      "Open-source SDK for building AI-powered chat interfaces in React",
    siteName: "Copilot SDK",
    type: "website",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Copilot SDK - AI SDK for React",
    description:
      "Open-source SDK for building AI-powered chat interfaces in React",
    images: ["/og-image.png"],
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
