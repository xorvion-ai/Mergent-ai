# AI Microservice Migration Platform — Build Plan (Hand-off Brief)

> **For the implementing Claude:** This is a functional/requirements brief, not a
> design spec. **You decide all UI/UX, visual design, and the concrete framework
> choices.** The sections below define *what* the product must do; the *how it
> looks* and most *how it's built* is yours to design. Honor only the hard
> constraints called out under **Constraints**.

---

## Context

The author is a backend/platform engineer (real-world background: service
consolidation across Kubernetes clusters, multiple microservices, VMs —
`authnull-service`, `authn-service`, etc.). They are building this as a
**portfolio / resume project** to impress recruiters and demonstrate senior-level
systems thinking, not a typical AI chatbot.

**The problem it solves:** Companies accumulate many microservices
(`user-service`, `auth-service`, `notification-service`, `profile-service`,
`admin-service`, `billing-service`, …). Over time these become hard to maintain,
expensive to run, and full of duplicate code and overlapping APIs. Engineers
spend **weeks** manually analyzing service dependencies, API overlap, databases,
configs, and deployment pipelines before they can safely merge or migrate
services.

**The intended outcome:** A platform where a user uploads their services
(GitHub URL, zip, or OpenAPI specs), clicks **Analyze Architecture**, and a team
of AI agents automatically produces a full migration analysis: service inventory,
dependency graph, API overlap, database consolidation opportunities, a proposed
target architecture, a risk assessment, architecture diagrams, a downloadable
report, and an exportable backlog of migration tasks.

---

## Locked Decisions (from the author)

| Decision | Choice |
|---|---|
| **LLM provider** | **Google Gemini free tier** (large context, good code reasoning, no card needed). Keep it behind a thin provider interface so it *can* be swapped later, but Gemini is the target. |
| **Scope** | **Build the full platform** — all 7 agents + GitHub auto-clone + Jira automation + diagram generation. |
| **Input + languages** | **Zip upload + GitHub URL.** Multi-language detection via file-pattern heuristics + LLM code reading. Must handle at least **Spring Boot (Java), Node/Express, Python/FastAPI, Go**. Also accept Swagger/OpenAPI specs as supplementary input. |
| **Integrations** | **GitHub clone = real** (public repos, no token). **Jira = simulated** — generate real, well-formed tickets and let the user preview/export them (JSON/CSV/copy), without requiring a live Jira account. Structure the Jira layer so a real API call could be dropped in later. |

---

## Constraints (hard requirements — do not violate)

