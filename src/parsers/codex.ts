import { createReadStream, existsSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Turn } from "../types.js";

export const CODEX_DIRS = [
  join(homedir(), ".codex", "sessions"),
  join(homedir(), ".codex", "archived_sessions"),
];

/**
 * Codex writes rollout JSONL files. Two accounting details drive this parser:
 *
 * 1. `info.total_token_usage` is CUMULATIVE across the session — summing it
 *    overcounts enormously. `info.last_token_usage` is the per-turn delta.
 * 2. OpenAI reports `input_tokens` INCLUSIVE of `cached_input_tokens`, and
 *    `output_tokens` INCLUSIVE of `reasoning_output_tokens`. Uncached input is
 *    therefore input - cached, and reasoning is recorded but never re-added.
 */
export async function parseCodex(): Promise<Turn[]> {
  const turns: Turn[] = [];

  for (const dir of CODEX_DIRS) {
    if (!existsSync(dir)) continue;

    for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      const file = join(entry.parentPath ?? dir, entry.name);

      let model = "";
      let cwd: string | null = null;
      let sessionId = entry.name.replace(/^rollout-.*?-/, "").replace(/\.jsonl$/, "");

      const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line || line.charCodeAt(0) !== 123) continue;
        let d: any;
        try { d = JSON.parse(line); } catch { continue; }
        const p = d?.payload;
        if (!p || typeof p !== "object") continue;

        if (d.type === "session_meta") {
          cwd = p.cwd ?? cwd;
          sessionId = p.id ?? sessionId;
          continue;
        }
        if (d.type === "turn_context") {
          // Model can change mid-session; keep the most recent declaration.
          model = p.model || model;
          cwd = p.cwd ?? cwd;
          continue;
        }
        if (p.type !== "token_count") continue;

        const u = p.info?.last_token_usage;
        if (!u || typeof u !== "object") continue;

        const rawInput = num(u.input_tokens);
        const cached = num(u.cached_input_tokens);
        const uncached = Math.max(0, rawInput - cached);
        const output = num(u.output_tokens);
        if (uncached + cached + output === 0) continue;

        turns.push({
          vendor: "codex",
          model: model || "unknown",
          sessionId,
          repo: cwd,
          branch: null,
          ts: d.timestamp ? Date.parse(d.timestamp) || null : null,
          inputTokens: uncached,
          cacheWriteTokens: 0,       // Codex does not bill a separate cache-write.
          cacheReadTokens: cached,
          outputTokens: output,      // already inclusive of reasoning tokens
          thinkingTokens: num(u.reasoning_output_tokens),
        });
      }
    }
  }
  return turns;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
