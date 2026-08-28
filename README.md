# spendwatch

**See what your AI coding agents actually cost.** Across Claude Code, Codex and Cursor — in one number.

```bash
npx spendwatch
```

Runs entirely on your machine. **No network requests. Ever.**

---

## Why

Your team runs Claude Code, Codex and Cursor. Each vendor shows you its own usage,
and none of them will ever show you the others'. So nobody can answer the two
questions that actually matter:

- **Which project is eating the budget?**
- **What did that spend actually ship?**

`spendwatch` reads the logs those tools already write to your disk and answers both.

## Example

```
  spendwatch  ·  127 sessions  ·  24,824 turns  ·  Feb 5, 2026 → Aug 27, 2026

  SPEND
    API-equivalent cost               $4,408.82        ₹3,87,976

  TOKENS
    input (uncached)                  3,912,772
    cache write                      99,014,103  billed 1.25× input
    cache read                    5,439,153,795  billed 0.10× input
    output                           14,462,055
    thinking                          2,811,389  subset of output

    cache reuse                           54.9×  healthy

  BY PROJECT
    ~/work/atlas-api                              $2,259.76   51.3%  ██████······
    ~/work/beacon                                $1,032.95   23.4%  ███·········
    ~/work/portal                          $867.11   19.7%  ██··········
```

One project was 51% of the bill. That is the kind of thing you cannot see until
you look.

## Install

```bash
npx spendwatch            # no install needed
npm i -g spendwatch       # or install it
```

Requires **Node >= 22.5** (for the built-in SQLite reader). **Zero runtime dependencies.**

## Usage

```bash
spendwatch                    # full report
spendwatch --days 7           # just this week
spendwatch --json             # machine-readable, for dashboards and CI
spendwatch --inr-rate 88      # set the USD→INR display rate
spendwatch --audit "Client Name"  # client-ready audit report (markdown)
spendwatch --help
```

## What it reads

| Path | Tool | What it contributes |
|---|---|---|
| `~/.claude/projects/**/*.jsonl` | Claude Code | tokens, model, project, branch |
| `~/.codex/{sessions,archived_sessions}/**` | Codex | tokens, model, project |
| `~/.cursor/ai-tracking/*.db` | Cursor | commit authorship — AI vs human lines *(read-only)* |
| `~/.copilot/data.db` | GitHub Copilot CLI | per-session token totals *(read-only)* |

Gemini CLI records no per-turn token usage locally (as of Aug 2026) — tracked in issues.

**Your prompts and code are never read for reporting, never stored, and never
transmitted.** Only token counts, model ids and directory paths are aggregated.
There is no telemetry and no network code in this package — check for yourself,
it is ~600 lines.

## Two things it refuses to do

**1. It never guesses a price.**
If a model has no confirmed public rate, its tokens are counted and its cost is
reported as `unpriced` — not estimated. `gpt-5.3-codex` is *not* `gpt-5`, even
though one is a string prefix of the other. A cost tool that quietly guesses is
worse than no cost tool. Rates live in [`src/pricing.ts`](src/pricing.ts) with a
source and a date on every entry. **PRs welcome when prices change.**

**2. It never double-counts.**
Resuming or forking a session replays earlier turns into a new transcript.
Turns are de-duplicated on request id. Skipping this inflated our own test
figure by more than 2×.

## Subscriptions vs API billing

If you are on a Max/Pro subscription, the headline is **not a bill** — it is the
list-price value of what you consumed. That is the honest framing, and it is
also the useful one: it tells you whether your subscription is paying for itself,
and it is exactly what the same workload would cost a team on API billing.

## Roadmap

- [ ] Gemini CLI and Copilot parsers
- [ ] Cost per merged PR (join branch → GitHub)
- [ ] Team rollups
- [ ] Anonymised benchmarks — how your cost-per-PR compares

## Contributing

Log formats change without warning. If a parser breaks or a rate is stale,
open an issue with a redacted sample line — that is the single most useful
contribution.

## License

MIT
