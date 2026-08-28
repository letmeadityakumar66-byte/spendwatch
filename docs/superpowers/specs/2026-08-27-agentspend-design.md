# spendwatch — design

**Date:** 2026-08-27
**Status:** v0.1 CLI built and verified against real data

## Problem

Teams run several AI coding agents at once. Each vendor reports only its own
usage and none will ever report a competitor's. Small teams (3–20 devs) burn
$300–600 per engineer per month with no per-project attribution, and existing
tools (Torii, Portkey, Mavvrik) target 50–100 person orgs.

## Wedge

Cross-vendor aggregation of **local** agent logs. Structurally unbuildable by any
single vendor — Anthropic will never surface Cursor spend. That is the moat.

## Money model

- ₹1 lakh/month ≈ $1,200 MRR.
- Selling in USD needs ~12 customers at $99/mo; selling to Indian SMBs at
  ₹999/mo needs ~100. The currency asymmetry is the core financial lever.
- Free CLI (open source, MIT) → paid hosted team dashboard at $99/mo flat
  up to 10 devs. Flat, not per-seat: per-seat pricing on a cost-control tool
  is self-defeating.
- Payments via Dodo Payments (Merchant of Record, no foreign entity required,
  settles to an Indian bank as export revenue).

## Cash engine

"AI Coding Spend Audit" — $500 fixed, 3-day delivery, performed with this CLI.
It is the product done by hand. Two audits = ₹1 lakh. It is also the
**validation gate**: if nobody pays $500 for the report, do not build the SaaS.

## Architecture

```
src/
  index.ts          CLI: arg parsing, JSON mode, scoped warning suppression
  pricing.ts        dated, source-attributed rate table + strict resolver
  aggregate.ts      rollups by model / project / agent
  gitroot.ts        walk up to .git so subdirs roll into one project
  report.ts         terminal rendering (ANSI, NO_COLOR aware)
  parsers/
    claude-code.ts  JSONL transcripts, dedupe on requestId
    codex.ts        rollout JSONL, per-turn deltas
    cursor.ts       SQLite, read-only, commit authorship
```

Zero runtime dependencies. Node >= 22.5 for built-in `node:sqlite`.
Streaming line reads — never loads a transcript into memory.

## Non-negotiable invariants

1. **No network.** Not "off by default" — absent from the package.
2. **Never guess a price.** Unknown model → counted, unpriced, listed.
   Prefix matching must reject `gpt-5` → `gpt-5.3-codex`; only exact ids or
   date snapshots (`-20251001`, `@20251101`) resolve.
3. **Never double-count.** Dedupe on request id across all transcripts.
4. **Never write to user data.** Cursor's DB is opened read-only.
5. **Silence is not zero.** Absent vendors are reported, not omitted.

## Accounting details that bit us

- Codex `total_token_usage` is *cumulative*; only `last_token_usage` is a delta.
- OpenAI `input_tokens` includes cached tokens; uncached = input − cached.
- OpenAI `output_tokens` already includes `reasoning_output_tokens`.
- Anthropic bills cache write at 1.25× input, cache read at 0.10× input.
- Session replay duplicates turns; dedupe changed our own figure from
  $9,076 → $4,408 (the correct value).

## Verified on real data

127 sessions, 24,824 turns, ~900MB of logs, **2.9s** runtime.
Surfaced that one project was **51.3%** of total spend — invisible before rollup.

## Risks

| Risk | Mitigation |
|---|---|
| Small teams may not care | The $500 audits validate demand before the SaaS is built |
| Vendors ship this natively | They cannot ship *cross*-vendor; that is the bet |
| Log formats change | Open-source parsers attract community PRs |
| Subscription ≠ API billing | Report both API-equivalent value and subscription efficiency |

## Next

1. Gemini + Copilot parsers
2. Cost per merged PR (branch → GitHub join) — the metric nobody has
3. Hosted dashboard (Next.js + Supabase), `spendwatch push` aggregates only
4. Anonymised cross-team benchmarks — the compounding data moat
