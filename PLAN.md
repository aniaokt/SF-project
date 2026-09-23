# PLAN.md — Coursemap, 48-hour build

Read CLAUDE.md first. This file is the execution plan: stages, hour budget, acceptance criteria, and the prompts to hand Claude Code at each step.

Assumes a team of 2–3 and a 48-hour clock. Hours are elapsed wall-clock from kickoff, not person-hours. Two tracks run in parallel for the first third; they are marked [A] and [B].

## Write the demo first

Before any code, agree on the exact three minutes you will show judges. Everything below exists to make these six beats work. If a task does not serve a beat, cut it.

1. **Paste a transcript.** Third-year CS major at UChicago, 18 courses done.
2. **Type a target:** "I want to work at Jane Street as a software engineer."
3. **Screen shows** 12 current postings ingested, 23 distinct skills extracted, weighted by how many postings mention each.
4. **Coverage map:** 9 of 23 skills already satisfied by completed coursework, each with the course that satisfies it. 11 addressable by catalog courses. 3 not teachable here.
5. **The plan:** Winter / Spring / Autumn, real course codes, prereq chains respected, each course carrying a posting quote and a catalog quote.
6. **The kill shot:** same question to a plain chatbot on the next monitor. It invents CMSC 27500 "Advanced Trading Systems". Search the real catalog live. No such course.

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

Lock these before writing code, because changing them later is expensive:

- One school. UChicago. One catalog.
- Three to five target companies, chosen for having many public postings with concrete technical requirements. Pick now; the scrape depends on it.
- Two sample transcripts. One "on track", one "behind and needs a tight plan". The second demos better because the constraint solver visibly earns its keep.
- Cloudflare account on **Workers Paid ($5/mo)**. Not optional, not an optimization. Workers Free caps CPU at 10 ms per request and the similarity scan is pure compute; the free tier also enforces D1 daily row-read limits and gates some Workers AI models. Upgrading at hour zero removes three demo-day failure modes at once. Also: `wrangler login`, Anthropic API key, and an AI Gateway created with its ID noted.

**Deliverable:** repo initialized, CLAUDE.md and PLAN.md committed, both tracks assigned.

## Stage 1 [A] — Offline data prep (H2–H10)

This is the critical path and the most underestimated stage. It is also the one Claude Code is best at, because it is bounded, scriptable, and verifiable. Start it at hour 2.

Scripts live in `/data/scripts` and run locally on Node — they are not deployed.

### 1a. Catalog → structured JSON

Target output, one object per course:

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

Prereq extraction is an LLM pass, not a regex. Then a human reads the ~200 courses in the departments you will actually demo and fixes what the model got wrong. Budget 90 minutes for this review. It is boring and it is what makes the demo credible.

### 1b. Job postings → structured JSON

Scrape once, offline, commit the raw HTML to `/data/raw` and parsed JSON to `/data/fixtures/postings/`. Ten to fifteen postings per company. Keep the full text — you need exact spans for evidence citations.

Public postings only. No LinkedIn profiles, no authenticated pages.

### 1c. Embeddings

Embed every course description with `@cf/baai/bge-base-en-v1.5` (768 dims) via a local script hitting `POST /client/v4/accounts/{id}/ai/run/@cf/baai/bge-base-en-v1.5` with `{"text": [...]}`. Store as Float32 blobs in the seed SQL.

Two details that cause silent corruption if missed: pin the pooling mode explicitly (`mean` vs `cls` produce incomparable vectors, and Stage 4 embeds skill text at runtime to compare against these), and emit one INSERT per course — D1 caps a SQL statement at 100 KB and a few courses' worth of hex blobs will exceed it.

**Acceptance:** `catalog.json` has >1500 courses, >95% with parsed prereqs, and the ~200 demo-department courses are human-verified. `postings/` has ≥10 postings per target company. `seed.sql` loads into a local D1 without error.

**Prompt for Claude Code:** "Write Node scripts in /data/scripts that (1) parse the catalog HTML in /data/raw into the course JSON schema in PLAN.md stage 1a, using the Anthropic API for prerequisite expression extraction with a validated JSON schema and a retry on malformed output; (2) parse saved job posting HTML into {company, title, url, full_text, scraped_at}; (3) call the Workers AI REST embeddings endpoint for every course description and emit seed.sql with vectors as hex-encoded Float32 blobs. Include a --dry-run flag and print a parse-failure report at the end listing every course whose prereqs failed to parse."

## Stage 2 [B] — Skeleton, deployed (H2–H6)

In parallel with Stage 1. The goal is a live URL by hour 6.

- `npm create cloudflare@latest -- coursemap --framework=react` (the Vite plugin template; it already sets `not_found_handling: "single-page-application"`).
- `wrangler.jsonc` with `assets` (`binding: "ASSETS"`, `not_found_handling: "single-page-application"`, and `run_worker_first: ["/api/*"]` so API routes bypass asset matching), plus `d1_databases` and `ai` bindings. Pin a current `compatibility_date`.
- One real endpoint: `GET /api/health` returning `{ok: true, db: <row count>}` — proves the D1 binding works in production, not just locally.
- `wrangler deploy`. Confirm the URL loads from a phone on cell data.

