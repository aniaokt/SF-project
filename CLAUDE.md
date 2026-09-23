# CLAUDE.md — Coursemap

Working name. Rename freely; update this heading if you do.

## What this is

A hackathon project. A student uploads their transcript and picks a target company or role. We diff the skills that company's current job postings demand against the skills the student's transcript already evidences, then map the remaining gaps onto real courses in their school's catalog and emit a term-by-term plan that respects prerequisites, term availability, and remaining degree requirements.

Three properties define the product. Do not compromise them without being asked:

1. **Every course code is real.** It exists in the ingested catalog. We never let a model invent a course. This is the entire differentiator versus asking a chatbot.
2. **Every recommendation cites evidence.** A span of text from a real job posting, and a span of text from the real catalog entry. Both stored, both rendered.
3. **Gaps are reported honestly.** If no course in the catalog teaches a demanded skill, we say so and label it as non-coursework. We do not paper over it with a loose match.

## Stack

Everything runs on Cloudflare. One Worker, one deploy.

| Concern | Choice | Binding |
|---------|--------|---------|
| Runtime + API | Cloudflare Workers (ES modules) | — |
| Frontend | React + Vite, served as static assets from the same Worker | ASSETS |
| Build glue | @cloudflare/vite-plugin | — |
| Structured data | D1 (SQLite) | DB |
| Embeddings | Workers AI, @cf/baai/bge-base-en-v1.5 (768-dim) | AI |
| Reasoning (extraction, re-rank, evidence) | Anthropic API through AI Gateway | ANTHROPIC_API_KEY secret, plus CF_ACCOUNT_ID and AI_GATEWAY_ID as vars |
| Blob storage (only if transcripts get stored) | R2 | BUCKET |

Be on **Workers Paid ($5/mo) from hour zero.** This is not an optimization, it is a prerequisite. Workers Free caps CPU at 10 ms per request and the similarity scan is pure compute; the free tier also now enforces D1 daily row-read limits and gates some Workers AI models. Paying removes three separate demo-day failure modes for the price of a sandwich.

AI Gateway base URL from inside a Worker: `await env.AI.gateway(env.AI_GATEWAY_ID).getUrl("anthropic")`, passed as the Anthropic SDK's `baseURL`. If you use BYOK or Unified Billing, do not also send an `x-api-key` header — the gateway supplies the key and your own header makes the request fail.

**Vector search: no Vectorize by default.** A single university catalog is a few thousand courses. Embeddings are precomputed offline, stored in D1 as BLOB (Float32Array), and scored with brute-force cosine in the Worker. That is single-digit milliseconds and removes an entire service, an index-creation step, and a class of dimension-mismatch bugs. There is an optional stage in PLAN.md to swap in Vectorize if we are ahead of schedule or if the sponsor wants to see it.

Config lives in `wrangler.jsonc`. Do not create a `wrangler.toml` alongside it. Pin a current `compatibility_date` — from 2026-08-04 onward `nodejs_compat` is on by default, so Node built-ins work with zero config. Copying an older date from a blog post produces cryptic import failures.

## Five things that will silently break this build

Read these before writing the matching engine. Each one fails in a way that looks like a different problem.

1. **D1 BLOB columns read back as `number[]`, not `ArrayBuffer`.** So `new Float32Array(row.embedding)` does not throw — it returns 3072 floats equal to the raw byte values, and your similarity scores become quietly meaningless. The correct decode is always:
   ```ts
   new Float32Array(new Uint8Array(row.embedding).buffer)
   ```
2. **Read the courses table once per request, not once per skill.** Scanning ~2000 rows for each of ~23 skills is 46k row-reads per request, which runs into D1's now-enforced free tier limits and wastes CPU. Load the table once, score every skill in memory.
3. **Pin the embedding pooling mode.** bge supports `mean` (default) and `cls`, and vectors produced with different pooling are not comparable. Stage 4 embeds skill text at runtime and compares it against course vectors embedded offline. A mismatch looks exactly like "the embedding model is bad."
4. **One INSERT per course in seed.sql.** A D1 SQL statement caps at 100 KB; batching ~16 courses with 6 KB hex blobs each will exceed it.
5. **Workers Free's 10 ms CPU limit will kill the similarity scan.** See the note above — be on Workers Paid.

