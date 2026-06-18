/* MERGENT APP — results views: Overview · Services · Dependencies · API Overlap · Databases */
(function () {
  "use strict";
  const VIEWS = (window.VIEWS = window.VIEWS || {});
  const ic = window.IC;
  const D = () => window.MERGENT_DATA;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const langDot = (l) => `<span class="lang"><span class="ld ${l.replace(/[^A-Za-z]/g,"")}"></span>${l}</span>`;

  /* ============ OVERVIEW ============ */
  VIEWS.overview = {
    title: "Overview",
    render() {
      const s = D().summary;
      const targets = D().targets.map((t) => `
        <div class="card" style="padding:18px">
          <div class="flex center-y gap8" style="margin-bottom:10px"><span class="dg-dot" style="width:9px;height:9px;border-radius:50%;background:var(--accent);display:inline-block"></span><span class="mono" style="font-weight:600;color:var(--accent)">${esc(t.id)}</span></div>
          <div class="muted" style="font-size:13px">${esc(t.domain)}</div>
          <div class="flex gap8 wrap-flex" style="margin-top:12px">${t.from.map((f)=>`<span class="pill">${esc(f.replace("-service",""))}</span>`).join("")}</div>
        </div>`).join("");
      return `
        <div class="view-inner view-fade">
          <div class="page-head">
            <span class="eyebrow">Analysis complete</span>
            <div class="head-row">
              <div><h1>acme/commerce-platform</h1>
              <p class="lead">11 microservices across 4 languages, consolidated into 4 domain services and a thin ingress. Analysis finished in ${s.durationSec}s.</p></div>
              <button class="btn btn-primary" data-export="report">${ic("download",16)} Export report</button>
            </div>
          </div>

          <div class="grid g4">
            <div class="stat"><div class="k">services</div><div class="vrow"><span class="from">${s.servicesBefore}</span><span class="arr">${ic("arrowRight",16)}</span><span class="to">${s.servicesAfter}</span></div></div>
            <div class="stat"><div class="k">dependencies</div><div class="vrow"><span class="from">${s.depsBefore}</span><span class="arr">${ic("arrowRight",16)}</span><span class="to">${s.depsAfter}</span></div></div>
            <div class="stat"><div class="k">duplicate APIs</div><div class="vrow"><span class="from">${s.dupApis}</span><span class="arr">${ic("arrowRight",16)}</span><span class="to">0</span></div></div>
            <div class="stat"><div class="k">databases</div><div class="vrow"><span class="from">${s.dbBefore}</span><span class="arr">${ic("arrowRight",16)}</span><span class="to">${s.dbAfter}</span></div></div>
          </div>

          <div class="grid g2 mt24" style="grid-template-columns:1.25fr 1fr">
            <div class="card">
              <div class="card-head"><span class="ch-ic">${ic("diagram",17)}</span><h3>Architecture</h3>
                <div class="seg-ctrl" style="margin-left:auto" data-ba>
                  <button class="on warm" data-mode="before">Before</button>
                  <button data-mode="after">After</button>
                </div></div>
              <div class="diagram-stage" id="ovDiagram"></div>
              <div class="diagram-legend" id="ovLegend"></div>
            </div>
            <div class="card">
              <div class="card-head"><span class="ch-ic">${ic("alert",17)}</span><h3>Key findings</h3></div>
              <div class="grid" style="gap:10px">
                <div class="flex gap12 center-y"><span class="sev high">${s.risksHigh} high</span><span class="muted" style="font-size:13.5px">shared user tables, 2 circular deps, a stateful payment service</span></div>
                <div class="flex gap12 center-y"><span class="sev med">${s.dupApis} dup APIs</span><span class="muted" style="font-size:13.5px">duplicate <span class="mono">/login</span> &amp; semantically-equal <span class="mono">/users</span></span></div>
                <div class="flex gap12 center-y"><span class="sev med">${s.cyclesFound} cycles</span><span class="muted" style="font-size:13.5px">auth→profile→admin and notify↔email</span></div>
              </div>
              <h4 class="mono" style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);margin:20px 0 12px">Target services</h4>
              <div class="grid" style="gap:10px">${targets}</div>
              <button class="btn btn-ghost btn-block mt16" data-go="migration">${ic("map",16)} See the migration plan</button>
            </div>
          </div>

          <div class="grid g3 mt24">
            ${navCard("services","layers","Service inventory",`${s.servicesBefore} services · 4 languages`)}
            ${navCard("dependencies","branch","Dependency graph",`${s.depsBefore} edges · ${s.cyclesFound} cycles`)}
            ${navCard("apis","route","API overlap",`${s.endpoints} endpoints · ${s.dupApis} dup`)}
            ${navCard("databases","database","Databases",`${s.dbBefore} stores · 3 mergeable`)}
            ${navCard("risks","alert","Risk report",`${s.risksHigh} high · ${s.risksMed} medium`)}
            ${navCard("jira","kanban","Jira backlog",`${D().jira.length} tasks ready`)}
          </div>
        </div>`;
    },
    mount(root) {
      const stage = root.querySelector("#ovDiagram");
      const legend = root.querySelector("#ovLegend");
      function draw(mode) {
        window.MERGENT_DIAGRAM.render(stage, window.MERGENT_DIAGRAM.archSpec(mode), { onNode: (id) => window.APP.openServiceDrawer(id) });
        legend.innerHTML = mode === "before"
          ? `<span class="k"><span class="ln" style="border-color:var(--border-2)"></span> http call</span><span class="k"><span class="ln" style="border-color:var(--border-2);border-top-style:dashed"></span> queue</span><span class="k"><span class="ln" style="border-color:oklch(0.66 0.19 20);border-top-style:dashed"></span> circular dep</span><span class="k"><span class="ln" style="border-color:var(--warm);border-top-style:dashed"></span> shared db</span>`
          : `<span class="k"><span class="ln" style="border-color:var(--accent)"></span> clean dependency</span><span class="k">${ic("checkCircle",13)} 0 cycles · 0 duplicate APIs</span>`;
      }
      draw("before");
      root.querySelectorAll("[data-ba] button").forEach((b) => b.addEventListener("click", () => {
        root.querySelectorAll("[data-ba] button").forEach((x) => { x.classList.remove("on","warm"); });
        b.classList.add("on"); if (b.dataset.mode === "before") b.classList.add("warm");
        draw(b.dataset.mode);
      }));
      root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => window.APP.go(b.dataset.go)));
      root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport(b.dataset.export)));
    },
  };
  function navCard(go, icon, title, meta) {
    return `<div class="card" style="cursor:pointer;transition:box-shadow .2s,transform .15s" data-go="${go}" onmouseover="this.style.boxShadow='inset 0 0 0 1px var(--accent)'" onmouseout="this.style.boxShadow='inset 0 0 0 1px var(--border)'">
      <div class="flex center-y gap12"><span class="ch-ic">${ic(icon,17)}</span><div><div style="font-weight:600;font-size:15px">${title}</div><div class="muted mono" style="font-size:12.5px;margin-top:2px">${meta}</div></div><span style="margin-left:auto;color:var(--muted)">${ic("arrowRight",16)}</span></div>
    </div>`;
  }

  /* ============ SERVICES ============ */
  VIEWS.services = {
    title: "Service inventory",
    render() {
      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">Agent 1 · Service Discovery</span>
            <div class="head-row"><div><h1>Service inventory</h1>
            <p class="lead">Detected from build files, Dockerfiles &amp; configs — framework, language and port are parsed deterministically; the domain label is the model's call.</p></div>
            <button class="btn btn-ghost" data-export="services">${ic("download",16)} Export JSON</button></div>
          </div>
          <div class="toolbar">
            <div class="search">${ic("search",16)}<input class="input" id="svcSearch" placeholder="Filter services…" /></div>
            <div class="chip-filter" id="langFilter">
              <button class="on" data-lang="all">All</button>
              <button data-lang="Java">Java</button>
              <button data-lang="TypeScript">TypeScript</button>
              <button data-lang="Python">Python</button>
              <button data-lang="Go">Go</button>
            </div>
            <span class="spacer"></span>
            <span class="mono muted" id="svcCount" style="font-size:12.5px"></span>
          </div>
          <div class="tbl-wrap">
            <table class="tbl" id="svcTable">
              <thead><tr>
                <th data-sort="id" class="sorted">Service <span class="so">▼</span></th>
                <th data-sort="lang">Language <span class="so">▼</span></th>
                <th data-sort="framework">Framework <span class="so">▼</span></th>
                <th data-sort="port">Port <span class="so">▼</span></th>
                <th data-sort="endpoints">APIs <span class="so">▼</span></th>
                <th data-sort="loc">LOC <span class="so">▼</span></th>
                <th class="no-sort">Domain (inferred)</th>
                <th data-sort="target">Consolidates into <span class="so">▼</span></th>
              </tr></thead>
              <tbody></tbody>
            </table>
            <div class="tbl-foot"><span id="svcFoot"></span><span>click a row for endpoints &amp; detail</span></div>
          </div>
        </div>`;
    },
    mount(root) {
      const tbody = root.querySelector("#svcTable tbody");
      const state = { q: "", lang: "all", sort: "id", dir: 1 };
      function rows() {
        let list = D().services.filter((s) =>
          (state.lang === "all" || s.lang === state.lang) &&
          (s.id.includes(state.q) || s.domain.toLowerCase().includes(state.q) || s.target.includes(state.q)));
        list.sort((a, b) => {
          let va = a[state.sort], vb = b[state.sort];
          if (typeof va === "string") return va.localeCompare(vb) * state.dir;
          return (va - vb) * state.dir;
        });
        tbody.innerHTML = list.map((s) => `
          <tr class="clickable" data-svc="${s.id}">
            <td><span class="svc-name">${ic("server",15)} ${s.id}</span></td>
            <td>${langDot(s.lang)}</td>
            <td class="muted">${s.framework}</td>
            <td class="mono-cell">${s.port}</td>
            <td class="mono-cell">${s.endpoints}</td>
            <td class="mono-cell">${s.loc.toLocaleString()}</td>
            <td class="muted" style="font-size:13px">${esc(s.domain)}</td>
            <td><span class="tag-merge">${ic("merge",12)} ${s.target}</span></td>
          </tr>`).join("");
        root.querySelector("#svcCount").textContent = list.length + " of " + D().services.length;
        root.querySelector("#svcFoot").textContent = list.length + " services · " + new Set(list.map(x=>x.target)).size + " target groups";
        tbody.querySelectorAll("[data-svc]").forEach((tr) => tr.addEventListener("click", () => window.APP.openServiceDrawer(tr.dataset.svc)));
      }
      root.querySelector("#svcSearch").addEventListener("input", (e) => { state.q = e.target.value.toLowerCase(); rows(); });
      root.querySelectorAll("#langFilter button").forEach((b) => b.addEventListener("click", () => {
        root.querySelectorAll("#langFilter button").forEach((x) => x.classList.remove("on")); b.classList.add("on");
        state.lang = b.dataset.lang; rows();
      }));
      root.querySelectorAll("#svcTable th[data-sort]").forEach((th) => th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (state.sort === key) state.dir *= -1; else { state.sort = key; state.dir = 1; }
        root.querySelectorAll("#svcTable th").forEach((x) => x.classList.remove("sorted"));
        th.classList.add("sorted");
        th.querySelector(".so").textContent = state.dir === 1 ? "▼" : "▲";
        rows();
      }));
      root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport(b.dataset.export)));
      rows();
    },
  };

  /* ============ DEPENDENCIES ============ */
  VIEWS.dependencies = {
    title: "Dependency graph",
    render() {
      const cycles = D().dependencies.cycles.map((c) => `
        <div class="risk-card high" style="border-left-color:oklch(0.66 0.19 20)">
          <div class="rc-head"><span class="ch-ic" style="background:oklch(0.66 0.19 20 / .12);color:oklch(0.66 0.19 20)">${ic("cycle",17)}</span>
            <div><div class="rc-id">CYCLE-${c.id} · ${c.severity}</div><div class="mono" style="font-weight:600;margin-top:3px">${c.path.join(" → ")}</div></div></div>
          <p class="muted" style="font-size:13.5px;margin-top:12px">${esc(c.note)}</p>
        </div>`).join("");
      return `
        <div class="view-inner wide view-fade">
          <div class="page-head"><span class="eyebrow">Agent 2 · Dependency Mapping</span>
            <div class="head-row"><div><h1>Dependency graph</h1>
            <p class="lead">HTTP calls, queue topics and shared-DB couplings extracted into ${D().dependencies.edges.length} edges. Cycle detection is deterministic; the model resolves ambiguous references. Hover a node to trace its connections.</p></div>
            <button class="btn btn-ghost" data-export="dependencies">${ic("download",16)} Export JSON</button></div>
          </div>
          <div class="card">
            <div class="diagram-stage" id="depDiagram"></div>
            <div class="diagram-legend">
              <span class="k"><span class="ln" style="border-color:var(--border-2)"></span> http call</span>
              <span class="k"><span class="ln" style="border-color:var(--border-2);border-top-style:dashed"></span> queue / async</span>
              <span class="k"><span class="ln" style="border-color:oklch(0.66 0.19 20);border-top-style:dashed"></span> circular dependency</span>
              <span class="k"><span class="ln" style="border-color:var(--warm);border-top-style:dashed"></span> shared database</span>
            </div>
          </div>
          <h2 style="font-size:20px;margin:30px 0 16px;display:flex;align-items:center;gap:10px">${ic("cycle",18)} Circular dependencies <span class="sev high">${D().dependencies.cycles.length} found</span></h2>
          <div class="grid g2">${cycles}</div>
        </div>`;
    },
    mount(root) {
      window.MERGENT_DIAGRAM.render(root.querySelector("#depDiagram"), window.MERGENT_DIAGRAM.depSpec(), { onNode: (id) => window.APP.openServiceDrawer(id) });
      root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport(b.dataset.export)));
    },
  };

  /* ============ API OVERLAP ============ */
  VIEWS.apis = {
    title: "API overlap",
    render() {
      const st = D().apiStats;
      const verbBars = Object.entries(st.byVerb).map(([v, n]) => `
        <div class="flex center-y gap12" style="margin-bottom:8px"><span class="verb ${v}" style="width:62px;text-align:center">${v}</span>
        <div style="flex:1;height:8px;border-radius:8px;background:var(--bg-3);overflow:hidden"><i style="display:block;height:100%;width:${(n/st.total*100).toFixed(0)}%;background:var(--accent)"></i></div>
        <span class="mono muted" style="font-size:12.5px;width:30px;text-align:right">${n}</span></div>`).join("");
      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">Agent 3 · API Analysis</span>
            <div class="head-row"><div><h1>API overlap</h1>
            <p class="lead">Every endpoint normalized to <span class="mono">{ service, method, path }</span>, then checked for exact, semantic and conflicting duplication across services.</p></div>
            <button class="btn btn-ghost" data-export="apis">${ic("download",16)} Export JSON</button></div>
          </div>
          <div class="grid g3" style="grid-template-columns:1fr 1fr 1.3fr">
            <div class="stat"><div class="k">total endpoints</div><div class="v">${st.total}</div><div class="delta good">${ic("check",13)} ${st.clean} unique</div></div>
            <div class="stat warm"><div class="k">overlap findings</div><div class="v">${D().apiOverlaps.length}</div><div class="delta warm">${ic("alert",13)} ${st.duplicates} duplicate routes</div></div>
            <div class="card"><div class="mono muted" style="font-size:12px;margin-bottom:14px">BY METHOD</div>${verbBars}</div>
          </div>
          <div class="toolbar mt24">
            <div class="chip-filter" id="ovFilter">
              <button class="on" data-sev="all">All findings</button>
              <button data-sev="high">High</button>
              <button data-sev="med">Medium</button>
              <button data-sev="low">Low</button>
            </div>
          </div>
          <div class="tbl-wrap">
            <table class="tbl"><thead><tr>
              <th class="no-sort" style="width:60px">#</th><th class="no-sort">Verb</th><th class="no-sort">Endpoints</th><th class="no-sort">Kind</th><th class="no-sort">Services</th><th class="no-sort">Severity</th>
            </tr></thead><tbody id="ovBody"></tbody></table>
            <div class="tbl-foot"><span id="ovFoot"></span><span>${st.duplicates} duplicate endpoints across ${D().apiOverlaps.length} groups</span></div>
          </div>
        </div>`;
    },
    mount(root) {
      const body = root.querySelector("#ovBody");
      let sev = "all";
      function rows() {
        const list = D().apiOverlaps.filter((o) => sev === "all" || o.severity === sev);
        body.innerHTML = list.map((o) => `
          <tr>
            <td class="mono-cell muted">${o.id}</td>
            <td><span class="verb ${o.verb}">${o.verb}</span></td>
            <td class="mono-cell" style="color:var(--text)">${esc(o.path)}<div class="muted" style="font-size:12px;margin-top:4px;font-family:var(--font-body)">${esc(o.note)}</div></td>
            <td><span class="muted" style="font-size:13px">${o.kind}</span></td>
            <td>${o.services.map((s)=>`<span class="pill" style="margin:2px 2px 2px 0">${esc(s.replace("-service",""))}</span>`).join("")}</td>
            <td><span class="sev ${o.severity}">${o.severity==="med"?"medium":o.severity}</span></td>
          </tr>`).join("");
        root.querySelector("#ovFoot").textContent = list.length + " findings";
      }
      root.querySelectorAll("#ovFilter button").forEach((b) => b.addEventListener("click", () => {
        root.querySelectorAll("#ovFilter button").forEach((x) => x.classList.remove("on")); b.classList.add("on");
        sev = b.dataset.sev; rows();
      }));
      root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport(b.dataset.export)));
      rows();
    },
  };

  /* ============ DATABASES ============ */
  VIEWS.databases = {
    title: "Databases",
    render() {
      const stores = D().databases.map((d) => `
        <tr>
          <td><span class="svc-name">${ic("database",15)} ${d.id}</span></td>
          <td><span class="pill">${d.engine}</span></td>
          <td class="muted mono-cell" style="font-size:12px">${esc(d.owner)}</td>
          <td class="mono-cell">${d.tables.length}</td>
          <td class="mono-cell muted">${d.rows}</td>
          <td><span class="tag-merge">${ic("merge",12)} ${d.target}</span></td>
        </tr>`).join("");
      const merges = D().dbMerges.map((m) => `
        <div class="card">
          <div class="flex center-y gap12"><span class="ch-ic">${ic("database",17)}</span>
            <div><div class="mono" style="font-weight:600;color:var(--accent)">${m.target}</div><div class="muted mono" style="font-size:12px">${m.engine}</div></div>
            <span class="sev ${m.severity}" style="margin-left:auto">${m.severity==="med"?"medium":m.severity} effort</span></div>
          <div class="flex gap8 wrap-flex" style="margin:14px 0">${m.from.map((f)=>`<span class="pill">${f}</span>`).join(" <span class='muted'>+</span> ")}</div>
          <p class="muted" style="font-size:13.5px">${esc(m.note)}</p>
          ${m.conflict !== "none" ? `<div class="mono" style="font-size:12px;color:var(--warm);margin-top:10px">${ic("alert",12)} conflict: ${m.conflict}</div>` : ""}
        </div>`).join("");
      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">Agent 4 · Database Analysis</span>
            <div class="head-row"><div><h1>Database consolidation</h1>
            <p class="lead">Datastores detected from configs, ORM models &amp; migrations. The model proposes merges where tables and ownership overlap — ${D().summary.dbBefore} stores collapse to ${D().summary.dbAfter}.</p></div>
            <button class="btn btn-ghost" data-export="databases">${ic("download",16)} Export JSON</button></div>
          </div>
          <div class="grid g3">
            <div class="stat"><div class="k">datastores</div><div class="vrow"><span class="from">${D().summary.dbBefore}</span><span class="arr">${ic("arrowRight",16)}</span><span class="to">${D().summary.dbAfter}</span></div></div>
            <div class="stat"><div class="k">engines</div><div class="v" style="font-size:26px;margin-top:16px">MySQL · PG<div class="muted" style="font-size:14px;font-family:var(--font-mono)">Mongo · Redis</div></div></div>
            <div class="stat accent"><div class="k">merge groups</div><div class="v">3</div><div class="delta good">${ic("merge",13)} consolidation plan ready</div></div>
          </div>
          <div class="card-head mt24"><h3>Inventory</h3><span class="ch-meta">${D().databases.length} stores</span></div>
          <div class="tbl-wrap">
            <table class="tbl"><thead><tr><th class="no-sort">Store</th><th class="no-sort">Engine</th><th class="no-sort">Owner</th><th class="no-sort">Tables</th><th class="no-sort">Rows</th><th class="no-sort">Target</th></tr></thead>
            <tbody>${stores}</tbody></table>
          </div>
          <h2 style="font-size:20px;margin:30px 0 16px">Proposed merges</h2>
          <div class="grid g3">${merges}</div>
        </div>`;
    },
    mount(root) {
      root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => window.APP.openExport(b.dataset.export)));
    },
  };
})();
