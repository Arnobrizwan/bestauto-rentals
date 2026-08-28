import { ProviderError, type CompletionRequest, type CompletionResult, type ContentBlock, type LlmProvider } from "./types";

const API = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

function toAnthropicContent(content: string | ContentBlock[]): string | AnthropicBlock[] {
  if (typeof content === "string") return content;
  return content.map((b): AnthropicBlock => {
    if (b.type === "tool_result") {
      return { type: "tool_result", tool_use_id: b.toolUseId, content: b.content, is_error: b.isError };
    }
    return b;
  });
}

/**
 * Claude via the Messages API. Uses fetch directly rather than the SDK so the
 * route stays edge-compatible and the dependency surface stays small.
 */
export function createAnthropicProvider(apiKey: string, model: string): LlmProvider {
  return {
    id: "anthropic",
    label: "Claude",
    model,
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      const started = Date.now();

      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
        system: req.json
          ? `${req.system}\n\nRespond with a single valid JSON object and nothing else. No markdown fences.`
          : req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
      };
      if (req.tools?.length) {
        body.tools = req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        }));
      }

      const res = await fetch(API, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": VERSION,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
          `Anthropic request failed (${res.status}): ${detail.slice(0, 300)}`,
          res.status,
          res.status === 429 || res.status >= 500,
        );
      }

      const data = (await res.json()) as {
        content: AnthropicBlock[];
        stop_reason: string;
        usage: { input_tokens: number; output_tokens: number };
      };

      const text = data.content
        .filter((b): b is Extract<AnthropicBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      const toolCalls = data.content
        .filter((b): b is Extract<AnthropicBlock, { type: "tool_use" }> => b.type === "tool_use")
        .map((b) => ({ id: b.id, name: b.name, input: b.input }));

      return {
        text,
        toolCalls,
        stopReason:
          data.stop_reason === "tool_use" ? "tool_use" : data.stop_reason === "max_tokens" ? "max_tokens" : "end",
        model,
        usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens },
        latencyMs: Date.now() - started,
      };
    },
  };
}
