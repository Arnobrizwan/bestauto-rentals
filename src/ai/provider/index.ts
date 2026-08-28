import { createAnthropicProvider } from "./anthropic";
import { createOpenAiProvider } from "./openai";
import type { LlmProvider } from "./types";

export * from "./types";

export type EngineInfo = {
  /** Which engine actually answered. */
  engine: "claude" | "openai" | "rules";
  model: string;
  /** True when a hosted model is configured and reachable. */
  hosted: boolean;
};

let cached: LlmProvider | null | undefined;

/**
 * Resolves the configured model vendor from the environment.
 *
 * Returns `null` when no key is present — that is a first-class, supported
 * state: every agent has a deterministic rules engine that keeps the product
 * fully functional without a vendor. Add a key and the same agents upgrade in
 * place with no other change.
 */
export function resolveProvider(): LlmProvider | null {
  if (cached !== undefined) return cached;

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    cached = createAnthropicProvider(anthropicKey, process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5");
    return cached;
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    cached = createOpenAiProvider(
      openAiKey,
      process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
      process.env.OPENAI_BASE_URL?.trim() || undefined,
    );
    return cached;
  }

  cached = null;
  return cached;
}

/** Test seam — lets the eval harness force a specific engine. */
export function __setProviderForTests(p: LlmProvider | null) {
  cached = p;
}

export function describeEngine(provider: LlmProvider | null): EngineInfo {
  if (!provider) return { engine: "rules", model: "bestauto-rules-v1", hosted: false };
  return {
    engine: provider.id === "anthropic" ? "claude" : "openai",
    model: provider.model,
    hosted: true,
  };
}
