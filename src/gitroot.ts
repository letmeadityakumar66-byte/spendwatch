import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

const cache = new Map<string, string>();

/**
 * Walk up from a working directory to the nearest .git, so every subdirectory
 * of a repo rolls up into one project. Without this, a monorepo reports as a
 * dozen unrelated rows and its true share of spend stays hidden.
 */
export function gitRoot(dir: string | null): string | null {
  if (!dir) return null;
  const hit = cache.get(dir);
  if (hit !== undefined) return hit;

  const root = parse(dir).root;
  let cur = dir;
  let found = dir;
  while (true) {
    if (existsSync(join(cur, ".git"))) { found = cur; break; }
    const up = dirname(cur);
    if (up === cur || cur === root) break;
    cur = up;
  }
  cache.set(dir, found);
  return found;
}
