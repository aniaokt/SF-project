# PLAN.md — Coursemap, 48-hour build

Read CLAUDE.md first. This file is the execution plan: stages, hour budget, acceptance criteria, and the prompts to hand Claude Code at each step.

Assumes a team of 2–3 and a 48-hour clock. Hours are elapsed wall-clock from kickoff, not person-hours. Two tracks run in parallel for the first third; they are marked [A] and [B].

## Write the demo first

Before any code, agree on the exact three minutes you will show judges. Everything below exists to make these six beats work. If a task does not serve a beat, cut it.

**Paste a transcript.** Third-year CS major at UChicago, 18 courses done.
**Type a target:** "I want to work at Jane Street as a software engineer."
**Screen shows** 12 current postings ingested, 23 distinct skills extracted, weighted by how many postings mention each.
**Coverage map:** 9 of 23 skills already satisfied by completed coursework, each with the course that satisfies it. 11 addressable by catalog courses. 3 not teachable here.
**The kill shot:** same question to a plain chatbot on the next monitor. It invents CMSC 27500 "Advanced Trading Systems". Search the real catalog live. No such course.

Beat 6 is the pitch. Rehearse it.

## Stack decisions, already made

Single Worker serving a React SPA from static assets. D1 for everything structured. Workers AI for embeddings, Claude via AI Gateway for reasoning. No Vectorize — brute-force cosine over a few thousand precomputed 768-dim vectors held in D1 is faster to build, faster to debug, and imperceptibly slower to run. Stage 9 adds Vectorize if there is time or if the sponsor wants it on screen.

Rationale is in CLAUDE.md. Do not relitigate this at hour 20.

## Hour budget

| Stage | Hours | Track | What |
|-------|-------|-------|------|
| 0 | 0–2 | both | Kickoff, repo, decisions locked |
| 1 | 2–10 | [A] | Offline data prep — the critical path |
| 2 | 2–6 | [B] | Skeleton Worker, deployed live |
| 3 | 6–14 | [B] | Ingest + skill extraction |
| 4 | 14–22 | both | Matching engine |
| 5 | 22–30 | both | Scheduler |
| 6 | 26–38 | [B] | UI |
| 7 | 38–44 | both | Demo hardening |
| 8 | 44–48 | both | Pitch, rehearsal, sleep |

Sleep is in the budget. Two people awake at hour 40 write code that loses hackathons. Stagger a four-hour sleep each somewhere in stages 5–6.

## Stage 0 — Kickoff (H0–H2)

Lock these before writing code:

- One school. UChicago. One catalog.
- Three to five target companies, chosen for having many public postings with concrete technical requirements.
- Two sample transcripts. One "on track", one "behind and needs a tight plan".
- Cloudflare account on **Workers Paid ($5/mo)**. Not optional. Also: `wrangler login`, Anthropic API key, and an AI Gateway created with its ID noted.

**Deliverable:** repo initialized, CLAUDE.md and PLAN.md committed, both tracks assigned.

## Stage 1 [A] — Offline data prep (H2–H10)

Scripts live in `/data/scripts` and run locally on Node — they are not deployed.

### 1a. Catalog → structured JSON

```json
{
  "code": "CMSC 25400",
  "title": "Machine Learning",
  "description": "...full catalog text...",
  "credits": 100,
  "terms": ["Winter"],
  "prereqs": { "all": [ { "any": ["CMSC 15400", "CMSC 14400"] }, "MATH 20250" ] },
  "fulfills": ["cs-elective", "major-cs"],
  "department": "CMSC"
}
```

### 1b. Job postings → structured JSON

Public postings only. No LinkedIn profiles.

### 1c. Embeddings

Embed every course description with `@cf/baai/bge-base-en-v1.5` (768 dims). Store as Float32 blobs in the seed SQL. One INSERT per course.

**Acceptance:** `catalog.json` >1500 courses, `postings/` ≥10 postings per company, `seed.sql` loads without error.

## Stage 2 [B] — Skeleton, deployed (H2–H6)

- `npm create cloudflare@latest -- coursemap --framework=react`
- `wrangler.jsonc` with assets, D1, and AI bindings
- `GET /api/health` → `{ok: true, db: <row count>}`
- `wrangler deploy` — confirm from phone on cell data

## Stage 3 [B] — Ingest and skill extraction (H6–H14)

Pasted text is the primary transcript path. Skill extraction produces a weighted taxonomy with posting citations.

## Stage 4 — Matching engine (H14–H22)

In `/src/core/match.ts`, pure and unit-tested:
1. Coverage — which skills already satisfied
2. Candidates — cosine-rank catalog, top 30 per skill, load table once
3. Re-rank with Claude — verify every code and quote span against D1

## Stage 5 — Scheduler (H22–H30)

Greedy topological sort into term-by-term plan. Reserve slots for degree requirements first.

## Stage 6 [B] — UI (H26–H38)

Four screens: Input, Coverage map, The plan, Course detail. Tailwind only.

## Stage 7 — Demo hardening (H38–H44)

- Seed LLM cache, verify cache hits
- Airplane-mode test — stub fetch to throw
- Record 3-minute screen capture
- Rehearse twice with a timer

## Stage 8 — Pitch (H44–H48)

Five slides. Problem → Demo → Why not chatbot → Who pays → What's next.

## Descope ladder

1. PDF upload → paste only
2. Multiple companies → one company
3. Degree-requirement checking → skill gaps only
4. Prereq arrows → text note
5. Scheduler → ranked list grouped by term
6. Course detail → expand inline

**Never cut:** citation verification, the coverage map, or the offline demo path.
