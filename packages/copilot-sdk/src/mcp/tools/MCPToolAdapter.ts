/**
 * MCP Tool Adapter
 *
 * Converts MCP tool definitions to the SDK's ToolDefinition format.
 */

import type {
  MCPToolDefinition,
  MCPToolCallResult,
  MCPToolInputSchema,
  MCPJsonSchemaProperty,
  MCPTextContent,
  MCPImageContent,
  MCPUIContent,
} from "../types";
import type { MCPUIResource } from "../ui/types";
import type {
  ToolDefinition,
  ToolInputSchema,
  JSONSchemaProperty,
  ToolResponse,
  ToolContext,
  AIContent,
} from "../../core/types/tools";

/**
 * Options for converting MCP tools to ToolDefinitions
 */
export interface MCPToolAdapterOptions {
  /** Prefix tool names with client name */
  prefix?: boolean;
  /** Register as server-side tool (default: true for MCP tools) */
  asServerTool?: boolean;
  /** Function to call the MCP tool */
  callTool: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<MCPToolCallResult>;
}

/**
 * MCP Tool Adapter
 *
 * Handles conversion between MCP tool format and SDK ToolDefinition format.
 */
export class MCPToolAdapter {
  private clientName: string;

  constructor(clientName: string) {
    this.clientName = clientName;
  }

