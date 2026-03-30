# Tool Result Formatting Requirements

Rules to follow when returning tool results to avoid continuation errors — covering both Claude and OpenAI.

---

## Claude

### Requirements

1. **Immediate follow** — `tool_result` must appear in the very next message after the assistant's `tool_use`. No messages in between.
2. **Correct role** — The message containing `tool_result` must have `role: "user"`.
3. **tool_result first** — In the content array, all `tool_result` blocks must come **before** any `text` blocks.
4. **Matching ID** — `tool_use_id` must exactly match the `id` from the corresponding `tool_use` block.
5. **One result per call** — Every `tool_use` block must have exactly one corresponding `tool_result`.
6. **Valid content types** — `tool_result` content supports `text`, `image`, and `document` types only.
7. **Error flag** — If execution fails, set `is_error: true` instead of omitting the result.
8. **No skipping** — Every `tool_use` must be returned, even for trivial tools.
9. **Parallel results together** — All results for parallel tool calls go in a **single** user message, not separate ones.
10. **No nesting** — `tool_result` blocks cannot be nested inside other content blocks.

### Examples

**❌ Wrong — text before tool_result**

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "Here are the results:" },
    { "type": "tool_result", "tool_use_id": "toolu_01", "content": "..." }
  ]
}
```

**✅ Correct**

```json
{
  "role": "user",
  "content": [
    { "type": "tool_result", "tool_use_id": "toolu_01", "content": "..." },
    { "type": "text", "text": "What should I do next?" }
  ]
}
```

**✅ Parallel results — one message**

```json
{
  "role": "user",
  "content": [
    { "type": "tool_result", "tool_use_id": "toolu_01", "content": "15°C" },
    { "type": "tool_result", "tool_use_id": "toolu_02", "content": "10:30 AM" }
  ]
}
```

**✅ Error result**

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01",
      "content": "Timeout",
      "is_error": true
    }
  ]
}
```

### Common Errors

| Error                                                             | Fix                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `tool_use ids found without tool_result blocks immediately after` | Next message must be a user message with all matching tool_result blocks |
| `400: text block before tool_result`                              | Reorder content array — tool_result blocks always first                  |
| Mismatched `tool_use_id`                                          | Copy the exact `id` string from the tool_use block                       |
| Parallel results split across messages                            | Combine all results into one user message                                |

---

## OpenAI

OpenAI calls this **function calling**. Functions are defined under a `tools` array param but the concept and naming is functions throughout. OpenAI has two APIs with slightly different mechanics.

### Chat Completions API

#### Requirements

1. **Dedicated role** — Each function output is its own message with `role: "tool"` (OpenAI's term for the function result role). No mixing with user content.
2. **Matching ID** — `tool_call_id` must match the `id` from the assistant's `tool_calls` entry.
3. **One message per result** — Unlike Claude, parallel function results are appended as **separate** `role: "tool"` messages, one per call.
4. **No ordering constraint** — Because results are isolated messages, there is no content array ordering issue.
5. **Void functions** — If the function has no return value (e.g. `send_email`), return a string like `"success"` or `"error"`.
6. **Append assistant message first** — Before appending function results, append the full assistant response (with `tool_calls`) to the message history.

#### Example

```json
// 1. Append the assistant response that contained function calls
{ "role": "assistant", "tool_calls": [...] }

// 2. Append one function result message per call
{ "role": "tool", "tool_call_id": "call_12345xyz", "content": "15°C" }
{ "role": "tool", "tool_call_id": "call_67890abc", "content": "10:30 AM" }
```

---

### Responses API (newer)

#### Requirements

1. **Type field** — Function outputs use `type: "function_call_output"`.
2. **Matching ID** — `call_id` must match the `call_id` from the `function_call` item in the model's output.
3. **Append model output first** — Add the full `response.output` array to your input list before appending function outputs.
4. **One item per result** — One `function_call_output` item per function call.
5. **Reasoning items** — For reasoning models (GPT-5, o4-mini), any reasoning items in the response output **must also be included** when sending back results.

#### Example

```json
// 1. Append the model's output (including function_call items)
{ "type": "function_call", "call_id": "call_12345xyz", "name": "get_weather", "arguments": "..." }

// 2. Append function output
{ "type": "function_call_output", "call_id": "call_12345xyz", "output": "15°C" }
```

---

## Side-by-Side Comparison

|                              | Claude                      | OpenAI Chat Completions        | OpenAI Responses API                |
| ---------------------------- | --------------------------- | ------------------------------ | ----------------------------------- |
| Naming                       | Tool use                    | Function calling               | Function calling                    |
| Result container             | `role: "user"` message      | `role: "tool"` message         | `type: "function_call_output"` item |
| ID field                     | `tool_use_id`               | `tool_call_id`                 | `call_id`                           |
| Parallel results             | Single user message         | Separate messages per call     | Separate items per call             |
| Ordering constraint          | Yes — results before text   | No                             | No                                  |
| Error flag                   | `is_error: true`            | Return error string as content | Return error string as output       |
| Void functions               | Return empty string or omit | Return `"success"` string      | Return `"success"` string           |
| Must append model turn first | Yes                         | Yes                            | Yes                                 |

---

_Refs: [Claude — Implement Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) · [OpenAI — Function Calling](https://developers.openai.com/api/docs/guides/function-calling)_
