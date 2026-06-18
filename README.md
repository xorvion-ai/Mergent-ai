# Mergent AI

[![Open live app](https://img.shields.io/badge/▶%20Open%20live%20app-mergent--ai.vercel.app-2ea043?style=for-the-badge&labelColor=11151c)](https://mergent-ai.vercel.app)

> **Try it:** sign in, paste a GitHub URL or run the bundled sample, and watch a team of AI agents map your services and propose a safe, ordered migration plan — live.

**Automated microservice migration analysis.** Point Mergent at a sprawling
microservice estate — a GitHub URL, a zip, or OpenAPI specs — and a 7-agent AI
pipeline turns *weeks* of manual architecture review into a full consolidation
plan in minutes: service inventory, dependency graph, API-overlap detection,
database-merge plan, a proposed target architecture, a risk register, before/after
diagrams, a downloadable report, and a Jira-ready backlog.

> Built to model the real work of consolidating a microservice platform
> (dependency untangling, shared-DB risk, duplicate-API cleanup, phased cutover).

---

## The interesting part: hybrid parse → reason

Mergent **never dumps your repo into an LLM.** A deterministic parser extracts
hard **facts** first — services, frameworks, ports, endpoints, dependency edges,
database schemas — using tree-walking and language-aware heuristics. Only those
*facts* are handed to **Google Gemini** to reason over (classify overlaps, plan
the target architecture, assess risk, write the report).

```
❌  send entire repo → LLM
✅  parser extracts facts → LLM reasons over facts
```

Why it matters: it stays inside the **free Gemini tier**, scales to large repos,
produces reliable structured output, and degrades gracefully. **With no API key
at all**, a deterministic reasoning engine produces the full analysis — so the
app is *always free and never hard-fails*.

---

## The 7 agents

| # | Agent | Parse (deterministic) | Reason (LLM) |
|---|-------|------------------------|--------------|
| 1 | Service Discovery | frameworks, langs, ports from manifests/Dockerfiles | label each service's domain |
| 2 | Dependency Mapping | HTTP/queue/shared-DB edges + cycle detection | explain & rank cycles |
| 3 | API Analysis | endpoints from Spring / Express / FastAPI / Gin / OpenAPI | detect duplicate & equivalent APIs |
| 4 | Database Analysis | engines + tables from configs/ORM/migrations | propose merges |
| 5 | Migration Strategy | assemble the facts bundle | current → target architecture, phased |
| 6 | Risk Analysis | derive signals (shared DB, cycles, dup APIs, statefulness) | classify High/Med/Low + mitigations |
| 7 | Documentation | render report scaffold + Jira backlog | write the migration narrative |

Progress streams **live** as the run happens — every agent reports as it works, in a single streaming request (serverless-safe).

---

## Tech

- **Backend:** Node.js + Express (ES modules). GitHub **zip-download** ingestion
  (no git binary — runs on serverless), zip upload, OpenAPI specs.
- **LLM:** Google Gemini behind a swappable provider interface, with a
  **deterministic reasoning fallback** so it works free even with no API key.
- **Data:** **Neon Postgres** in production (users + analyses), in-memory locally.
- **Accounts:** sign-in tracking + an **owner-only admin console** to manage
  users (disable / delete), with **demo-data gating** for non-owner accounts.
- **Frontend:** vanilla-JS SPA (hash router, live streaming run, before/after
  diagrams, report + Jira export).
- **Deploy:** Vercel + Neon — **no paid services required.**

## Run locally

```bash
npm install
npm start            # → http://localhost:3000
```

Optional — enable Gemini reasoning (works free without it):

```bash
cp .env.example .env        # add GEMINI_API_KEY  (https://aistudio.google.com/apikey)
```

Then open the app → **New analysis → Try a sample** for an instant end-to-end run
on the bundled 8-service, 4-language `commerce-platform` (a 3-service auth cycle,
shared user/billing tables, duplicate login + user APIs).

## API

```
POST /api/analyses              start (github url | zip | openapi | sample)
GET  /api/analyses              recent analyses
GET  /api/analyses/:id          full analysis object
GET  /api/analyses/:id/stream   SSE live agent progress
GET  /api/analyses/:id/report   migration report (html | text)
GET  /api/analyses/:id/jira     backlog (json | csv)
```

---

## 🏢 About Xorvion

**Xorvion** is an independent AI studio created by [Sumit Kumar](https://linkedin.com/in/sumit-kumar2812), based in Noida, India. Xorvion designs, builds, and ships AI products end-to-end — from multi-agent orchestration and live/demo architecture to auth, persistence, realtime, and the design system. **Mergent AI** is one of its flagship builds.

- 🌐 Website: [xorvion-ai.vercel.app](https://xorvion-ai.vercel.app)
- 🔗 LinkedIn: [linkedin.com/company/xorvion](https://linkedin.com/company/xorvion)
- 🐙 GitHub: [github.com/xorvion-ai](https://github.com/xorvion-ai)
- ✉️ Email: [xorvion.ai@gmail.com](mailto:xorvion.ai@gmail.com)

### 👤 Creator — Sumit Kumar

AI Engineer based in Noida, India, who takes AI products from idea to production.

- 💼 LinkedIn: [linkedin.com/in/sumit-kumar2812](https://linkedin.com/in/sumit-kumar2812)
- 🌐 Portfolio: [sumitkr28.vercel.app](https://sumitkr28.vercel.app)
- 🐙 GitHub: [github.com/Sumitkr28](https://github.com/Sumitkr28)