**Acceptance:** public URL serving the React app and `/api/health` reading from D1.

**Prompt for Claude Code:** "Scaffold a Cloudflare Worker with @cloudflare/vite-plugin serving a React SPA from static assets, plus D1 and Workers AI bindings, per the stack table in CLAUDE.md. Add migrations for the schema below, a /api/health endpoint that returns a course count from D1, and strict TypeScript. Do not add any dependency not required for this."

## Stage 3 [B] — Ingest and skill extraction (H6–H14)

**Transcript parsing.** Pasted text is the primary path — a textarea and an LLM extraction into `{code, title, term, grade, credits}[]`, validated against the catalog so unknown codes are flagged rather than silently accepted. PDF upload handles exactly one sample file you control. Do not generalize.

**Skill extraction.** For a target company, pull its postings from D1 and run one LLM pass producing a weighted skill taxonomy:

```json
[{ "skill": "probability and statistics",
   "weight": 0.58,
   "postings": ["jane-street-swe-1", "jane-street-swe-4"],
   "evidence": ["Strong foundation in probability and statistics"] }]
```

Weight is fraction of postings mentioning the skill. Merge near-duplicates in the same pass ("ML", "machine learning", "statistical learning") — ask for a canonical label plus aliases.

**Target extraction** from the user's free-text sentence: company plus role family, matched against the companies you actually seeded. If it is not one of them, say so plainly rather than degrading to a generic answer.

**Acceptance:** paste a transcript and a sentence, get back a validated course list and a ranked skill list with posting citations. Endpoint-level, no UI needed yet.

## Stage 4 — Matching engine (H14–H22)

Three steps, in `/src/core/match.ts`, pure and unit-tested:

1. **Coverage.** Which demanded skills does the transcript already satisfy? Embed each completed course's catalog description, cosine against skill embeddings, threshold. This produces the "already covered, don't waste a slot" list — a memorable part of the demo.
2. **Candidates.** For each uncovered skill, cosine-rank all catalog course embeddings, take top 30, drop courses already taken. Load the courses table once per request and score every skill against it in memory — a scan per skill is ~46k row reads and will hit D1's enforced limits. And decode blobs as `new Float32Array(new Uint8Array(v).buffer)`; the naive `new Float32Array(v)` silently returns garbage of the wrong length.
3. **Re-rank with Claude.** Feed the 30 candidates plus the skill plus the student context. The model returns ordered course codes with, for each, a quoted span from the catalog text and a quoted span from a posting. Verify every returned code exists in D1 and every quoted span appears verbatim in the source. Drop and log anything that fails. This verification step is the product.

Mark skills with no candidate above threshold as `not_teachable_here`. Surface them.

**Acceptance:** unit tests over a fixture transcript produce a stable, verified recommendation set. Every citation span is checked to exist in the source text.

## Stage 5 — Scheduler (H22–H30)

Turns a ranked course list into a term-by-term plan. This is what makes it a product rather than a search result.

Inputs: recommended courses with skill weights, prereq trees, terms offered, completed courses, remaining terms, max credits per term, outstanding degree requirements.

Greedy with backtracking is sufficient — this is not a scheduling-theory contest:

1. Topologically sort by prereq depth.
2. Walk terms in order; at each term, fill slots with the highest-weight available course whose prereqs are satisfied by that point and which is offered that term.
3. Reserve slots for unmet degree requirements before discretionary picks. A plan that delays graduation is worse than useless.
4. If a high-value course is unreachable (prereq chain too long for remaining terms), report it explicitly: "CMSC 33250 needs two prior terms you don't have — consider summer."

Honest failure output beats a plausible wrong plan. Judges test edge cases.

**Acceptance:** the "behind schedule" fixture transcript produces a valid plan with no prereq violation, no course offered in a term it isn't taught, and all degree requirements met — and a clear explanation of anything it could not fit.

## Stage 6 [B] — UI (H26–H38)

Four screens. Resist adding a fifth.

1. **Input** — transcript textarea, target sentence, one button.
2. **Coverage map** — the single most legible screen. Demanded skills on one axis, three states: already covered (with the course), addressable (with the course), not teachable here. One glance should tell the whole story. If a judge only sees one screen, this is it.
3. **The plan** — terms as columns, courses as cards, prereq arrows between them.
4. **Course detail** — on click: full catalog text, the posting quotes, prereq status, requirements satisfied.

Tailwind, no component library, no animation beyond a loading state. Make the loading state informative ("reading 12 postings… extracting skills… matching 1,847 courses") — it covers latency and it shows judges the machinery.

## Stage 7 — Demo hardening (H38–H44)

