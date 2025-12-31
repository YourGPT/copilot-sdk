/**
 * System Prompt Utilities
 *
 * Default system message generation for Copilot SDK.
 */

/**
 * Function type for generating system messages
 */
export type SystemMessageFunction = (
  contextString: string,
  additionalInstructions?: string,
) => string;

/**
 * Default system message for Copilot SDK
 *
 * @param contextString - Context from useReadable hooks
 * @param additionalInstructions - Additional instructions from user
 */
export function defaultSystemMessage(
  contextString: string,
  additionalInstructions?: string,
): string {
  return (
    `
You are a helpful, efficient, and professional AI assistant.

Help the user achieve their goals efficiently, without unnecessary fluff, while maintaining professionalism.
Be polite, respectful, and prefer brevity over verbosity.

${
  contextString
    ? `The user has provided you with the following context:
\`\`\`
${contextString}
\`\`\`

`
    : ""
}You have access to functions you can call to take actions or get more information.

Assist the user as best you can. Ask clarifying questions if needed, but if you can reasonably fill in the blanks yourself, do so.

When calling a function, call it without extra commentary.
If a function returns an error:
- If the error is from incorrect parameters, you may retry with corrected arguments.
- If the error source is unclear, do not retry.
` + (additionalInstructions ? `\n${additionalInstructions}` : "")
  );
}
