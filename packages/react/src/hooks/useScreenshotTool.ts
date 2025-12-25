"use client";

import { useEffect, useCallback } from "react";
import { captureScreenshot, type ScreenshotOptions } from "@yourgpt/core";
import { useYourGPTContext } from "../context/YourGPTContext";

/**
 * Screenshot tool options
 */
export interface UseScreenshotToolOptions {
  /**
   * Whether to require approval before capturing
   * @default true
   */
  needsApproval?: boolean;
  /**
   * Custom approval message
   */
  approvalMessage?: string;
  /**
   * Screenshot capture options
   */
  screenshotOptions?: ScreenshotOptions;
  /**
   * Callback when screenshot is captured
   */
  onCapture?: (screenshot: {
    data: string;
    width: number;
    height: number;
  }) => void;
  /**
   * Whether to auto-register the tool on mount
   * @default true
   */
  autoRegister?: boolean;
}

/**
 * Screenshot tool return type
 */
export interface UseScreenshotToolReturn {
  /**
   * Manually capture a screenshot
   */
  capture: () => Promise<{ data: string; width: number; height: number }>;
  /**
   * Register the screenshot tool
   */
  register: () => void;
  /**
   * Unregister the screenshot tool
   */
  unregister: () => void;
}

/**
 * Hook to register a screenshot tool for AI to use
 *
 * The tool captures a screenshot of the current viewport and returns it
 * as an attachment that can be analyzed by vision-capable AI models.
 *
 * @example
 * ```tsx
 * function App() {
 *   // Auto-registers on mount
 *   useScreenshotTool({
 *     needsApproval: true,
 *     approvalMessage: "Take a screenshot to analyze the page?",
 *   });
 *
 *   return <CopilotChat />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * function App() {
 *   const { capture } = useScreenshotTool({ autoRegister: false });
 *
 *   // Manual capture
 *   const handleCapture = async () => {
 *     const screenshot = await capture();
 *     console.log("Captured:", screenshot.width, "x", screenshot.height);
 *   };
 *
 *   return <button onClick={handleCapture}>Capture</button>;
 * }
 * ```
 */
export function useScreenshotTool(
  options: UseScreenshotToolOptions = {},
): UseScreenshotToolReturn {
  const { registerTool, unregisterTool } = useYourGPTContext();

  const {
    needsApproval = true,
    approvalMessage = "Take a screenshot of the current screen?",
    screenshotOptions,
    onCapture,
    autoRegister = true,
  } = options;

  /**
   * Capture a screenshot
   */
  const capture = useCallback(async () => {
    const result = await captureScreenshot(screenshotOptions);
    const screenshot = {
      data: result.data,
      width: result.width,
      height: result.height,
    };
    onCapture?.(screenshot);
    return screenshot;
  }, [screenshotOptions, onCapture]);

  /**
   * Register the screenshot tool
   */
  const register = useCallback(() => {
    registerTool({
      name: "capture_screenshot",
      description:
        "Capture a screenshot of the current viewport for visual analysis. Use this when you need to see what the user is looking at or analyze the page layout.",
      location: "client",
      inputSchema: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Brief reason for capturing the screenshot",
          },
        },
      },
      needsApproval,
      approvalMessage: (params: { reason?: string }) =>
        params?.reason
          ? `Take a screenshot to ${params.reason}?`
          : approvalMessage,
      handler: async (params: { reason?: string }) => {
        try {
          const screenshot = await capture();

          return {
            success: true,
            message: `Screenshot captured successfully (${screenshot.width}x${screenshot.height})`,
            data: {
              attachment: {
                type: "image" as const,
                data: screenshot.data,
                mimeType: "image/png",
                filename: "screenshot.png",
              },
              dimensions: {
                width: screenshot.width,
                height: screenshot.height,
              },
            },
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to capture screenshot",
          };
        }
      },
    });
  }, [registerTool, needsApproval, approvalMessage, capture]);

  /**
   * Unregister the screenshot tool
   */
  const unregister = useCallback(() => {
    unregisterTool("capture_screenshot");
  }, [unregisterTool]);

  // Auto-register on mount if enabled
  useEffect(() => {
    if (autoRegister) {
      register();
      return () => unregister();
    }
  }, [autoRegister, register, unregister]);

  return {
    capture,
    register,
    unregister,
  };
}