The highest-value hours in the build. Do not skip them to add a feature.

- **Seed the LLM cache.** Run the golden path repeatedly, capture every Anthropic response into `llm-cache.json`, seed into D1, verify cache hits.
- **Airplane-mode test.** Stub `fetch` to throw. The golden path must still complete end to end. If it doesn't, fix that before anything else.
- **Prepare the kill shot.** Get the chatbot hallucinating a fake course code and screenshot it as backup, in case it behaves itself on stage.
- **Record a 3-minute screen capture** of the working demo. Insurance against the venue wifi.
- **Error states** for: unknown company, unparseable transcript, empty catalog match.
- **Rehearse twice**, out loud, with a timer. Time it to 2:30 so you have slack.

## Stage 8 — Pitch (H44–H48)

Five slides. Problem (advisor ratios are ~1:800 and advisors don't read job postings) → demo → why it isn't a chatbot wrapper (grounding, constraints, verified citations) → who pays (career services and advising offices, not students) → what's next.

Prepare answers to the two questions you will definitely get:

- **"Isn't this just ChatGPT?"** → Beat 6. Show, don't argue.
- **"Does this actually get people hired?"** → No, and don't claim it. It closes a documented skill gap against stated employer requirements. Overclaiming causation is how you lose a judge who does this for a living.

## D1 schema

```sql
CREATE TABLE courses (
  code TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  department TEXT, credits REAL, terms TEXT,          -- JSON array
  prereqs TEXT, fulfills TEXT,                        -- JSON
  embedding BLOB   -- 768 × float32. Decode as new Float32Array(new Uint8Array(v).buffer)
);
CREATE TABLE postings (
  id TEXT PRIMARY KEY, company TEXT NOT NULL, title TEXT NOT NULL,
  url TEXT, full_text TEXT NOT NULL, scraped_at TEXT
);
CREATE TABLE skills (
  id TEXT PRIMARY KEY, company TEXT NOT NULL, label TEXT NOT NULL,
  aliases TEXT, weight REAL NOT NULL, evidence TEXT,  -- JSON: [{posting_id, quote}]
  embedding BLOB
);
CREATE TABLE requirements (
  id TEXT PRIMARY KEY, program TEXT NOT NULL, label TEXT NOT NULL,
  rule TEXT NOT NULL                                  -- JSON: {n_of: 3, from: [...]}
);
CREATE TABLE llm_cache (
  key TEXT PRIMARY KEY, response TEXT NOT NULL, created_at TEXT
);
CREATE INDEX idx_courses_dept ON courses(department);
CREATE INDEX idx_postings_company ON postings(company);
CREATE INDEX idx_skills_company ON skills(company);
```

## Descope ladder

When you fall behind — and you will — cut in this order. Cut early and deliberately rather than discovering at hour 46 that nothing works end to end.

1. PDF transcript upload → paste only.
2. Multiple companies → one company, fully polished.
3. Degree-requirement checking → skill gaps only, note it as future work.
4. Prereq arrows in the UI → a text note under each course.
5. The scheduler → a ranked list grouped by suggested term. Cut this only if truly desperate; it is the main thing separating you from a search box.
6. Course detail screen → expand inline on the plan screen.

**Never cut:** citation verification, the coverage map, or the offline demo path. Those three are the project.

## Optional Stage 9 — Vectorize (only if ahead at H30)

If the hackathon is Cloudflare-sponsored, having Vectorize on screen may be worth points. It is a contained swap:

```bash
npx wrangler vectorize create coursemap --dimensions=768 --metric=cosine
npx wrangler vectorize create-metadata-index coursemap --property-name=department --type=string
```

Metadata indexes are a separate command and must run before any vectors are inserted — vectors upserted beforehand won't appear in the index until re-upserted. Index config is immutable after creation. Then upsert the same vectors and replace the cosine scan behind the existing interface in `/src/core/match.ts`.

Keep the brute-force path behind a feature flag so you can switch back in one commit if the index misbehaves during rehearsal.

## Known risks

| Risk | Mitigation |
|------|-----------|
| Prereq parsing is worse than expected | Human review of demo departments in Stage 1; structured prereqs committed, never parsed at runtime |
| Anthropic latency makes the demo drag | Cache seeded in Stage 7; informative loading state; keep the live path to one or two calls |
| Venue wifi fails | Full offline path, tested with fetch stubbed; recorded video backup |
| Skill extraction produces mush ("communication", "teamwork") | Prompt for concrete technical/analytical competencies only; drop soft skills with an explicit filter list |
| Transcript format from a judge's own school breaks it | Scope to one school out loud in the pitch; it is a demo, not a product launch |
| Workers Free 10 ms CPU limit kills the similarity scan | Workers Paid from hour zero (Stage 0). This is the single most likely platform-level demo killer |
| Embeddings appear to "just be bad" | Almost always one of two bugs: wrong BLOB decode, or mismatched pooling mode. Check both before blaming the model |