  /**
   * Convert an MCP tool to a ToolDefinition
   */
  toToolDefinition(
    mcpTool: MCPToolDefinition,
    options: MCPToolAdapterOptions,
  ): ToolDefinition {
    const { prefix = true, asServerTool = true, callTool } = options;

    const toolName = prefix
      ? `${this.clientName}_${mcpTool.name}`
      : mcpTool.name;

    // Store original name for calling
    const originalName = mcpTool.name;

    return {
      name: toolName,
      description: mcpTool.description ?? `MCP tool: ${mcpTool.name}`,
      location: asServerTool ? "server" : "client",
      inputSchema: this.convertInputSchema(mcpTool.inputSchema),
      handler: async (
        params: Record<string, unknown>,
        context?: ToolContext,
      ): Promise<ToolResponse> => {
        try {
          // Check for cancellation
          if (context?.signal?.aborted) {
            return {
              success: false,
              error: "Tool execution cancelled",
            };
          }

          // Call the MCP tool
          const result = await callTool(originalName, params);

          // Convert MCP result to ToolResponse
          return this.convertResult(result);
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Unknown error calling MCP tool",
          };
        }
      },
      // MCP tools display their name as title
      title: this.formatToolTitle(mcpTool.name),
      executingTitle: `Calling ${this.formatToolTitle(mcpTool.name)}...`,
      completedTitle: `${this.formatToolTitle(mcpTool.name)} completed`,
    };
  }

  /**
   * Convert multiple MCP tools to ToolDefinitions
   */
  toToolDefinitions(
    mcpTools: MCPToolDefinition[],
    options: MCPToolAdapterOptions,
  ): ToolDefinition[] {
    return mcpTools.map((tool) => this.toToolDefinition(tool, options));
  }

  /**
   * Convert MCP input schema to SDK ToolInputSchema
   */
  private convertInputSchema(mcpSchema: MCPToolInputSchema): ToolInputSchema {
    return {
      type: "object",
      properties: mcpSchema.properties
        ? this.convertProperties(mcpSchema.properties)
        : {},
      required: mcpSchema.required,
      additionalProperties: mcpSchema.additionalProperties,
    };
  }

  /**
   * Convert MCP schema properties to SDK JSONSchemaProperty format
   */
  private convertProperties(
    properties: Record<string, MCPJsonSchemaProperty>,
  ): Record<string, JSONSchemaProperty> {
    const converted: Record<string, JSONSchemaProperty> = {};

    for (const [key, prop] of Object.entries(properties)) {
      converted[key] = this.convertProperty(prop);
    }

    return converted;
  }

  /**
   * Convert a single MCP property to SDK format
   */
  private convertProperty(prop: MCPJsonSchemaProperty): JSONSchemaProperty {
    // Handle type which could be string or array
    let type: JSONSchemaProperty["type"] = "string";
    if (prop.type) {
      if (Array.isArray(prop.type)) {
        // Take the first non-null type
        const nonNull = prop.type.find((t) => t !== "null");
        type = (nonNull as JSONSchemaProperty["type"]) || "string";
      } else {
        type = prop.type as JSONSchemaProperty["type"];
      }
    }

    const converted: JSONSchemaProperty = {
      type,
      description: prop.description,
    };

    // Copy over optional properties
    if (prop.enum) {
      converted.enum = prop.enum as (string | number | boolean)[];
    }
    if (prop.default !== undefined) {
      converted.default = prop.default;
    }
    if (prop.minLength !== undefined) {
      converted.minLength = prop.minLength;
    }
    if (prop.maxLength !== undefined) {
      converted.maxLength = prop.maxLength;
    }
    if (prop.minimum !== undefined) {
      converted.minimum = prop.minimum;
    }
    if (prop.maximum !== undefined) {
      converted.maximum = prop.maximum;
    }
    if (prop.pattern !== undefined) {
      converted.pattern = prop.pattern;
    }

    // Handle nested objects
    if (prop.properties) {
      converted.properties = this.convertProperties(prop.properties);
    }
    if (prop.required) {
      converted.required = prop.required;
    }

    // Handle arrays
    if (prop.items) {
      converted.items = this.convertProperty(prop.items);
    }

    return converted;
  }

  /**
   * Convert MCP tool result to SDK ToolResponse
   */
  private convertResult(result: MCPToolCallResult): ToolResponse {
    const response: ToolResponse = {
      success: !result.isError,
    };

    // Process content array
    const textParts: string[] = [];
    const aiContent: AIContent[] = [];
    const uiResources: MCPUIResource[] = [];

    for (const content of result.content) {
      switch (content.type) {
        case "text":
          textParts.push((content as MCPTextContent).text);
          break;

        case "image": {
          const img = content as MCPImageContent;
          aiContent.push({
            type: "image",
            data: img.data,
            mediaType: img.mimeType,
          });
          break;
        }

        case "resource":
          // Handle embedded resource content
          if ("text" in content.resource && content.resource.text) {
            textParts.push(content.resource.text);
          }
          break;

        case "ui": {
          // Handle MCP-UI content
          const uiContent = content as MCPUIContent;
          uiResources.push({
            uri: uiContent.resource.uri,
            mimeType: uiContent.resource.mimeType,
            content: uiContent.resource.content,
            blob: uiContent.resource.blob,
            metadata: uiContent.resource.metadata,
          });
          break;
        }
      }
    }

    // Set message from text content
    if (textParts.length > 0) {
      response.message = textParts.join("\n");

      // Try to parse as JSON for structured data
      if (textParts.length === 1) {
        try {
          response.data = JSON.parse(textParts[0]);
        } catch {
          // Keep as text if not valid JSON
          response.data = textParts[0];
        }
      } else {
        response.data = textParts;
      }
    }

    // Add AI content for multimodal responses
    if (aiContent.length > 0) {
      response._aiContent = aiContent;
    }

    // Add UI resources for rendering
    if (uiResources.length > 0) {
      response._uiResources = uiResources;
    }

    // Set error if this was an error result
    if (result.isError) {
      response.error = textParts.join("\n") || "Tool execution failed";
    }

    return response;
  }

  /**
   * Format tool name as a readable title
   */
  private formatToolTitle(name: string): string {
    // Convert snake_case or kebab-case to Title Case
    return name
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

/**
 * Convert an MCP tool to a ToolDefinition (standalone function)
 */
export function mcpToolToDefinition(
  clientName: string,
  mcpTool: MCPToolDefinition,
  options: MCPToolAdapterOptions,
): ToolDefinition {
  const adapter = new MCPToolAdapter(clientName);
  return adapter.toToolDefinition(mcpTool, options);
}

/**
 * Convert multiple MCP tools to ToolDefinitions (standalone function)
 */
export function mcpToolsToDefinitions(
  clientName: string,
  mcpTools: MCPToolDefinition[],
  options: MCPToolAdapterOptions,
): ToolDefinition[] {
  const adapter = new MCPToolAdapter(clientName);
  return adapter.toToolDefinitions(mcpTools, options);
}
