import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ShippedCommit } from "../types.js";

export const CURSOR_DB = join(homedir(), ".cursor", "ai-tracking", "ai-code-tracking.db");

/**
 * Cursor's local tracking DB records no token counts, so it contributes no cost.
 * What it does record is authorship per commit — how many added lines came from
 * the agent versus a human. That is the output side of the ledger: cost data
 * from Claude/Codex answers "what did we spend", this answers "what shipped".
 *
 * Opened read-only; the user's database is never written to.
 */
export async function parseCursor(warnings: string[]): Promise<ShippedCommit[]> {
  if (!existsSync(CURSOR_DB)) return [];

  let DatabaseSync: any;
  try {
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch {
    warnings.push("Cursor data skipped: node:sqlite unavailable (needs Node >= 22.5).");
    return [];
  }

  let db: any;
  try {
    db = new DatabaseSync(CURSOR_DB, { readOnly: true });
  } catch (e) {
    warnings.push(`Cursor DB could not be opened read-only: ${(e as Error).message}`);
    return [];
  }

  try {
    const rows = db.prepare(`
      SELECT commitHash, branchName, commitDate,
             COALESCE(composerLinesAdded,0) AS composer,
             COALESCE(tabLinesAdded,0)      AS tab,
             COALESCE(humanLinesAdded,0)    AS human,
             COALESCE(linesAdded,0)         AS total
      FROM scored_commits
    `).all() as any[];

    return rows.map((r) => ({
      commitHash: String(r.commitHash ?? ""),
      branch: String(r.branchName ?? ""),
      aiLinesAdded: Number(r.composer) + Number(r.tab),
      humanLinesAdded: Number(r.human),
      totalLinesAdded: Number(r.total),
      commitDate: r.commitDate ? Number(r.commitDate) : null,
    }));
  } catch (e) {
    warnings.push(`Cursor schema not recognised (${(e as Error).message}). Skipped.`);
    return [];
  } finally {
    try { db.close(); } catch { /* already closed */ }
  }
}
