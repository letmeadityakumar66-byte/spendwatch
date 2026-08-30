# Audit delivery SOP (internal)

**Goal:** paid, delivered, testimonial-collected in ≤ 5 calendar days from booking.

## Day 0 — lead arrives (GitHub issue labeled `audit`)
1. Reply within 4 hours (template below). Speed is half the sale.
2. Offer two 15-min preview slots in the next 48h.

> Thanks — happy to run this. Process: one engineer runs `npx spendwatch --json` (100% local; token counts and project paths only — no prompts, code or logs leave the machine) and we look at it together for 15 minutes, free. If it's useful, the full team audit is $500 fixed, delivered in 3 days. Two slots: [A] / [B]. Which works?

## Day 1 — preview call
1. Screen-share their JSON in `npx spendwatch` (they run it; never touch their machine).
2. Point at ONE surprising number (concentration, cache reuse, model share). One is enough.
3. Close: "Want the full team version? $500, invoice now, report in 3 days."
4. Send invoice (Wise / PayPal). **Do not start the report until paid.**

## Day 2 — collect
1. Each engineer runs: `npx spendwatch --json > spendwatch-$(whoami).json` and sends the file.
2. Ask for: team size, which agents, billing type (subscription / API), monthly budget if known.

## Day 3–4 — produce
1. Merge JSONs (one machine per engineer) → `spendwatch --audit "<Client>"` per machine; combine into one report.
2. Add judgment: the five fixes must name *their* repos and *their* models with a rupee/dollar saving each.
3. Export markdown → PDF. Subject: "AI Coding Spend Audit — <Client> — <date>".

## Day 5 — deliver + close the loop
1. Deliver + offer the 30-min walkthrough.
2. Ask for one testimonial sentence and permission to cite one anonymized number.
3. Plant the bridge: "Want this continuously? Team dashboard is coming — $99/mo, founding-customer price."
4. Log: client, date, top finding, saving identified, testimonial → `docs/audits/log.md` (private).

## Kill criterion
30 genuine pitches and 0 paid by 30 Sep 2026 → re-price or pivot cash engine. Do not build the hosted layer before audit #1 is paid.
