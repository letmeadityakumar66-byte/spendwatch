import { createReadStream, existsSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Turn } from "../types.js";

export const CLAUDE_DIR = join(homedir(), ".claude", "projects");

/**
 * Claude Code writes one JSONL transcript per session under
 * ~/.claude/projects/<slug>/<session>.jsonl. Billable turns are assistant
 * messages carrying `message.usage`.
 *
 * Resuming or forking a session replays earlier messages into a new file, so
 * turns are de-duplicated on requestId (falling back to the message uuid).
 * Without that, a heavily-resumed session double-counts.
 */
export async function parseClaudeCode(seen: Set<string>): Promise<Turn[]> {
  if (!existsSync(CLAUDE_DIR)) return [];
  const turns: Turn[] = [];

  for (const entry of readdirSync(CLAUDE_DIR, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const file = join(entry.parentPath ?? CLAUDE_DIR, entry.name);

    const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line || line.charCodeAt(0) !== 123 /* '{' */) continue;
      let d: any;
      try { d = JSON.parse(line); } catch { continue; }

      const usage = d?.message?.usage;
      if (!usage || typeof usage !== "object") continue;

      const model: string = d.message?.model ?? "";
      if (!model || model === "<synthetic>") continue;

      const key = d.requestId ?? d.uuid;
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }

      turns.push({
        vendor: "claude-code",
        model,
        sessionId: d.sessionId ?? entry.name.replace(/\.jsonl$/, ""),
        repo: d.cwd ?? null,
        branch: d.gitBranch || null,
        ts: d.timestamp ? Date.parse(d.timestamp) || null : null,
        inputTokens: num(usage.input_tokens),
        cacheWriteTokens: num(usage.cache_creation_input_tokens),
        cacheReadTokens: num(usage.cache_read_input_tokens),
        outputTokens: num(usage.output_tokens),
        thinkingTokens: num(usage.output_tokens_details?.thinking_tokens),
      });
    }
  }
  return turns;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
