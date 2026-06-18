/* ============================================================
   MERGENT APP — controller
   Hash router · sidebar · drawer · export modals · tweaks · boot
   ============================================================ */
(function () {
  "use strict";
  const ic = window.IC;
  const D = () => window.MERGENT_DATA;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const STORE = "mergent-app";

  /* ---------- auth ---------- */
  const AUTH_KEY = "mergent-auth";
  const ADMIN_EMAIL = "xorvion.ai@gmail.com";
  function getAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; } }
  let auth = getAuth();
  const isAdmin = () => !!(auth && (auth.isAdmin || String(auth.email || "").toLowerCase() === ADMIN_EMAIL));
  function logout() { try { localStorage.removeItem(AUTH_KEY); } catch (e) {} location.replace("../Login.html"); }
  function initial(name) { return (String(name || "M").trim()[0] || "M").toUpperCase(); }

  let state = { hasAnalysis: false };
  try { state = Object.assign(state, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} };

  /* ---------- nav model ---------- */
  const NAV = [
    { group: "Workspace", items: [
      { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    ]},
    { group: "Admin", adminOnly: true, items: [
      { id: "admin", icon: "shield", label: "Admin console" },
    ]},
    { group: "Analysis", needAnalysis: true, items: [
      { id: "overview", icon: "grid", label: "Overview" },
      { id: "services", icon: "layers", label: "Services", badge: "11" },
      { id: "dependencies", icon: "branch", label: "Dependencies", badge: "2", warm: true },
      { id: "apis", icon: "route", label: "API overlap", badge: "9", warm: true },
      { id: "databases", icon: "database", label: "Databases" },
      { id: "migration", icon: "map", label: "Migration plan" },
      { id: "risks", icon: "alert", label: "Risk report", badge: "3", warm: true },
      { id: "architecture", icon: "diagram", label: "Architecture" },
      { id: "jira", icon: "kanban", label: "Jira backlog" },
      { id: "report", icon: "report", label: "Report" },
    ]},
    { group: "Build", items: [
      { id: "handoff", icon: "code", label: "Developer handoff" },
    ]},
    { group: "Account", items: [
      { id: "support", icon: "lifebuoy", label: "Customer support" },
    ]},
  ];

  function buildNav() {
    const nav = $("#sideNav");
    nav.innerHTML = NAV.filter((g) => !g.adminOnly || isAdmin()).map((g) => `
      <div class="nav-group">
        <div class="lbl"><span>${g.group}</span></div>
        ${g.items.map((it) => {
          const locked = g.needAnalysis && !state.hasAnalysis;
          return `<a class="nav-item ${locked ? "locked" : ""}" data-route="${it.id}" ${locked ? "" : `href="#/${it.id}"`}>
            <span class="ni-ic">${ic(it.icon, 18)}</span>
            <span class="ni-label">${it.label}</span>
            ${it.badge && !locked ? `<span class="ni-badge ${it.warm ? "warm" : ""}">${it.badge}</span>` : ""}
            ${it.badge && it.warm ? `<span class="ni-dot"></span>` : ""}
          </a>`;
        }).join("")}
      </div>`).join("");
    $$("#sideNav .nav-item.locked").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go("new"); flashToast("Run an analysis first"); }));
  }

  /* ---------- router ---------- */
  let currentView = null;
  const ALL = () => window.VIEWS;
  function routeFromHash() { return (location.hash.replace(/^#\/?/, "") || "dashboard").split("?")[0]; }

  function go(route) { location.hash = "#/" + route; }

  function render() {
    const route = routeFromHash();
    const views = ALL();
    const view = views[route] ? route : "dashboard";

    // admin route is owner-only
    if (view === "admin" && !isAdmin()) { go("dashboard"); return; }

    // gate analysis routes
    const needs = NAV.find((g) => g.needAnalysis).items.map((i) => i.id);
    if (needs.includes(view) && !state.hasAnalysis) { go("new"); return; }

    // unmount previous
    if (currentView && views[currentView] && views[currentView].unmount) views[currentView].unmount();
    currentView = view;

    const v = views[view];
    const host = $("#view");
    host.scrollTop = 0;
    host.innerHTML = v.render();
    if (v.mount) v.mount(host);

    // mark analysis as available once results are reached / run completes
    if (view === "overview") { if (!state.hasAnalysis) { state.hasAnalysis = true; save(); buildNav(); } }

    // active nav
    $$("#sideNav .nav-item").forEach((a) => a.classList.toggle("active", a.dataset.route === view));

    // crumbs + run pill
    updateChrome(view, v);
    closeDrawer(); closeModal();
  }

  function updateChrome(view, v) {
    const analysisViews = NAV.find((g) => g.needAnalysis).items.map((i) => i.id);
    const showCtx = state.hasAnalysis && analysisViews.includes(view);
    const repo = (D() && D().repo) || { name: "acme/commerce-platform", branch: "main" };
    $("#crumbs").innerHTML = showCtx
      ? `<span class="c-repo">${ic("github", 16)} ${esc(repo.name)}</span><span class="branch">${esc(repo.branch || "main")}</span><span class="sep">/</span><span class="c-view">${v.title}</span>`
      : `<span class="c-repo">${view === "new" ? "New analysis" : "Workspace"}</span>`;
    $("#topRunPill").style.display = showCtx ? "" : "none";
  }

  /* ---------- drawer ---------- */
  function openDrawer(html, title) {
    $("#drawerTitle").textContent = title || "Detail";
    $("#drawerBody").innerHTML = html;
    $("#drawer").classList.add("open"); $("#drawerScrim").classList.add("open");
  }
  function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawerScrim").classList.remove("open"); }

  function openServiceDrawer(id) {
    const s = D().services.find((x) => x.id === id);
    if (!s) { // could be a target node
      const t = D().targets.find((x) => x.id === id);
      if (t) return openDrawer(`
        <div class="flex center-y gap8"><span class="dg-dot" style="width:10px;height:10px;border-radius:50%;background:var(--accent);display:inline-block"></span><span class="mono" style="color:var(--accent);font-weight:600">${esc(t.id)}</span></div>
        <p class="muted mt8" style="font-size:14px">${esc(t.domain)}</p>
        <h4>Consolidates</h4>${t.from.map((f) => `<div class="ep"><span class="svc-name">${ic("server",14)} ${f}</span></div>`).join("")}
        <h4>Target</h4><div class="kv"><span class="k">language</span><span class="v">${t.lang}</span></div>
        <div class="kv"><span class="k">database</span><span class="v mono">${t.db}</span></div>
        <div class="kv"><span class="k">endpoints</span><span class="v mono">${t.endpoints}</span></div>`, "Target service");
      const ingress = id === "platform-ingress";
      if (ingress) return openDrawer(`<p class="muted" style="font-size:14px">Thinned <span class="mono">api-gateway</span> — routing, auth &amp; rate-limiting only. All retired service routes removed.</p>`, "platform-ingress");
      return;
    }
    const deps = D().dependencies.edges.filter((e) => e.from === id);
    const overlaps = D().apiOverlaps.filter((o) => o.services.includes(id));
    openDrawer(`
      <div class="flex center-y gap8"><span class="lang"><span class="ld ${s.lang.replace(/[^A-Za-z]/g,"")}"></span></span><span class="svc-name mono">${esc(s.id)}</span></div>
      <p class="muted mt8" style="font-size:13.5px">${esc(s.domain)}</p>
      <div class="kv"><span class="k">language</span><span class="v">${s.lang}</span></div>
      <div class="kv"><span class="k">framework</span><span class="v">${s.framework}</span></div>
      <div class="kv"><span class="k">port</span><span class="v mono">${s.port}</span></div>
      <div class="kv"><span class="k">files / LOC</span><span class="v mono">${s.files} · ${s.loc.toLocaleString()}</span></div>
      <div class="kv"><span class="k">database</span><span class="v mono">${s.db || "—"}</span></div>
      <div class="kv"><span class="k">domain confidence</span><span class="v mono">${Math.round(s.confidence*100)}%</span></div>
      <div class="kv"><span class="k">consolidates into</span><span class="v"><span class="tag-merge">${ic("merge",12)} ${s.target}</span></span></div>
      <h4>Outgoing dependencies</h4>
      ${deps.length ? deps.map((e) => `<div class="ep"><span class="pill ${e.cycle?"":""}" style="${e.cycle?"color:oklch(0.66 0.19 20)":""}">${e.type}</span> <span>${e.to}</span>${e.cycle?`<span class="mono" style="color:oklch(0.66 0.19 20);margin-left:auto">cycle</span>`:`<span class="mono muted" style="margin-left:auto">${e.calls||""}</span>`}</div>`).join("") : `<p class="muted" style="font-size:13.5px">None.</p>`}
      ${overlaps.length ? `<h4>API overlaps</h4>${overlaps.map((o) => `<div class="ep"><span class="verb ${o.verb}">${o.verb}</span> <span class="muted">${esc(o.path.split("·")[0])}</span><span class="sev ${o.severity}" style="margin-left:auto">${o.severity==="med"?"med":o.severity}</span></div>`).join("")}` : ""}
    `, "Service");
  }

  /* ---------- export modal ---------- */
  function jiraJSON() {
    return JSON.stringify(D().jira.map((t) => ({
      key: t.key, fields: { summary: t.title, description: t.desc, issuetype: "Task", priority: t.priority, customfield_storypoints: t.points, epic: t.epic, depends_on: t.deps },
    })), null, 2);
  }
  function jiraCSV() {
    const head = "Key,Summary,Epic,Priority,Points,Depends On";
    return head + "\n" + D().jira.map((t) => [t.key, `"${t.title}"`, t.epic, t.priority, t.points, `"${t.deps.join(" ")}"`].join(",")).join("\n");
  }
  const EXPORTS = {
    report: { title: "Export report", sub: "Full migration plan, rollback & exec summary", icon: "report", tabs: [
      { id: "pdf", label: "PDF", note: "GET /api/analyses/:id/report?format=pdf", body: () => `Migration Report — acme/commerce-platform\n────────────────────────────────────────\n11 → 4 services · ${D().summary.depsBefore} → ${D().summary.depsAfter} deps · ${D().summary.dupApis} → 0 dup APIs\n\n01 Executive summary\n02 Target architecture\n03 Sequencing (6 phases · ${D().migration.totalWeeks} wk)\n04 Rollback strategy\n05 Top risks (${D().summary.risksHigh} high)\n\n[ generated PDF · ${D().repo.files} files analyzed ]`, download: "mergent-report.txt" },
      { id: "html", label: "Rich HTML", note: "GET …/report?format=html", body: () => `<!doctype html>\n<article class="mergent-report">\n  <h1>acme/commerce-platform</h1>\n  <!-- 11 → 4 consolidation · 5 sections · diagrams embedded -->\n</article>`, download: "mergent-report.html" },
    ]},
    jira: { title: "Export Jira backlog", sub: "14 tasks · import-friendly", icon: "kanban", tabs: [
      { id: "json", label: "JSON", note: "Jira REST issue shape", body: jiraJSON, download: "mergent-backlog.json" },
      { id: "csv", label: "CSV", note: "Jira CSV import", body: jiraCSV, download: "mergent-backlog.csv" },
    ]},
    services: { title: "Export services", sub: "Agent 1 output", icon: "layers", tabs: [{ id: "json", label: "JSON", note: "service inventory", body: () => JSON.stringify(D().services, null, 2), download: "services.json" }]},
    dependencies: { title: "Export dependencies", sub: "Agent 2 output", icon: "branch", tabs: [{ id: "json", label: "JSON", note: "edges + cycles", body: () => JSON.stringify(D().dependencies, null, 2), download: "dependencies.json" }]},
    apis: { title: "Export API analysis", sub: "Agent 3 output", icon: "route", tabs: [{ id: "json", label: "JSON", note: "overlap groups", body: () => JSON.stringify({ stats: D().apiStats, overlaps: D().apiOverlaps }, null, 2), download: "apis.json" }]},
    databases: { title: "Export databases", sub: "Agent 4 output", icon: "database", tabs: [{ id: "json", label: "JSON", note: "stores + merges", body: () => JSON.stringify({ databases: D().databases, merges: D().dbMerges }, null, 2), download: "databases.json" }]},
    risks: { title: "Export risk report", sub: "Agent 6 output", icon: "alert", tabs: [{ id: "json", label: "JSON", note: "risk register", body: () => JSON.stringify(D().risks, null, 2), download: "risks.json" }]},
    handoff: { title: "OpenAPI stub", sub: "Backend contract scaffold", icon: "code", tabs: [{ id: "yaml", label: "openapi.yaml", note: "drop into your project", body: () => `openapi: 3.1.0\ninfo:\n  title: Mergent API\n  version: 0.1.0\npaths:\n  /api/analyses:\n    post:    { summary: Start an analysis }\n    get:     { summary: List analyses }\n  /api/analyses/{id}:\n    get:     { summary: Full analysis object }\n  /api/analyses/{id}/stream:\n    get:     { summary: SSE live agent progress }\n  /api/analyses/{id}/report:\n    get:     { summary: PDF / HTML report }\n  /api/analyses/{id}/jira:\n    get:     { summary: Jira backlog (json/csv) }`, download: "openapi.yaml" }]},
  };

  function highlight(code) {
    return esc(code)
      .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="ck">$1</span>$2')
      .replace(/: (&quot;[^&]*?&quot;)/g, ': <span class="cs">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="cn">$1</span>');
  }

  function openExport(kind) {
    const cfg = EXPORTS[kind]; if (!cfg) return;
    let active = cfg.tabs[0].id;
    function body() {
      const tab = cfg.tabs.find((t) => t.id === active);
      $("#modal").querySelector(".code-block").innerHTML = highlight(tab.body());
      $("#modal").querySelector("#expNote").textContent = tab.note;
      $$("#modal .modal-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === active));
    }
    $("#modal").innerHTML = `
      <div class="modal-head"><span class="mh-ic">${ic(cfg.icon, 18)}</span>
        <div><h3>${cfg.title}</h3><div class="mh-s">${cfg.sub}</div></div>
        <button class="mx" id="modalClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      ${cfg.tabs.length > 1 ? `<div class="modal-tabs">${cfg.tabs.map((t) => `<button data-t="${t.id}">${t.label}</button>`).join("")}</div>` : ""}
      <div class="modal-body"><div class="code-block"></div></div>
      <div class="modal-foot"><span class="mf-note mono" id="expNote"></span><span class="spacer"></span>
        <button class="btn btn-ghost" id="copyBtn">${ic("copy",16)} Copy</button>
        <button class="btn btn-primary" id="dlBtn">${ic("download",16)} Download</button></div>`;
    $("#modalScrim").classList.add("open");
    $("#modalClose").addEventListener("click", closeModal);
    $$("#modal .modal-tabs button").forEach((b) => b.addEventListener("click", () => { active = b.dataset.t; body(); }));
    $("#copyBtn").addEventListener("click", () => {
      const tab = cfg.tabs.find((t) => t.id === active);
      navigator.clipboard && navigator.clipboard.writeText(tab.body());
      flashToast("Copied to clipboard");
    });
    $("#dlBtn").addEventListener("click", () => {
      const tab = cfg.tabs.find((t) => t.id === active);
      const blob = new Blob([tab.body()], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = tab.download; a.click();
      URL.revokeObjectURL(a.href);
      flashToast("Downloaded " + tab.download);
    });
    body();
  }
  function closeModal() { $("#modalScrim").classList.remove("open"); }

  /* ---------- toast ---------- */
  let toastT;
  function flashToast(msg) {
    const t = $("#toast");
    t.innerHTML = ic("check", 16) + " " + esc(msg);
    t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------- theme ---------- */
  const THEME_KEY = "mergent-theme";
  (function initTheme() { let t = "dark"; try { t = localStorage.getItem(THEME_KEY) || "dark"; } catch (e) {} document.documentElement.setAttribute("data-theme", t); syncThemeIcons(t); })();
  function syncThemeIcons(t) {
    $$(".moon").forEach((m) => m.style.display = t === "dark" ? "" : "none");
    $$(".sun").forEach((s) => s.style.display = t === "dark" ? "none" : "");
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    syncThemeIcons(next);
    if (tw.accent) applyAccent(tw.accent);
  }

  /* ---------- logo ---------- */
  function buildLogo() {
    const el = $("#appLogo"); if (!el) return;
    el.innerHTML = `<svg viewBox="0 0 40 40" style="width:32px;height:32px;color:var(--text)">
      <line x1="20" y1="20" x2="9" y2="10" stroke="currentColor" stroke-width="1.4" opacity=".45"/>
      <line x1="20" y1="20" x2="31" y2="10" stroke="currentColor" stroke-width="1.4" opacity=".45"/>
      <line x1="20" y1="20" x2="9" y2="30" stroke="currentColor" stroke-width="1.4" opacity=".45"/>
      <line x1="20" y1="20" x2="31" y2="30" stroke="currentColor" stroke-width="1.4" opacity=".45"/>
      <circle cx="9" cy="10" r="3.1" fill="currentColor" opacity=".85"/><circle cx="31" cy="10" r="3.1" fill="currentColor" opacity=".85"/>
      <circle cx="9" cy="30" r="3.1" fill="currentColor" opacity=".85"/><circle cx="31" cy="30" r="3.1" fill="currentColor" opacity=".85"/>
      <circle cx="20" cy="20" r="5" fill="var(--accent)"/></svg>`;
  }

  /* ---------- tweaks ---------- */
  const TWEAK_KEY = "mergent-app-tweaks";
  let tw = { accent: null, density: "comfortable", motion: "on" };
  try { tw = Object.assign(tw, JSON.parse(localStorage.getItem(TWEAK_KEY) || "{}")); } catch (e) {}
  const ACCENTS = { cyan: "199", azure: "230", violet: "285", emerald: "165", amber: "70" };
  function applyAccent(hue) {
    if (!hue) { document.documentElement.style.removeProperty("--accent"); document.documentElement.style.removeProperty("--accent-2"); return; }
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    document.documentElement.style.setProperty("--accent", `oklch(${dark ? "0.81 0.13" : "0.56 0.13"} ${hue})`);
    document.documentElement.style.setProperty("--accent-2", `oklch(${dark ? "0.70 0.135" : "0.50 0.13"} ${parseFloat(hue) + 14})`);
  }
  function applyDensity(v) { document.documentElement.setAttribute("data-density", v); }
  function applyMotion(v) { document.body.classList.toggle("no-motion", v === "off"); }
  function saveTw() { try { localStorage.setItem(TWEAK_KEY, JSON.stringify(tw)); } catch (e) {} }
  function initTweaks() {
    const panel = $("#tweaks");
    const swRow = panel.querySelector("[data-sw-row]");
    Object.entries(ACCENTS).forEach(([name, hue]) => {
      const s = document.createElement("div");
      s.className = "sw"; s.title = name; s.style.background = `oklch(0.78 0.14 ${hue})`;
      s.addEventListener("click", () => { tw.accent = hue; applyAccent(hue); saveTw(); swRow.querySelectorAll(".sw").forEach((x) => x.classList.remove("sel")); s.classList.add("sel"); });
      if (tw.accent === hue) s.classList.add("sel");
      swRow.appendChild(s);
    });
    function seg(attr, apply) {
      panel.querySelectorAll(`[data-${attr}]`).forEach((b) => {
        b.classList.toggle("on", b.getAttribute("data-" + attr) === tw[attr]);
        b.addEventListener("click", () => { tw[attr] = b.getAttribute("data-" + attr); panel.querySelectorAll(`[data-${attr}]`).forEach((x) => x.classList.toggle("on", x === b)); apply(tw[attr]); saveTw(); });
      });
    }
    seg("density", applyDensity); seg("motion", applyMotion);
    if (tw.accent) applyAccent(tw.accent);
    applyDensity(tw.density); applyMotion(tw.motion);

    function setOpen(open) { panel.classList.toggle("show", open); }
    window.addEventListener("message", (e) => {
      const d = e.data || {};
      if (d.type === "tweaks:toggle" || d.type === "toggleTweaks") setOpen(!!d.open);
      if (d.type === "tweaks:open") setOpen(true);
      if (d.type === "tweaks:close") setOpen(false);
    });
    $("#tweaksBtn").addEventListener("click", () => setOpen(!panel.classList.contains("show")));
    $("#tweaksToggle").addEventListener("click", () => setOpen(!panel.classList.contains("show")));
  }

  /* ---------- identity ---------- */
  function buildIdentity() {
    if (!auth) return;
    const foot = $(".foot-profile");
    if (foot) {
      const ava = foot.querySelector(".ava"), nm = foot.querySelector(".nm"), em = foot.querySelector(".em");
      if (ava) {
        const src = auth.picture || (window.MergentGravatar && auth.email ? window.MergentGravatar(auth.email, 68) : "");
        if (src) {
          ava.style.overflow = "hidden"; ava.style.padding = "0";
          ava.innerHTML = `<img src="${src}" referrerpolicy="no-referrer" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.textContent='${initial(auth.name)}'"/>`;
        } else ava.textContent = initial(auth.name);
      }
      if (nm) nm.textContent = auth.name || "Member";
      if (em) em.textContent = auth.email || "";
    }
  }

  /* ---------- expose + boot ---------- */
  window.APP = { go, openDrawer, openServiceDrawer, openExport, flashToast, logout, isAdmin, get auth() { return auth; } };

  async function boot() {
    if (!auth) { location.replace("../Login.html"); return; }
    if (window.MergentHydrate) { try { await window.MergentHydrate(); } catch (e) {} }
    // Unlock the analysis views: admins always have the demo; others once they
    // have an analysis open (set after a run completes or opening a recent one).
    if (isAdmin() || (window.MergentAPI && window.MergentAPI.getActive())) {
      if (!state.hasAnalysis) { state.hasAnalysis = true; save(); }
    }
    buildLogo();
    buildIdentity();
    buildNav();

    $("#themeBtn").addEventListener("click", toggleTheme);
    $("#topTheme").addEventListener("click", toggleTheme);
    $("#drawerClose").addEventListener("click", closeDrawer);
    $("#drawerScrim").addEventListener("click", closeDrawer);
    $("#modalScrim").addEventListener("click", (e) => { if (e.target === $("#modalScrim")) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeModal(); } });

    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = "#/dashboard";
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
