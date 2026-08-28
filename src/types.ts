/** One billable turn from any agent, normalised across vendors. */
export interface Turn {
  vendor: Vendor;
  model: string;
  sessionId: string;
  /** Absolute working directory the agent ran in, if the log records one. */
  repo: string | null;
  branch: string | null;
  ts: number | null;
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  thinkingTokens: number;
}

export type Vendor = "claude-code" | "codex" | "cursor";

/** A Turn priced against the rate table. `cost` is null when the rate is unknown. */
export interface PricedTurn extends Turn {
  cost: number | null;
}

/** Commit-level authorship, from Cursor. Not a cost signal — an output signal. */
export interface ShippedCommit {
  commitHash: string;
  branch: string;
  aiLinesAdded: number;
  humanLinesAdded: number;
  totalLinesAdded: number;
  commitDate: number | null;
}

export interface ScanResult {
  turns: PricedTurn[];
  commits: ShippedCommit[];
  /** Vendors whose log directory was absent — reported so silence is never mistaken for zero. */
  missing: Vendor[];
  warnings: string[];
}
