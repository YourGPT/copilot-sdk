/**
 * Built-in Network Requests Tool
 *
 * A pre-configured tool that retrieves browser network requests.
 * Can be used with useTools() hook in React.
 */

import { tool, success, failure } from "../../types/tools";
import {
  getNetworkRequests,
  formatRequestsForAI,
  isNetworkCaptureActive,
  startNetworkCapture,
} from "../network";

// Auto-start network capture when this module is imported
// This ensures requests are captured from the beginning of the app lifecycle
const isBrowser = typeof window !== "undefined" && typeof fetch !== "undefined";

if (isBrowser && !isNetworkCaptureActive()) {
  startNetworkCapture();
}

/**
 * Network requests tool - retrieves browser network activity
 *
 * @example
 * ```tsx
 * import { networkRequestsTool } from '@yourgpt/copilot-sdk-core';
 *
 * // In your component
 * useTools({
 *   get_network_requests: networkRequestsTool,
 * });
 * ```
 */
export const networkRequestsTool = tool<{
  limit?: number;
  failedOnly?: boolean;
}>({
  description:
    "Get recent network requests from the browser. Use this when debugging API calls, checking for failed requests, analyzing network activity, or troubleshooting connectivity issues.",
  location: "client",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of requests to return (default: 20)",
      },
      failedOnly: {
        type: "boolean",
        description: "Only return failed requests (status >= 400)",
      },
    },
    required: [],
  },
  needsApproval: true,
  approvalMessage: "Allow AI to access network request history?",
  handler: async (params) => {
    try {
      // Start capture if not already active
      if (!isNetworkCaptureActive()) {
        startNetworkCapture();
      }

      const requests = getNetworkRequests({
        limit: params.limit || 20,
        failedOnly: params.failedOnly,
      });

      const formattedRequests = formatRequestsForAI(requests.requests);

      return success(
        {
          requests: formattedRequests,
          count: requests.requests.length,
          totalCaptured: requests.totalCaptured,
        },
        `Retrieved ${requests.requests.length} network requests`,
      );
    } catch (error) {
      return failure(
        error instanceof Error
          ? error.message
          : "Failed to get network requests",
      );
    }
  },
});

/**
 * Create a custom network requests tool with different options
 */
export function createNetworkRequestsTool(options?: {
  needsApproval?: boolean;
  approvalMessage?: string;
  defaultLimit?: number;
}) {
  return tool<{ limit?: number; failedOnly?: boolean }>({
    ...networkRequestsTool,
    needsApproval: options?.needsApproval ?? true,
    approvalMessage:
      options?.approvalMessage ?? "Allow AI to access network request history?",
    handler: async (params) => {
      try {
        if (!isNetworkCaptureActive()) {
          startNetworkCapture();
        }

        const requests = getNetworkRequests({
          limit: params.limit || options?.defaultLimit || 20,
          failedOnly: params.failedOnly,
        });

        const formattedRequests = formatRequestsForAI(requests.requests);

        return success(
          {
            requests: formattedRequests,
            count: requests.requests.length,
            totalCaptured: requests.totalCaptured,
          },
          `Retrieved ${requests.requests.length} network requests`,
        );
      } catch (error) {
        return failure(
          error instanceof Error
            ? error.message
            : "Failed to get network requests",
        );
      }
    },
  });
}
