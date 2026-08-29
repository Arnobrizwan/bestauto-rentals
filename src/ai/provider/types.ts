/**
 * A minimal, provider-neutral chat/tool-calling contract.
 *
 * Everything above this file (agents, routes, UI) is written against these
 * types only, so switching model vendor is a one-file change and running with
 * no vendor at all is a supported mode rather than a broken one.
 */

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string; isError?: boolean };

export type AiMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

export type ToolSpec = {
  name: string;
  description: string;
  /** JSON Schema (draft 2020-12) object describing the tool input. */
  inputSchema: Record<string, unknown>;
};

export type CompletionRequest = {
  system: string;
  messages: AiMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  temperature?: number;
  /** Ask the model to answer with a single JSON object. */
  json?: boolean;
};

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

/** A fragment of assistant text as the model produces it. */
export type StreamEvent = { type: "text"; delta: string };

export type CompletionResult = {
  text: string;
  toolCalls: ToolCall[];
  stopReason: "end" | "tool_use" | "max_tokens" | "error";
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
};

export interface LlmProvider {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  /**
   * One assistant turn, delivered as it is produced.
   *
   * Yields text deltas and finishes with the completed turn, so a caller can
   * show words as they arrive and still learn whether the model asked for a
   * tool. Optional: a provider without it is simply not streamed.
   */
  stream?(req: CompletionRequest): AsyncGenerator<StreamEvent, CompletionResult, void>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
