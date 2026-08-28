/**
 * Published list prices, USD per 1M tokens.
 *
 * Rule of this file: never invent a rate. A model with no confirmed public price
 * gets no entry, its tokens are still counted, and its cost is reported as
 * unpriced. A cost tool that guesses is worse than no cost tool.
 *
 * Sources are recorded so this table can be audited and updated by PR.
 */
export interface Rate {
  input: number;
  output: number;
  /** Multiplier on `input` for cache-write tokens. */
  cacheWriteMult: number;
  /** Multiplier on `input` for cache-read tokens, unless cachedInput is set. */
  cacheReadMult: number;
  /** Explicit cached-input rate, where the vendor publishes one instead of a multiplier. */
  cachedInput?: number;
  source: string;
  asOf: string;
}

const ANTHROPIC = { cacheWriteMult: 1.25, cacheReadMult: 0.1, source: "anthropic-list-price", asOf: "2026-06-24" };

export const RATES: Record<string, Rate> = {
  // Anthropic — cache write ~1.25x input, cache read ~0.10x input.
  "claude-fable-5":    { input: 10, output: 50, ...ANTHROPIC },
  "claude-mythos-5":   { input: 10, output: 50, ...ANTHROPIC },
  "claude-opus-5":     { input: 5,  output: 25, ...ANTHROPIC },
  "claude-opus-4-8":   { input: 5,  output: 25, ...ANTHROPIC },
  "claude-opus-4-7":   { input: 5,  output: 25, ...ANTHROPIC },
  "claude-opus-4-6":   { input: 5,  output: 25, ...ANTHROPIC },
  "claude-sonnet-5":   { input: 2,  output: 10, ...ANTHROPIC },
  "claude-sonnet-4-6": { input: 3,  output: 15, ...ANTHROPIC },
  "claude-haiku-4-5":  { input: 1,  output: 5,  ...ANTHROPIC },

  // OpenAI — reflects the 2026-08-22 reduction. Cached input is an explicit rate.
  "gpt-5.6-sol":   { input: 4,    output: 20,  cacheWriteMult: 1, cacheReadMult: 0.1, cachedInput: 0.4,  source: "openai-list-price", asOf: "2026-08-22" },
  "gpt-5.6-terra": { input: 2,    output: 12,  cacheWriteMult: 1, cacheReadMult: 0.1, cachedInput: 0.2,  source: "openai-list-price", asOf: "2026-07-30" },
  "gpt-5.6-luna":  { input: 0.2,  output: 1.2, cacheWriteMult: 1, cacheReadMult: 0.1, cachedInput: 0.02, source: "openai-list-price", asOf: "2026-07-30" },
  "gpt-5":         { input: 1.25, output: 10,  cacheWriteMult: 1, cacheReadMult: 0.1, cachedInput: 0.125, source: "openai-list-price", asOf: "2026-07-30" },
};

/**
 * Resolve a logged model id to a rate.
 *
 * Matching is deliberately strict. A prefix match alone is wrong: "gpt-5" is a
 * prefix of "gpt-5.3-codex", but they are different models with different
 * prices. The remainder after a matched base id must therefore be either empty
 * or a date snapshot (`-20251001`, `@20251101`) — which denotes the same model.
 * Anything else is treated as unknown, and the caller reports it as unpriced.
 */
const DATE_SNAPSHOT = /^[-@]20\d{6}$/;

export function rateFor(model: string): Rate | null {
  if (!model) return null;
  const id = model.toLowerCase();
  let best: string | null = null;
  for (const key of Object.keys(RATES)) {
    if (!id.startsWith(key)) continue;
    const rest = id.slice(key.length);
    if (rest !== "" && !DATE_SNAPSHOT.test(rest)) continue;
    if (best === null || key.length > best.length) best = key;
  }
  return best ? RATES[best] : null;
}

/** Cost in USD for one turn, or null if the model has no confirmed rate. */
export function priceTurn(t: {
  model: string; inputTokens: number; cacheWriteTokens: number;
  cacheReadTokens: number; outputTokens: number;
}): number | null {
  const r = rateFor(t.model);
  if (!r) return null;
  const readRate = r.cachedInput ?? r.input * r.cacheReadMult;
  return (
    t.inputTokens * r.input +
    t.cacheWriteTokens * r.input * r.cacheWriteMult +
    t.cacheReadTokens * readRate +
    t.outputTokens * r.output
  ) / 1_000_000;
}
