/* MERGENT APP — Developer Handoff: API & data contracts per screen */
(function () {
  "use strict";
  const VIEWS = (window.VIEWS = window.VIEWS || {});
  const ic = window.IC;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const CONTRACTS = [
    {
      method: "POST", path: "/api/analyses", screens: "New analysis",
      desc: "Kick off a run. Accepts a GitHub URL, an uploaded zip, and/or OpenAPI specs. Returns an analysis id immediately; the heavy work happens in the background and is observed via the stream endpoint.",
      req: `{\n  "source": "github" | "zip" | "openapi",\n  "url":    "https://github.com/acme/commerce-platform",   // when source=github\n  "branch": "main",\n  "uploadId": "tmp_8f2a…",   // when source=zip/openapi (from /api/uploads)\n  "fallbackToSample": true   // if clone/quota fails, run a bundled sample\n}`,
      res: `{ "analysisId": "an_9f3c21", "status": "queued" }`,
    },
    {
      method: "GET", path: "/api/analyses/:id/stream", screens: "Run (live)", sse: true,
      desc: "Server-Sent Events stream of live agent progress — never a frozen spinner. Emit one event per state transition. The UI maps these directly onto the 7 agent rows + console.",
      req: `Accept: text/event-stream`,
      res: `event: run.start
data: { "repo": "acme/commerce-platform", "files": 3174, "quota": { "used": 41, "total": 1500 } }

event: agent.start
data: { "agent": "discovery", "n": 1, "phase": "parse" }

event: agent.progress
data: { "agent": "discovery", "p": 0.62, "log": "scanning build files…" }

event: agent.done
data: { "agent": "discovery", "summary": "11 services · 4 languages", "output": { /* schema below */ } }

event: run.error          // graceful failure → client falls back to sample
data: { "code": "CLONE_TIMEOUT" | "QUOTA_EXHAUSTED", "fallback": "sample" }

event: run.done
data: { "analysisId": "an_9f3c21", "servicesBefore": 11, "servicesAfter": 4 }`,
    },
    {
      method: "GET", path: "/api/analyses/:id", screens: "Overview · all results",
      desc: "The complete analysis object once the run finishes. This is the single source the results screens render from — its shape mirrors window.MERGENT_DATA exactly (see below).",
      req: `—`,
      res: `{\n  "repo": { "name", "url", "branch", "commit", "files", "languages": [...] },\n  "summary": { "servicesBefore", "servicesAfter", "depsBefore", "depsAfter",\n               "dupApis", "endpoints", "dbBefore", "dbAfter",\n               "risksHigh", "risksMed", "risksLow", "cyclesFound", "durationSec" },\n  "services":     [ { "id", "lang", "framework", "port", "files", "loc",\n                      "endpoints", "db", "domain", "target", "confidence" } ],\n  "targets":      [ { "id", "from": [...], "domain", "lang", "db", "endpoints" } ],\n  "dependencies": { "edges": [ { "from", "to", "type", "calls", "cycle?" } ],\n                    "cycles": [ { "id", "path": [...], "severity", "note" } ] },\n  "apiOverlaps":  [ { "id", "verb", "path", "kind", "services", "note", "severity" } ],\n  "databases":    [ { "id", "engine", "owner", "tables", "rows", "target" } ],\n  "dbMerges":     [ { "target", "engine", "from", "conflict", "note", "severity" } ],\n  "migration":    { "rationale", "totalWeeks", "phases": [...] },\n  "risks":        [ { "id", "level", "title", "signal", "impact", "mitigation" } ],\n  "jira":         [ { "key", "title", "epic", "priority", "points", "deps", "status", "desc" } ]\n}`,
    },
    {
      method: "GET", path: "/api/analyses", screens: "Dashboard",
      desc: "Recent analyses for the workspace. Powers the dashboard list and quota tile.",
      req: `?limit=20`,
      res: `{\n  "analyses": [ { "id", "repo", "source", "services", "after", "risksHigh", "when", "status" } ],\n  "quota": { "used": 41, "total": 1500 }\n}`,
    },
    {
      method: "GET", path: "/api/analyses/:id/report", screens: "Report · Export modal",
      desc: "Render the migration report. format=html returns the rich document; format=pdf streams a generated PDF (Agent 7 output).",
      req: `?format=pdf | html`,
      res: `200 · application/pdf  (or text/html)`,
    },
    {
      method: "GET", path: "/api/analyses/:id/jira", screens: "Jira backlog · Export modal",
      desc: "Export the backlog in a Jira-import-friendly shape. Isolated behind an interface so a live Jira REST call can replace the simulation later.",
      req: `?format=json | csv`,
      res: `// json\n[ { "key": "MIG-1", "fields": { "summary", "description",\n     "issuetype": "Task", "priority", "customfield_storypoints": 8,\n     "epic": "Break cycles", "depends_on": [] } } ]\n\n// csv\nKey,Summary,Epic,Priority,Points,Depends On\nMIG-1,Extract shared identity role contract,Break cycles,Highest,8,`,
    },
  ];

  const AGENT_SCHEMA = [
    { id: "discovery", n: 1, parse: "file/AST scan — pom.xml, package.json, requirements.txt, go.mod, Dockerfiles, config ports", reason: "label domain · normalize edge cases" },
    { id: "deps", n: 2, parse: "extract http clients, config URLs, queue topics, env refs → edges · cycle detection", reason: "resolve ambiguous refs · summarize graph" },
    { id: "apis", n: 3, parse: "controllers/routes + OpenAPI → { service, method, path }", reason: "detect exact/semantic/conflicting overlap" },
    { id: "db", n: 4, parse: "configs/ORM/migrations → stores, tables, owner", reason: "suggest consolidation + rationale" },
    { id: "strategy", n: 5, parse: "assemble agents 1–4 into facts bundle", reason: "current → target + ordered steps" },
    { id: "risk", n: 6, parse: "derive signals: shared DB, cycles, dup APIs, statefulness", reason: "classify High/Med/Low + mitigation" },
    { id: "docs", n: 7, parse: "assemble outputs · render report scaffold", reason: "write plan, rollback, exec summary prose" },
  ];

  VIEWS.handoff = {
    title: "Developer handoff",
    render() {
      const cards = CONTRACTS.map((c, i) => `
        <div class="contract" data-co="${i}">
          <div class="co-head">
            <span class="verb ${c.method}">${c.method}</span>
            <span class="co-path">${esc(c.path)}</span>
            ${c.sse ? `<span class="pill reason">SSE</span>` : ""}
            <span class="co-screen">${ic("layers",13)} ${c.screens}</span>
            <span style="margin-left:14px;color:var(--muted)" class="co-chev">${ic("chevronDown",16)}</span>
          </div>
          <div class="co-body" style="display:${i===0?"block":"none"}">
            <div class="desc">${esc(c.desc)}</div>
            <div class="mono" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);margin-bottom:8px">Request</div>
            <div class="code-block" style="margin-bottom:16px">${esc(c.req)}</div>
            <div class="mono" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);margin-bottom:8px">Response</div>
            <div class="code-block">${esc(c.res)}</div>
          </div>
        </div>`).join("");

      const agentRows = AGENT_SCHEMA.map((a) => `
        <tr>
          <td class="mono-cell" style="color:var(--accent)">${a.n}. ${a.id}</td>
          <td><span class="pill parse" style="margin-bottom:4px">parse</span><div class="muted" style="font-size:12.5px;margin-top:4px">${esc(a.parse)}</div></td>
          <td><span class="pill reason" style="margin-bottom:4px">reason</span><div class="muted" style="font-size:12.5px;margin-top:4px">${esc(a.reason)}</div></td>
        </tr>`).join("");

      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">For the backend build</span>
            <div class="head-row"><div><h1>Developer handoff</h1>
            <p class="lead">Every screen in this prototype renders from these contracts. Wire the backend to produce these shapes and the UI lights up unchanged. The full results object mirrors <span class="mono" style="color:var(--accent)">window.MERGENT_DATA</span>.</p></div>
            <button class="btn btn-ghost" data-export="handoff">${ic("download",16)} OpenAPI stub</button></div>
          </div>

          <div class="banner info">
            <span class="bn-ic">${ic("info",18)}</span>
            <div><div class="bn-t">Architectural constraint — hybrid analysis is mandatory</div>
            <div class="bn-s">Never send the whole repo to Gemini. A deterministic parser extracts facts (endpoints, deps, tables, configs); the model only reasons over those facts. Each agent below is split accordingly. Validate every agent's JSON against a schema; retry once on malformed output.</div></div>
          </div>

          <div class="card-head mt24"><span class="ch-ic">${ic("code",17)}</span><h3>HTTP &amp; streaming contracts</h3><span class="ch-meta">${CONTRACTS.length} endpoints</span></div>
          ${cards}

          <div class="card-head mt32"><span class="ch-ic">${ic("sparkles",17)}</span><h3>Agent pipeline — parse vs. reason</h3><span class="ch-meta">7 agents · structured JSON each</span></div>
          <div class="tbl-wrap">
            <table class="tbl"><thead><tr><th class="no-sort" style="width:180px">Agent</th><th class="no-sort">Deterministic (parse)</th><th class="no-sort">LLM (reason)</th></tr></thead>
            <tbody>${agentRows}</tbody></table>
          </div>

          <div class="grid g3 mt24">
            <div class="card"><div class="flex center-y gap12"><span class="ch-ic">${ic("zap",17)}</span><div><div style="font-weight:600">Provider abstraction</div><div class="muted" style="font-size:13px">One interface, Gemini impl. Swap via <span class="mono">LLM_PROVIDER</span> env.</div></div></div></div>
            <div class="card"><div class="flex center-y gap12"><span class="ch-ic">${ic("alert",17)}</span><div><div style="font-weight:600">Graceful degradation</div><div class="muted" style="font-size:13px">Bad URL / quota → <span class="mono">run.error</span> then bundled sample.</div></div></div></div>
            <div class="card"><div class="flex center-y gap12"><span class="ch-ic">${ic("server",17)}</span><div><div style="font-weight:600">No secrets in repo</div><div class="muted" style="font-size:13px">Gemini key &amp; tokens via env vars only.</div></div></div></div>
          </div>
        </div>`;
    },
    mount(root) {
      root.querySelectorAll(".contract .co-head").forEach((h) => h.addEventListener("click", () => {
        const body = h.nextElementSibling;
        const open = body.style.display !== "none";
        body.style.display = open ? "none" : "block";
        h.querySelector(".co-chev").style.transform = open ? "" : "rotate(180deg)";
      }));
      root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport("handoff")));
    },
  };
})();
