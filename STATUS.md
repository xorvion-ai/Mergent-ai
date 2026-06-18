# Mergent AI — Project Status & Handoff

> **Read this file first.** It is the single source of truth for what this
> project is, how it is built, what is done, and what remains. A fresh Claude
> session should be able to continue the work from this file alone.

_Last updated: 2026-06-15_

---

## 1. What this project is

**Mergent AI** is an AI-powered platform that automates **microservice migration
analysis**. A user uploads their services (GitHub URL, zip, or OpenAPI specs),
clicks **Analyze Architecture**, and a **7-agent pipeline** produces a full
consolidation analysis: service inventory, dependency graph, API-overlap report,
database-merge plan, a proposed target architecture, a risk register,
before/after architecture diagrams, a downloadable report, and a Jira-ready task
backlog.

It is a **resume / portfolio project** for a backend/platform engineer (real
background: service consolidation across Kubernetes, `authnull-service`,
`authn-service`). The headline engineering talking point is the **hybrid
architecture** (below).

- **Functional brief:** [PROJECT_BRIEF.md](PROJECT_BRIEF.md)
- **Product name:** Mergent (the design + brand already use this).
- **Folder rename:** the user intends to rename the project folder from
  `AI Microservies migration system` → `Mergent AI` (must be done while no
  process holds the folder open; not yet done).

---

## 2. The core principle (do not violate)

**Hybrid analysis = deterministic parse → LLM reason.** A deterministic parser
extracts hard FACTS from the code (services, endpoints, dependency edges, DB
schemas). Only those **facts** are sent to the LLM (Google Gemini) to *reason*
over — **never raw repo source**. This saves free-tier quota, scales to large
repos, and is the senior-level talking point.

Every agent is split into a **Parse** (deterministic) step and a **Reason** (LLM)
step. See `server/agents/pipeline.js`.

---

## 3. Locked decisions

| Decision | Choice |
|---|---|
| LLM provider | **Google Gemini free tier**, behind a swappable provider interface. Model via `GEMINI_MODEL` (default `gemini-2.0-flash`). |
| **No-key mode** | If `GEMINI_API_KEY` is absent, a **deterministic reasoning fallback** produces the full analysis. The app is therefore **fully free and never hard-fails**. |
| Scope | **Full platform** — all 7 agents + GitHub clone + diagrams + report + Jira export. |
| Input | Zip upload + GitHub URL + OpenAPI specs. Multi-language: Java/Spring, TS/Express, Python/FastAPI, Go/Gin. |
| Integrations | GitHub clone = **real** (public, no token). Jira = **simulated but real-shaped** (JSON/CSV export). |
| Stack | **Node.js + Express** server (ES modules) serving a **vanilla-JS SPA** (the provided design). Chosen because git clone + filesystem parsing + long SSE need a persistent server (free-hostable on Render/Railway). |

---

## 4. Architecture & data flow

```
Browser (App Homepage Design/ — vanilla SPA, design-provided)
  │  new analysis (GitHub URL / zip / OpenAPI / sample)
  ▼
POST /api/analyses ──────────────► background job (server/index.js: runJob)
  │ returns {id}                      1. intake  (clone / unzip / spec / sample)
  │                                   2. extractFacts()  ← DETERMINISTIC PARSE
GET /api/analyses/:id/stream (SSE) ◄ 3. runAnalysis()    ← 7 agents, parse→reason
  │  live per-agent + console events  4. store + persist
  ▼
GET /api/analyses/:id  ──► full analysis object (the window.MERGENT_DATA shape)
GET …/report?format=html|text
GET …/jira?format=json|csv
```