## Repo layout

```
/
  wrangler.jsonc
  CLAUDE.md
  PLAN.md
  package.json
  vite.config.ts
  /src
    index.ts            Worker entry: routes + static asset fallthrough
    /routes             One file per endpoint, thin
    /core               Pure logic. No I/O, no bindings, no fetch.
      transcript.ts
      skills.ts
      match.ts
      schedule.ts
    /llm                Anthropic calls. Every prompt in its own file, exported as a const.
    /db                 D1 queries. Raw SQL, no ORM.
  /web                  React app. Vite root.
  /data
    /raw                Source PDFs/HTML, committed. Never fetched at runtime.
    /fixtures           Parsed JSON: catalog.json, postings/*.json, transcripts/*.json
    /scripts            Offline prep scripts (Node, run locally, not deployed)
  /migrations           D1 SQL migrations, numbered
```

## Hard rules

**Demo safety — these are not negotiable.**

- No live third-party network calls on the demo path. Job postings are scraped once, offline, and committed to `/data/fixtures`. If the demo needs a posting, it reads it from D1, which was seeded from a fixture. A flaky scrape at 9am on judging day ends the project.
- Anthropic calls on the demo path must have a cached fallback. Key every LLM call by a hash of its input and store responses in `/data/fixtures/llm-cache.json`, seeded into D1. On cache hit, return the cached value. Conference wifi will fail; the demo will not.
- Seed at least one end-to-end golden path (one transcript, one company) that works with the network fully disabled. Add a test that runs it with `fetch` stubbed to throw.
- Deploy on day one. A Worker that returns "hello" should be live within the first six hours. Do not discover deployment problems at hour 44.

**Code conventions.**

- TypeScript, strict mode on.
- `/core` is pure and unit-testable. Bindings are passed in at the edges, never imported into `/core`. If you find yourself importing `env` into `/core`, the boundary is wrong.
- Raw SQL. No ORM, no query builder. The schema is small and we need to read it fast at 3am.
- No new npm dependency without a one-line justification in the commit message. Every dependency is a potential Workers-runtime incompatibility (Node builtins, `fs`, native modules). Prefer the platform.
- Errors surface to the UI as human-readable strings. A silent failure during a demo looks identical to a hang.

**LLM usage.**

- Extraction and ranking prompts must return JSON conforming to a declared schema, validated on receipt. Reject and retry once; on second failure, fall back to a deterministic path.
- Never ask a model to produce a course code. Models select from a candidate list of real codes we supply, and return indices or codes we then verify against D1. Any returned code not present in the catalog is dropped and logged loudly.
- Keep prompts in `/src/llm/prompts/`, one export per file, so they can be diffed.

## Things not to do

- **Do not build a general-purpose transcript PDF parser.** Transcript layouts vary wildly by school and year. Support pasted text as the primary path, plus exactly one sample PDF we control. This is a trap that eats a full day.
- **Do not scrape LinkedIn profiles.** It violates their terms, it will be asked about by judges, and job postings are a better signal anyway. Public postings only.
- **Do not build auth, accounts, or multi-tenancy.** One session, in memory, no login.
- **Do not attempt live catalog ingestion for arbitrary schools.** One school, prepared offline.
- **Do not add Durable Objects, Queues, Workflows, or Hyperdrive.** Nothing here needs them, and each is a new failure mode.
- **Do not spend time on responsive mobile layout.** It will be demoed on a laptop or projector.

## Prerequisite data is the hard part

Catalog prerequisite text is messy natural language: "CMSC 15400 or equivalent, and consent of instructor", "one of MATH 15300, 15910, or 16300". Parsing this is the single most underestimated task in the build.

Handle it offline, before the clock matters: run an LLM extraction pass over the catalog into a structured prereq expression tree (`{all: [...]}`, `{any: [...]}`, `{consent: true}`), then have a human spot-check the couple hundred courses in the departments we actually demo. Commit the result. The Worker reads structured prereqs and never parses prose at runtime.