1. **Hybrid analysis is mandatory — never send the whole repo to Gemini.**
   A **deterministic parser extracts facts first**, then **Gemini reasons over
   those facts**. This is the central architectural principle of the project.
   ```
   ❌ Bad:  send entire repo → Gemini
   ✅ Good: parser extracts facts (endpoints, deps, tables, configs)
           → Gemini reasons / judges / summarizes over the facts
   ```
   This saves free-tier quota, scales to large repos, produces more reliable
   output, and is the senior-level talking point for recruiters ("I didn't just
   dump code into an LLM — I built a fact-extraction layer and used the model only
   for reasoning"). Every agent below specifies which part is **deterministic
   (parse)** vs **LLM (reason)**.
2. **Must stay free to build and run.** No paid APIs, no paid hosting tier
   required for a working public demo. Gemini free tier for all LLM calls. Free
   hosting tier. No service that demands a credit card.
3. **Recruiters must be able to click a live URL and try it** — so it must be
   publicly hostable (rules out a local-only Ollama setup as the primary path).
4. **Graceful degradation:** if the LLM quota is exhausted or a repo can't be
   cloned, the app must show a clear message and fall back to bundled **sample
   repositories** so a demo never hard-fails in front of a recruiter.
5. **Long-running analysis must stream progress** — the user watches each agent
   work (live status per agent), never a frozen spinner for minutes.
6. **No secrets in the repo.** Gemini API key and any tokens via environment
   variables only.

---

## User Workflow (the happy path)

1. User lands on the app, sees a clear "what this does" explanation.
2. User provides input: **paste a GitHub URL**, **upload a zip**, or **drop
   OpenAPI/Swagger specs** (any combination).
3. User clicks **Analyze Architecture**.
4. The platform clones/extracts the code, then runs the agent pipeline, showing
   **live per-agent progress**.
5. User sees results: service inventory → dependency graph → API overlap → DB
   analysis → proposed target architecture → risk report → diagrams.
6. User can **download a report** (PDF or rich HTML) and **export a Jira-ready
   task backlog**.
7. If anything fails, fall back to a **sample analysis** so the demo still works.

---

## The Agent Pipeline (the core of the product)

Implement these as **7 distinct agents** orchestrated in a pipeline (later agents
consume earlier agents' structured output). Each agent should emit **structured
JSON** (validate it), and the orchestrator streams status updates to the UI.

**Every agent follows the hybrid pattern (mandatory, per Constraint #1):** a
deterministic **Parse** step extracts hard facts from the code/config/specs, then
a focused **Reason** step sends *only those facts* (never raw repo dumps) to
Gemini for judgment/synthesis. Each agent below is annotated with its **Parse**
(deterministic) and **Reason** (LLM) responsibilities.

### 1. Service Discovery Agent
- **Parse (deterministic):** detect each service and its framework/language/port
  from file patterns — `pom.xml`/`build.gradle` (Spring Boot/Java),
  `package.json` (Node/Express), `requirements.txt`/`pyproject.toml`
  (Python/FastAPI), `go.mod` (Go), Dockerfiles, and config files (ports, app
  names). This is pure file/AST scanning — no LLM needed.
- **Reason (LLM):** given the extracted service facts, label each service's
  likely responsibility/domain and normalize messy/edge cases the parser missed.
- *Example output:* `{ "service": "auth-service", "framework": "Spring Boot", "language": "Java", "port": 8080, "apis": [...] }`

### 2. Dependency Mapping Agent
- **Parse (deterministic):** extract inter-service references — HTTP client calls,
  service URLs in config, message-queue topics, env-var service references — into
  edges.
- **Reason (LLM):** over the edge list, resolve ambiguous references to services
  and summarize the graph. Build a **dependency graph** and **flag circular
  dependencies** (cycle detection itself is deterministic).
- *Example:* `auth → profile → notification`.

### 3. API Analysis Agent
- **Parse (deterministic):** extract every endpoint from controllers/route
  definitions and Swagger/OpenAPI specs into a normalized list
  (`{ service, method, path }`).
- **Reason (LLM):** over the normalized endpoint list, **detect overlap /
  duplication / semantic equivalence** across services (e.g., both `auth-service`
  and `profile-service` expose `GET /user`) and explain the duplication.

### 4. Database Analysis Agent
- **Parse (deterministic):** detect datastores (MySQL, Postgres, MongoDB) from
  configs/ORM models/migrations and inventory tables/collections (`users`,
  `roles`, `permissions`, …) with their owning service.
- **Reason (LLM):** over the schema inventory, **suggest consolidation/merge
  opportunities** with rationale (e.g., overlapping `users` tables → merge).

### 5. Migration Strategy Agent (most important)
- **Parse (deterministic):** assemble the structured outputs of agents 1–4 into a
  compact facts bundle (services, deps, API overlap, DB merges).
- **Reason (LLM):** from that bundle, produce a **Current Architecture → Target
  Architecture** proposal with a step-by-step, ordered migration strategy and
  rationale.
- *Example:* merge `auth-service` + `admin-service` + `profile-service` →
  `authnull-service`. Must explain *why* and *in what order*.

### 6. Risk Analysis Agent
- **Parse (deterministic):** derive candidate risk signals from facts — shared
  databases, circular deps, duplicate APIs, statefulness — directly from earlier
  agents' output.
- **Reason (LLM):** classify each into **High** (e.g., shared DB, circular dep),
  **Medium** (e.g., duplicate APIs), **Low** (e.g., stateless services), with
  impact + suggested mitigation.

### 7. Documentation Agent
- **Parse (deterministic):** assemble all prior structured outputs and render the
  document scaffold (sections, tables, diagram embeds) — no LLM for layout.
- **Reason (LLM):** write the narrative prose — **migration plan, rollback
  strategy, executive summary**. Export as **PDF** (and/or rich HTML).

---

## Advanced Automation Features (all in scope)

### Auto GitHub Analysis (real)
User pastes a public repo URL → platform **clones it server-side** → feeds it to
the pipeline → produces the report. No manual steps. Handle mono-repos and
multi-service repos. (Public repos need no token; design so a token *could* be
added for private repos later.)

### Architecture Diagram Generation
Generate diagrams for **both** the current and proposed architecture (service
boxes + dependency arrows). Use a text-driven diagram approach (e.g.
Mermaid-style or equivalent) so diagrams render in-app and export into the report.
Show **before vs. after** side by side — this is the demo centerpiece.

### Jira Automation (simulated, real-shaped)
From the migration plan, auto-generate a **task backlog**:
- *e.g.* `TASK-1 Move login APIs`, `TASK-2 Merge user tables`,
  `TASK-3 Update deployment`.
Each task: title, description, suggested epic, priority, dependencies. Let the
user **preview and export** (JSON/CSV/clipboard) in a Jira-import-friendly shape.
Isolate this behind an interface so a real Jira REST call can replace the
simulation later.

---

## Suggested Technical Shape (flexible — implementing Claude may change)

These are *suggestions* to satisfy the free + hostable + streaming constraints.
You may choose differently as long as the **Constraints** above hold.

- A **single full-stack web app** is the simplest free-hostable shape (one deploy,
  built-in API routes, easy SSE/streaming for live agent progress).
- **Gemini** accessed through a small **provider abstraction** (one interface,
  Gemini implementation) so model/provider is swappable via env var.
- **Stream agent progress** to the UI (SSE or streaming responses) — show each of
  the 7 agents as it starts/finishes.
- **Bundle 2–3 sample microservice repos** (mixed languages) in the project for
  zero-config demos and as the fallback when cloning/quota fails.
- Keep cloning + zip extraction + file scanning **server-side**; respect serverless
  execution-time limits — if a free host caps function duration, chunk the work or
  cap repo size and clearly communicate limits.
- **Validate every agent's JSON output** against a schema; retry once on malformed
  output to stay robust on a free-tier model.
- Persisting results is optional; if used, prefer a **free-tier store**. In-memory
  / per-session is acceptable for a demo.

---

## Build Order (full platform, sequenced to de-risk)

1. **Skeleton + provider layer:** app scaffold, Gemini provider behind an
   interface, env-var config, a "hello agent" round-trip that proves Gemini works.
2. **Input intake:** zip upload, GitHub URL clone (server-side), OpenAPI ingest,
   and bundled sample repos + fallback wiring.
3. **Agents 1–3** (Service Discovery, Dependency Mapping, API Analysis) +
   structured-output validation + live progress streaming.
4. **Agents 4–6** (Database, Migration Strategy, Risk) consuming earlier output.
5. **Diagrams:** current + proposed architecture, rendered in-app.
6. **Agent 7 + report export** (PDF/HTML migration plan + rollback + full report).
7. **Jira backlog generation + export** (simulated, real-shaped).
8. **Polish:** error/quota handling, sample-repo demo mode, README with live demo
   link and screenshots (recruiter-facing).

---

## Verification (how to confirm it works end-to-end)

- **Smoke (sample repo):** Run analysis on a bundled multi-service sample → all 7
  agents complete → inventory, dependency graph, API overlap, DB suggestions,
  target architecture, risks, diagrams, report, and Jira backlog all populate.
- **Real GitHub:** Paste a public multi-service repo URL → it clones, analyzes,
  and produces a report without manual steps.
- **Multi-language:** Verify detection on at least one Spring Boot, one
  Node/Express, and one Python/FastAPI service (the samples should cover this).
- **Overlap detection:** Confirm a known duplicate endpoint across two services is
  flagged by the API Analysis Agent.
- **Streaming:** Confirm each agent's status updates appear live during a run.
- **Failure modes:** Force a bad URL and an exhausted-quota path → app shows a
  clear message and falls back to the sample analysis (never a hard crash).
- **Exports:** Download the report (opens correctly) and export the Jira backlog
  (valid JSON/CSV).
- **Free + hosted:** Confirm the whole flow runs on the free hosting tier with the
  free Gemini key — a recruiter can open the live URL and run a full analysis.

---

## Resume / Demo Framing (so the build stays recruiter-focused)

- README must lead with the **problem** (weeks of manual migration analysis) and
  the **outcome** (automated multi-agent analysis), include a **live demo link**,
  an **architecture diagram of the platform itself**, and **before/after**
  screenshots.
- Emphasize the **hybrid fact-extraction layer (deterministic parse → LLM
  reason)**, **multi-agent orchestration**, **structured-output validation**, and
  **real GitHub ingestion** as the senior-level talking points.
