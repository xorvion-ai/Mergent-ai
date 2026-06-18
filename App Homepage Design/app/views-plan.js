/* MERGENT APP — plan views: Migration · Risks · Architecture · Jira · Report */
(function () {
  "use strict";
  const VIEWS = (window.VIEWS = window.VIEWS || {});
  const ic = window.IC;
  const D = () => window.MERGENT_DATA;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  /* ============ MIGRATION STRATEGY ============ */
  VIEWS.migration = {
    title: "Migration plan",
    render() {
      const m = D().migration;
      const phases = m.phases.map((p) => `
        <div class="phase">
          <span class="pn">${p.n}</span>
          <div class="ph-head"><h3>${esc(p.title)}</h3><span class="sev ${p.risk}">${p.risk==="med"?"medium":p.risk} risk</span><span class="ph-meta">${ic("clock",12)} ${p.weeks} weeks</span></div>
          <div class="ph-steps">${p.steps.map((s)=>`<div class="st"><span class="sd"></span><span>${esc(s)}</span></div>`).join("")}</div>
          <div class="ph-svcs">${p.services.map((s)=>`<span class="pill">${esc(s)}</span>`).join("")}</div>
        </div>`).join("");
      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">Agent 5 · Migration Strategy</span>
            <div class="head-row"><div><h1>Migration plan</h1>
            <p class="lead">${esc(m.rationale)}</p></div>
            <button class="btn btn-primary" data-export="report">${ic("download",16)} Export report</button></div>
          </div>
          <div class="grid g4" style="margin-bottom:30px">
            <div class="stat"><div class="k">phases</div><div class="v">${m.phases.length}</div></div>
            <div class="stat accent"><div class="k">end state</div><div class="v" style="font-size:30px;margin-top:14px">11→4</div></div>
            <div class="stat"><div class="k">est. timeline</div><div class="v" style="font-size:28px;margin-top:16px">${m.totalWeeks}<span style="font-size:15px;color:var(--muted)"> wk</span></div></div>
            <div class="stat warm"><div class="k">cycles to break first</div><div class="v">2</div><div class="delta warm">${ic("cycle",13)} phase 1 blocker</div></div>
          </div>
          <div class="card" style="padding:30px 34px">${phases}</div>
        </div>`;
    },
    mount(root) { root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport(b.dataset.export))); },
  };

  /* ============ RISKS ============ */
  VIEWS.risks = {
    title: "Risk report",
    render() {
      const s = D().summary;
      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">Agent 6 · Risk Analysis</span>
            <div class="head-row"><div><h1>Risk report</h1>
            <p class="lead">Risk signals are derived deterministically from the earlier agents — shared databases, cycles, duplicate APIs, statefulness — then classified by the model with impact and mitigation.</p></div>
            <button class="btn btn-ghost" data-export="risks">${ic("download",16)} Export JSON</button></div>
          </div>
          <div class="grid g3">
            <div class="stat" style="border-left:3px solid oklch(0.66 0.19 20)"><div class="k">high</div><div class="v" style="color:oklch(0.66 0.19 20)">${s.risksHigh}</div><div class="delta warm">block the merge</div></div>
            <div class="stat" style="border-left:3px solid var(--warm)"><div class="k">medium</div><div class="v" style="color:var(--warm)">${s.risksMed}</div><div class="delta warm">handle in-phase</div></div>
            <div class="stat" style="border-left:3px solid oklch(0.72 0.1 200)"><div class="k">low</div><div class="v" style="color:oklch(0.72 0.1 200)">${s.risksLow}</div><div class="delta good">monitor</div></div>
          </div>
          <div class="toolbar mt24">
            <div class="chip-filter" id="rkFilter">
              <button class="on" data-lv="all">All</button><button data-lv="high">High</button><button data-lv="med">Medium</button><button data-lv="low">Low</button>
            </div>
            <span class="spacer"></span><span class="mono muted" id="rkCount" style="font-size:12.5px"></span>
          </div>
          <div class="grid g2" id="rkGrid"></div>
        </div>`;
    },
    mount(root) {
      const grid = root.querySelector("#rkGrid");
      let lv = "all";
      function rows() {
        const list = D().risks.filter((r) => lv === "all" || r.level === lv);
        grid.innerHTML = list.map((r) => `
          <div class="risk-card ${r.level}">
            <div class="rc-head"><span class="rc-id">${r.id}</span><span class="sev ${r.level}" style="margin-left:auto">${r.level==="med"?"medium":r.level}</span></div>
            <h3>${esc(r.title)}</h3>
            <div class="mono" style="font-size:11.5px;color:var(--faint);margin-top:6px">signal · ${esc(r.signal)}</div>
            <div class="rc-sec"><div class="lbl">Impact</div><p>${esc(r.impact)}</p></div>
            <div class="rc-sec mit"><div class="lbl">Mitigation</div><p>${esc(r.mitigation)}</p></div>
          </div>`).join("");
        root.querySelector("#rkCount").textContent = list.length + " of " + D().risks.length;
      }
      root.querySelectorAll("#rkFilter button").forEach((b) => b.addEventListener("click", () => {
        root.querySelectorAll("#rkFilter button").forEach((x) => x.classList.remove("on")); b.classList.add("on");
        lv = b.dataset.lv; rows();
      }));
      root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport(b.dataset.export)));
      rows();
    },
  };

  /* ============ ARCHITECTURE (centerpiece before/after) ============ */
  VIEWS.architecture = {
    title: "Architecture",
    render() {
      const s = D().summary;
      return `
        <div class="view-inner wide view-fade">
          <div class="page-head"><span class="eyebrow">The centerpiece</span>
            <div class="head-row"><div><h1>Current → target architecture</h1>
            <p class="lead">The whole point, in one view: 11 tangled services with 2 cycles and shared databases become 4 clean domain services behind a thin ingress. Toggle to compare.</p></div>
            <div class="seg-ctrl" data-ba><button class="on warm" data-mode="before">Before · current</button><button data-mode="after">After · proposed</button></div>
            </div>
          </div>
          <div class="card" style="padding:18px">
            <div class="diagram-stage" id="archDiagram"></div>
            <div class="diagram-legend" id="archLegend"></div>
          </div>
          <div class="grid g4 mt24" id="archReadout"></div>
        </div>`;
    },
    mount(root) {
      const stage = root.querySelector("#archDiagram");
      const legend = root.querySelector("#archLegend");
      const readout = root.querySelector("#archReadout");
      const s = D().summary;
      function ro(mode) {
        const data = mode === "before"
          ? [["services", s.servicesBefore, "warm"], ["dependencies", s.depsBefore, "warm"], ["duplicate APIs", s.dupApis, "warm"], ["databases", s.dbBefore, "warm"]]
          : [["services", s.servicesAfter, "accent"], ["dependencies", s.depsAfter, "accent"], ["duplicate APIs", 0, "accent"], ["databases", s.dbAfter, "accent"]];
        readout.innerHTML = data.map(([k, v, c]) => `<div class="stat ${c}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
      }
      function draw(mode) {
        window.MERGENT_DIAGRAM.render(stage, window.MERGENT_DIAGRAM.archSpec(mode), { onNode: (id) => window.APP.openServiceDrawer(id) });
        legend.innerHTML = mode === "before"
          ? `<span class="k"><span class="ln" style="border-color:var(--border-2)"></span> http</span><span class="k"><span class="ln" style="border-color:var(--border-2);border-top-style:dashed"></span> queue</span><span class="k"><span class="ln" style="border-color:oklch(0.66 0.19 20);border-top-style:dashed"></span> cycle</span><span class="k"><span class="ln" style="border-color:var(--warm);border-top-style:dashed"></span> shared db</span>`
          : `<span class="k"><span class="ln" style="border-color:var(--accent)"></span> clean dependency</span><span class="k">${ic("checkCircle",13)} 0 cycles · 0 duplicate APIs · 3 databases</span>`;
        ro(mode);
      }
      draw("before");
      root.querySelectorAll("[data-ba] button").forEach((b) => b.addEventListener("click", () => {
        root.querySelectorAll("[data-ba] button").forEach((x) => { x.classList.remove("on", "warm"); });
        b.classList.add("on"); if (b.dataset.mode === "before") b.classList.add("warm");
        draw(b.dataset.mode);
      }));
    },
  };

  /* ============ JIRA BACKLOG ============ */
  VIEWS.jira = {
    title: "Jira backlog",
    render() {
      const epics = [...new Set(D().jira.map((t) => t.epic))];
      const cols = epics.map((e) => {
        const tasks = D().jira.filter((t) => t.epic === e);
        return `<div class="kan-col"><div class="kc-head"><span style="color:var(--accent)">${ic("folder",13)}</span> ${esc(e)} <span class="ct">${tasks.length}</span></div>
          ${tasks.map((t)=>`<div class="kan-card" data-task="${t.key}">
            <div class="kk">${t.key}</div><div class="kt">${esc(t.title)}</div>
            <div class="kf"><span class="prio ${t.priority}">${t.priority}</span><span class="pts">${t.points} pts</span>${t.deps.length?`<span class="mono muted" style="font-size:10.5px">↳ ${t.deps.length} dep${t.deps.length>1?"s":""}</span>`:""}</div>
          </div>`).join("")}</div>`;
      }).join("");
      const pts = D().jira.reduce((a, t) => a + t.points, 0);
      return `
        <div class="view-inner wide view-fade">
          <div class="page-head"><span class="eyebrow">Agent 7 · Documentation</span>
            <div class="head-row"><div><h1>Jira-ready backlog</h1>
            <p class="lead">The migration plan rendered as an importable backlog — each task carries an epic, priority, story points and dependencies. Export as JSON or CSV, or copy to clipboard.</p></div>
            <button class="btn btn-primary" data-export="jira">${ic("download",16)} Export backlog</button></div>
          </div>
          <div class="grid g4" style="margin-bottom:24px">
            <div class="stat"><div class="k">tasks</div><div class="v">${D().jira.length}</div></div>
            <div class="stat"><div class="k">epics</div><div class="v">${epics.length}</div></div>
            <div class="stat accent"><div class="k">story points</div><div class="v">${pts}</div></div>
            <div class="stat warm"><div class="k">highest priority</div><div class="v">${D().jira.filter(t=>t.priority==="Highest").length}</div><div class="delta warm">${ic("bolt",13)} cycle-breakers first</div></div>
          </div>
          <div class="kanban">${cols}</div>
        </div>`;
    },
    mount(root) {
      root.querySelectorAll("[data-task]").forEach((c) => c.addEventListener("click", () => {
        const t = D().jira.find((x) => x.key === c.dataset.task);
        window.APP.openDrawer(`
          <div class="kk mono" style="color:var(--accent);font-size:13px">${t.key}</div>
          <h3 style="font-size:20px;margin-top:8px">${esc(t.title)}</h3>
          <div class="flex gap8 mt16"><span class="prio ${t.priority}">${t.priority}</span><span class="pts">${t.points} pts</span><span class="pill">${esc(t.epic)}</span></div>
          <h4>Description</h4><p class="muted" style="font-size:14px;line-height:1.6">${esc(t.desc)}</p>
          <h4>Dependencies</h4>${t.deps.length?t.deps.map((d)=>`<div class="ep"><span class="mono" style="color:var(--accent)">${d}</span></div>`).join(""):`<p class="muted" style="font-size:13.5px">None — ready to start.</p>`}
          <h4>Status</h4><div class="ep"><span class="pill">${t.status}</span></div>
        `, "Task");
      }));
      root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport(b.dataset.export)));
    },
  };

  /* ============ REPORT ============ */
  VIEWS.report = {
    title: "Report",
    render() {
      const s = D().summary;
      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">Agent 7 · Documentation</span>
            <div class="head-row"><div><h1>Migration report</h1>
            <p class="lead">The full narrative — executive summary, findings, target architecture, sequencing and rollback — assembled deterministically and written by the model.</p></div>
            <div class="flex gap12"><button class="btn btn-ghost" data-export="report">${ic("download",16)} PDF / HTML</button></div></div>
          </div>
          <div class="report-doc">
            <div class="r-eyebrow">Mergent migration analysis</div>
            <h1>acme/commerce-platform</h1>
            <div class="r-meta"><span>${ic("github",13)} github.com/acme/commerce-platform</span><span>${ic("branch",13)} main @ a3f9c21</span><span>${ic("clock",13)} generated in ${s.durationSec}s</span><span>14 Jira tasks</span></div>

            <h2><span class="num">01</span> Executive summary</h2>
            <p>The platform comprises <b style="color:var(--text)">11 microservices</b> across Java, TypeScript, Python and Go. Analysis found significant accidental coupling — two circular dependencies, three services sharing a <span class="mono">users</span> representation, ${s.dupApis} duplicate or semantically-equivalent endpoints, and ${s.dbBefore} independent datastores.</p>
            <p>We propose consolidating to <b style="color:var(--accent)">4 domain-aligned services</b> behind a thin ingress, collapsing ${s.dbBefore} datastores to ${s.dbAfter}. The work is sequenced over ${D().migration.totalWeeks} weeks across 6 phases, beginning with breaking the two cycles that otherwise block independent deployment.</p>
            <div class="r-callout"><p style="margin:0"><b style="color:var(--accent)">Headline:</b> 11 → 4 services · 28 → 6 dependencies · ${s.dupApis} → 0 duplicate APIs · ${s.dbBefore} → ${s.dbAfter} databases.</p></div>

            <h2><span class="num">02</span> Target architecture</h2>
            <p>Services are grouped by domain ownership:</p>
            <ul>${D().targets.map((t)=>`<li><b class="mono" style="color:var(--accent)">${t.id}</b> — ${esc(t.domain)} <span class="muted">(${t.from.map(f=>f.replace("-service","")).join(", ")})</span></li>`).join("")}</ul>

            <h2><span class="num">03</span> Sequencing</h2>
            <p>${esc(D().migration.rationale)}</p>
            <ul>${D().migration.phases.map((p)=>`<li><b style="color:var(--text)">Phase ${p.n}: ${esc(p.title)}</b> — ${p.weeks} weeks, ${p.risk==="med"?"medium":p.risk} risk.</li>`).join("")}</ul>

            <h2><span class="num">04</span> Rollback strategy</h2>
            <p>Each phase is independently revertible. Database merges run dual-write behind a feature flag with the legacy store as source of truth until validation passes; gateway route cutovers are reversible at the ingress with <span class="mono">/v1</span> version pins. No phase begins until the previous phase's re-run shows the targeted cycles and duplicates eliminated.</p>

            <h2><span class="num">05</span> Top risks</h2>
            <ul>${D().risks.filter(r=>r.level==="high").map((r)=>`<li><b style="color:oklch(0.66 0.19 20)">${r.id}</b> ${esc(r.title)} — <span class="muted">${esc(r.mitigation)}</span></li>`).join("")}</ul>
          </div>
        </div>`;
    },
    mount(root) { root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport(b.dataset.export))); },
  };
})();
