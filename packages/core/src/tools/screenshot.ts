/**
 * Screenshot Capture Tool
 *
 * Captures screenshots of the current viewport or specific elements.
 * Uses html2canvas for reliable DOM-to-canvas conversion.
 */

import type { ScreenshotOptions, ScreenshotResult } from "./types";

// Check if we're in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

/**
 * Default screenshot options
 */
const DEFAULT_OPTIONS: Required<ScreenshotOptions> = {
  element: isBrowser ? document.body : (null as unknown as HTMLElement),
  quality: 0.8,
  format: "png",
  maxWidth: 1920,
  maxHeight: 1080,
  includeCursor: false,
};

// Lazy-loaded html2canvas instance
let html2canvasPromise: Promise<typeof import("html2canvas").default> | null =
  null;

/**
 * Dynamically import html2canvas (only when needed)
 */
async function getHtml2Canvas(): Promise<typeof import("html2canvas").default> {
  if (!html2canvasPromise) {
    html2canvasPromise = import("html2canvas").then((mod) => mod.default);
  }
  return html2canvasPromise;
}

/**
 * Capture a screenshot of an element or the viewport
 *
 * Uses html2canvas for reliable DOM-to-canvas conversion.
 * Handles complex CSS, images, flexbox, grid, etc.
 *
 * @param options - Screenshot options
 * @returns Promise resolving to screenshot result
 *
 * @example
 * ```typescript
 * // Capture viewport
 * const screenshot = await captureScreenshot();
 *
 * // Capture specific element
 * const screenshot = await captureScreenshot({
 *   element: document.getElementById('my-element'),
 *   format: 'jpeg',
 *   quality: 0.9,
 * });
 * ```
 */
export async function captureScreenshot(
  options: ScreenshotOptions = {},
): Promise<ScreenshotResult> {
  if (!isBrowser) {
    throw new Error(
      "Screenshot capture is only available in browser environment",
    );
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const element = opts.element || document.body;

  // Get element dimensions
  const rect = element.getBoundingClientRect();
  let width = rect.width || window.innerWidth;
  let height = rect.height || window.innerHeight;

  // Scale down if needed
  const scale = Math.min(opts.maxWidth / width, opts.maxHeight / height, 1);
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  let canvas: HTMLCanvasElement;

  try {
    // Load html2canvas dynamically
    const html2canvas = await getHtml2Canvas();

    // Capture using html2canvas
    canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true, // Enable cross-origin images
      allowTaint: false, // Don't allow tainted canvas
      backgroundColor: null, // Transparent background (uses element's bg)
      logging: false, // Disable internal logging
      width: rect.width,
      height: rect.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scrollX: 0,
      scrollY: 0,
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
    });
  } catch (error) {
    // Fallback to placeholder if html2canvas fails
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      createPlaceholder(ctx, width, height, element, String(error));
    }
  }

  // Convert to data URL
  const mimeType = `image/${opts.format === "jpeg" ? "jpeg" : opts.format}`;
  let data: string;

  try {
    data = canvas.toDataURL(mimeType, opts.quality);
  } catch (e) {
    // Handle tainted canvas (cross-origin images)
    if (e instanceof DOMException && e.name === "SecurityError") {
      console.warn(
        "[Copilot SDK] Canvas tainted by cross-origin content. Creating placeholder.",
      );
      const cleanCanvas = document.createElement("canvas");
      cleanCanvas.width = width;
      cleanCanvas.height = height;
      const cleanCtx = cleanCanvas.getContext("2d");
      if (cleanCtx) {
        createPlaceholder(
          cleanCtx,
          width,
          height,
          element,
          "Cross-origin content blocked",
        );
        data = cleanCanvas.toDataURL(mimeType, opts.quality);
      } else {
        throw new Error("Failed to create placeholder canvas");
      }
    } else {
      throw e;
    }
  }

  return {
    data,
    format: opts.format,
    width: canvas.width,
    height: canvas.height,
    timestamp: Date.now(),
  };
}

/**
 * Create a placeholder image when capture fails
 */
function createPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  element: HTMLElement,
  errorMessage?: string,
): void {
  // Gray background
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  // Text
  ctx.fillStyle = "#666";
  ctx.font = "14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const className = element.className
    ? `.${String(element.className).split(" ")[0]}`
    : "";

  ctx.fillText(
    `Screenshot: <${tagName}${id}${className}>`,
    width / 2,
    height / 2 - 20,
  );
  ctx.fillText(
    `${Math.round(width)}×${Math.round(height)}px`,
    width / 2,
    height / 2,
  );

  if (errorMessage) {
    ctx.fillStyle = "#999";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(
      `Error: ${errorMessage.slice(0, 50)}`,
      width / 2,
      height / 2 + 20,
    );
  }
}

/**
 * Check if screenshot capture is supported
 */
export function isScreenshotSupported(): boolean {
  return isBrowser && typeof document.createElement === "function";
}

/**
 * Resize a screenshot result
 */
export async function resizeScreenshot(
  screenshot: ScreenshotResult,
  maxWidth: number,
  maxHeight: number,
): Promise<ScreenshotResult> {
  if (!isBrowser) {
    throw new Error("Resize is only available in browser environment");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to create canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const data = canvas.toDataURL(`image/${screenshot.format}`, 0.8);

      resolve({
        ...screenshot,
        data,
        width,
        height,
        timestamp: Date.now(),
      });
    };
    img.onerror = () => reject(new Error("Failed to load screenshot"));
    img.src = screenshot.data;
  });
}
