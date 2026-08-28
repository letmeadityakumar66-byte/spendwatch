# Launch assets — spendwatch

## Show HN title
Show HN: Spendwatch – what your AI coding agents actually cost, across vendors

## Show HN body
I ran one command against my own machine and found that a single project had
quietly consumed 51% of everything I'd spent on AI coding agents in six months —
across Claude Code, Codex and Cursor. No vendor dashboard could have told me
that, because no vendor will ever show you a competitor's usage.

spendwatch reads the logs those tools already write locally and reports
API-equivalent cost by project, model, and agent. 100% local, no network calls,
zero runtime dependencies (~700 lines, readable in one sitting).

Two rules it refuses to break: it never guesses a price (unknown models are
counted and reported unpriced — gpt-5.3-codex is NOT gpt-5, despite the string
prefix), and it never double-counts (session replay inflated my own number 2×
until deduped on request id).

npx spendwatch
https://github.com/letmeadityakumar66-byte/spendwatch

## X/Reddit one-liner
One project ate 51% of my six-month AI coding spend and no dashboard could show
me — Anthropic won't show you Cursor usage, Cursor won't show you Codex.
So I built spendwatch: one command, 100% local. 