**The data contract** the whole UI consumes is `window.MERGENT_DATA` — its exact
shape is documented by the bundled sample `App Homepage Design/app/data.js`. The
backend's `runAnalysis()` produces **the same shape**. Keys: `repo, summary,
services, targets, dependencies, apiOverlaps, apiStats, databases, dbMerges,
migration, risks, jira, agents, recent, sampleRepos`.

---

## 5. File map (what lives where)

### Backend (`server/`) — all written, working logic
- `config.js` — env loader (zero-dep `.env`), paths, Gemini config, `hasLLM`.
- `index.js` — Express app: static serving + API routes + `runJob` orchestration + SSE bus.
- `store.js` — in-memory analyses + JSON persistence under `data/analyses/`; `recent()`.
- `report.js` — HTML (print-to-PDF) + text report, Jira JSON/CSV.
- `llm/provider.js` — `reason(label,{instruction,facts,validate,fallback})`; uses Gemini if key, else fallback. Tracks `usage` (quota meter).
- `llm/gemini.js` — `@google/generative-ai` wrapper, forces JSON output.
- `parse/` — **the deterministic fact layer:**
  - `scan.js` (file walk + safe read), `services.js` (service/framework/lang/port),
    `endpoints.js` (Spring/Express/Nest/FastAPI/Flask/Gin/OpenAPI), `deps.js`
    (edges http/queue/shared-db + cycle detection), `db.js` (engine + tables),
    `index.js` (`extractFacts()` aggregator → facts bundle).
- `agents/heuristics.js` — deterministic reasoning (domain grouping, targets,
  overlaps, db merges, migration phases, risks, jira). Used as the no-key fallback
  AND to derive candidate signals for the LLM.
- `agents/pipeline.js` — the **7 agents**; each `startAgent → reason() → doneAgent`;
  assembles final `MERGENT_DATA`-shaped object + summary.
- `intake/` — `github.js` (shallow clone), `zip.js` (adm-zip extract), `openapi.js`
  (JSON + light YAML path parse), `samples.js` (bundled sample registry).

### Bundled sample (`samples/commerce-platform/`) — real multi-language source
8 services exercising every parser: `auth-service` (Java/Spring),
`admin-service` (Java/Spring), `profile-service` (TS/Express), `user-service`
(TS/Express), `account-service` (Python/FastAPI), `billing-service` (Java/Gradle),
`payment-service` (Go/Gin), `notification-service` (Node). Deliberately contains:
a 3-service cycle (auth→profile→admin→auth), a shared DB (`user_db` across
user+account; `billing_db` across billing+payment), and duplicate endpoints
(`/login`, `/users`, `/user/{id}`). This is the zero-config demo + the fallback.

### Frontend (`App Homepage Design/`) — design provided by user, lightly wired
- Unchanged design files: `Homepage.html`, `Login.html`, `styles.css`, `app/*.js`
  views (results, plan, handoff, account, admin, flow), `diagram.js`, `icons.js`,
  `data.js` (sample baseline / offline fallback).
- **Added:** `app/api.js` — backend client + `window.MergentHydrate()` that swaps
  `window.MERGENT_DATA` with the real analysis when one is active.
- **Edited:**
  - `app/app.html` — includes `api.js`.
  - `app/app.js` — `boot()` is now async and `await`s hydration; chrome/crumbs use
    real `repo.name`/`branch`.
  - `app/views-flow.js` — `new` view starts a **real** analysis via the API (URL /
    zip file-input / OpenAPI file-input / sample); `run` view streams **real** SSE
    (`_real`) with the original animation kept as offline fallback (`_simulated`).

### Config / docs
- `package.json` (`npm start` → `node server/index.js`), `.env.example`,
  `.gitignore`, `PROJECT_BRIEF.md`, this `STATUS.md`, (README pending).

---

## 6. How to run

```bash
npm install
cp .env.example .env        # optional — add GEMINI_API_KEY for LLM reasoning
npm start                   # → http://localhost:3000
```
- Open `http://localhost:3000` → Homepage → Login (client-side demo auth, any
  email; admin console shows for `platform@xorvion.dev`) → app console.
- **New analysis → "Try a sample"** is the fastest end-to-end check (no network).
- Without a Gemini key it runs in **deterministic mode** (free, always works).

---

## 7. Status — what is DONE

- [x] Backend scaffold, config, env loader.
- [x] LLM provider interface + Gemini impl + deterministic fallback + quota meter.
- [x] Deterministic parsers: services, endpoints (4 frameworks + OpenAPI),
      dependencies + cycle detection, databases. `extractFacts()` aggregator.
- [x] Intake: real GitHub shallow clone, zip extract, OpenAPI ingest, bundled
      sample + graceful fallback chain.
- [x] 7-agent pipeline (parse→reason), schema validation w/ retry, SSE events,
      assembled into the exact `MERGENT_DATA` shape.
- [x] Express API: `POST /api/analyses`, `GET /api/analyses`, `GET /:id`,
      `GET /:id/stream` (SSE), `GET /:id/report`, `GET /:id/jira`, `GET /api/config`.
- [x] Report (HTML/text) + Jira (JSON/CSV) generation.
- [x] Bundled 8-service multi-language sample repo.
- [x] Frontend wiring: `api.js`, hydration, real `new`+`run` flows.

## 8. Status — what is LEFT / next steps

- [x] **Verified end-to-end (2026-06-15, deterministic mode):** sample run →
      8 services → 4 targets (identity/core-user/commerce/messaging), 31 endpoints,
      5 overlaps, 2 cycles, 6→4 DBs, 18 Jira tasks. Report (HTML) + Jira (CSV) +
      SSE (36 events) + static frontend + real GitHub clone with graceful fallback
      all confirmed working. Fixed on first run: comment-driven phantom dep edges
      (now strip comments in `deps.js`), and `dbAfter` count (now distinct targets).
- [ ] **Browser visual pass** — open `http://localhost:3000`, log in, run a sample,
      click through every analysis view + diagrams + export modals with real data.
      (Backend serves correctly; UI wiring is logically complete but not yet
      eyeballed in a browser here.)
- [ ] **Test with a real multi-service GitHub repo** (the Hello-World test only
      exercised the clone+fallback path, not real multi-service detection).
- [ ] **Dashboard "recent"** is hydrated from the backend, but confirm the
      `data-open-analysis` click opens the correct analysis id (currently always
      goes to `overview` using the active analysis — fine for one, revisit for many).
- [ ] **Export modal** (`app/app.js` EXPORTS) builds report/Jira client-side from
      `MERGENT_DATA`. Optional: switch the report/Jira download to the real backend
      endpoints (`MergentAPI.reportUrl/jiraUrl`) for server-rendered output.
- [ ] **Architecture diagrams** — `app/diagram.js` renders from `MERGENT_DATA`
      (services/targets/edges). Confirm it renders correctly with real data shapes.
- [ ] **PDF**: currently HTML print-to-PDF. A true PDF would need a lib (kept out
      to stay zero-dep/free). Revisit only if required.
- [ ] **README.md** — recruiter-facing: problem→outcome, live demo link,
      screenshots, the hybrid talking point. (Screenshots exist under
      `App Homepage Design/screenshots/`.)
- [ ] **Deploy** free (Render/Railway): `npm start`, set `GEMINI_API_KEY`,
      persistent disk optional for `data/`. Add the live URL to the README.
- [ ] **code-review-graph**: build the graph (`code-review-graph build`) once code
      settles so future navigation/review is low-token (user requested this).
- [ ] Optional auth hardening (currently client-side localStorage demo auth).

---

## 8b. Gemini integration — VERIFIED working (2026-06-15)

- A real Gemini key is in `.env` (gitignored). Model: **`gemini-3.1-flash-lite`**
  (free tier, confirmed available on the key). Live run made **7 Gemini calls**
  (one per agent, zero fallback) producing model-written domains/rationale/risks.
- **Critical gotcha — TLS:** this Windows machine intercepts HTTPS (corporate
  proxy / antivirus), so Node's bundled CA store rejects Google's cert with
  `unable to verify the first certificate` → `fetch failed`, which `reason()`
  silently catches and falls back to deterministic. **Fix already applied:** the
  `start`/`dev` scripts run `node --use-system-ca …` so Node trusts the Windows
  cert store. If you ever see all-deterministic output despite a key, this flag is
  why. PowerShell/.NET and `git` use the system store already, so they were never
  affected.
- If the key was shared in chat/screenshot, rotate it at aistudio.google.com.

## 9. Known design seams / gotchas

- The SPA is **fallback-first**: `data.js` always provides a valid
  `MERGENT_DATA`, and `api.js` overwrites it only when a real analysis is
  `complete`. So the UI renders even with the backend down.
- Agent ids must stay aligned between `pipeline.js` `AGENTS` and `data.js`
  `agents` (`discovery, deps, apis, db, strategy, risk, docs`) — the run view maps
  SSE `agent` events to rows by `data-agent=<id>`.
- `samples/` is intentionally minimal source (enough for parsers to find facts) —
  not runnable services.
- Windows: the server uses the system `git` for cloning; ensure `git` is on PATH.
- Free-host serverless caveat: long SSE + git clone favor a **persistent Node
  host** (Render/Railway) over serverless functions.
