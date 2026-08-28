import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Turn } from "../types.js";

export const COPILOT_DB = join(homedir(), ".copilot", "data.db");

/**
 * GitHub Copilot CLI keeps per-session token totals in ~/.copilot/data.db
 * (sessions: total_input_tokens / total_output_tokens / total_cached_tokens /
 * total_reasoning_tokens, plus the model id). Totals are per session, not per
 * turn, so each session becomes one Turn.
 *
 * Assumption, stated openly: total_input_tokens is treated as INCLUSIVE of
 * total_cached_tokens (the OpenAI-style convention), so uncached input is
 * input − cached. If Copilot's accounting differs, input is slightly
 * under-counted — a redacted sample row in an issue settles it.
 */
export async function parseCopilot(warnings: string[]): Promise<Turn[]> {
  if (!existsSync(COPILOT_DB)) return [];

  let DatabaseSync: any;
  try {
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch {
    warnings.push("Copilot data skipped: node:sqlite unavailable (needs Node >= 22.5).");
    return [];
  }

  let db: any;
  try {
    db = new DatabaseSync(COPILOT_DB, { readOnly: true });
  } catch (e) {
    warnings.push(`Copilot DB could not be opened read-only: ${(e as Error).message}`);
    return [];
  }

  try {
    const rows = db.prepare(`
      SELECT id, model, created_at,
             COALESCE(total_input_tokens, 0)     AS input,
             COALESCE(total_cached_tokens, 0)    AS cached,
             COALESCE(total_output_tokens, 0)    AS output,
             COALESCE(total_reasoning_tokens, 0) AS reasoning
      FROM sessions
      WHERE COALESCE(total_input_tokens, 0) + COALESCE(total_output_tokens, 0) > 0
    `).all() as any[];

    return rows.map((r): Turn => ({
      vendor: "copilot",
      model: String(r.model ?? "unknown"),
      sessionId: String(r.id),
      repo: null,       // sessions are not tied to a path in this schema
      branch: null,
      ts: r.created_at ? Date.parse(String(r.created_at)) || null : null,
      inputTokens: Math.max(0, Number(r.input) - Number(r.cached)),
      cacheWriteTokens: 0,
      cacheReadTokens: Number(r.cached),
      outputTokens: Number(r.output),
      thinkingTokens: Number(r.reasoning),
    }));
  } catch (e) {
    warnings.push(`Copilot schema not recognised (${(e as Error).message}). Skipped.`);
    return [];
  } finally {
    try { db.close(); } catch { /* already closed */ }
  }
}
