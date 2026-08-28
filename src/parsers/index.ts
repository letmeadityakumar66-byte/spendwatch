import { existsSync } from "node:fs";
import { priceTurn } from "../pricing.js";
import type { PricedTurn, ScanResult, Vendor } from "../types.js";
import { CLAUDE_DIR, parseClaudeCode } from "./claude-code.js";
import { CODEX_DIRS, parseCodex } from "./codex.js";
import { CURSOR_DB, parseCursor } from "./cursor.js";

/**
 * Read every local agent log and price it. Nothing here touches the network —
 * that is a hard guarantee of this tool, not an implementation detail.
 */
export async function scan(): Promise<ScanResult> {
  const warnings: string[] = [];
  const missing: Vendor[] = [];

  if (!existsSync(CLAUDE_DIR)) missing.push("claude-code");
  if (!CODEX_DIRS.some(existsSync)) missing.push("codex");
  if (!existsSync(CURSOR_DB)) missing.push("cursor");

  // A single dedupe set spans vendors so a replayed id can never be counted twice.
  const seen = new Set<string>();
  const [claude, codex, commits] = await Promise.all([
    parseClaudeCode(seen),
    parseCodex(),
    parseCursor(warnings),
  ]);

  const turns: PricedTurn[] = [...claude, ...codex].map((t) => ({ ...t, cost: priceTurn(t) }));
  return { turns, commits, missing, warnings };
}
