/* MERGENT APP — flow views: Dashboard · New Analysis · Run */
(function () {
  "use strict";
  const VIEWS = (window.VIEWS = window.VIEWS || {});
  const ic = window.IC;
  const D = () => window.MERGENT_DATA;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  /* ============ DASHBOARD ============ */
  VIEWS.dashboard = {
    title: "Workspace",
    render() {
      const admin = !!window.MERGENT_ADMIN;
      const r = D().recent || [];
      const quota = D().quota || { used: D().summary.quotaUsed, total: D().summary.quotaTotal };
      // stats: admin sees the rich demo numbers; everyone else sees their own real rollups
      const real = D().realStats || { analyses: 0, services: 0, risksHigh: 0 };
      const stats = admin
        ? { analyses: 3, services: 26, risksHigh: 6, sub: "across 3 repos" }
        : { analyses: real.analyses, services: real.services, risksHigh: real.risksHigh, sub: real.analyses ? "across your repos" : "no runs yet" };
      const who = (window.MergentAPI && window.MergentAPI.email && window.MergentAPI.email()) || "Workspace";

      const rows = r.map((a) => `
        <div class="recent-row ${a.active ? "active" : ""}" data-open-analysis="${esc(a.id || "")}">
          <span class="rr-name">${ic(a.source === "github" ? "github" : "folder", 16)} ${esc(a.repo)}</span>
          <div class="rr-cell"><div class="rr-k">services</div><div class="rr-v">${a.services} <span class="muted" style="font-size:13px">→ ${a.after}</span></div></div>
          <div class="rr-cell"><div class="rr-k">high risks</div><div class="rr-v" style="color:${a.risksHigh ? "oklch(0.66 0.19 20)" : "var(--muted)"}">${a.risksHigh}</div></div>
          <div class="rr-cell"><div class="rr-k">source</div><div class="rr-v" style="font-size:14px;font-family:var(--font-mono);text-transform:capitalize">${a.source}</div></div>
          <div class="rr-cell"><div class="rr-k">when</div><div class="rr-v" style="font-size:14px;font-family:var(--font-mono)">${a.when}</div></div>
          <span class="pill ${a.active ? "reason" : ""}">${a.active ? "open" : "view"} ${ic("arrowRight", 13)}</span>
        </div>`).join("");

      const recentBlock = r.length
        ? `<div class="card-head"><h3>Recent</h3><span class="ch-meta">${r.length} ${r.length === 1 ? "analysis" : "analyses"}</span></div>${rows}`
        : `<div class="empty" style="margin-top:8px">
             <div class="e-ic">${ic("layers",30)}</div>
             <h3>No analyses yet</h3>
             <p>Point Mergent at a GitHub repo or upload a zip — or try the bundled sample to see a full run end to end.</p>
             <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
               <button class="btn btn-primary btn-lg" data-go="new">${ic("plus",17)} Start your first analysis</button>
               <button class="btn btn-ghost btn-lg" data-sample-run>${ic("sparkles",17)} Try the sample</button>
             </div>
           </div>`;

      return `
        <div class="view-inner view-fade">
          <div class="page-head">
            <div class="head-row">
              <div>
                <span class="eyebrow">Workspace · ${esc(admin ? "Xorvion" : who)}</span>
                <h1>Your analyses</h1>
                <p class="lead">Every run produces a full migration analysis — service inventory, dependency graph, API overlap, database plan, risks, diagrams, report and a Jira-ready backlog.</p>
              </div>
              <button class="btn btn-primary btn-lg" data-go="new">${ic("plus",17)} New analysis</button>
            </div>
          </div>

          <div class="grid g4" style="margin-bottom:28px">
            <div class="stat"><div class="k">analyses run</div><div class="v">${stats.analyses}</div><div class="delta good">${ic("check",13)} ${stats.analyses ? "all completed" : "ready when you are"}</div></div>
            <div class="stat accent"><div class="k">services analyzed</div><div class="v">${stats.services}</div><div class="delta good">${ic("layers",13)} ${esc(stats.sub)}</div></div>
            <div class="stat"><div class="k">free-tier quota</div><div class="v">${quota.used}<span style="font-size:18px;color:var(--muted)"> / ${quota.total}</span></div><div class="delta good">${ic("zap",13)} ${(D().mode === "gemini") ? "Gemini calls today" : "deterministic mode"}</div></div>
            <div class="stat warm"><div class="k">open high risks</div><div class="v">${stats.risksHigh}</div><div class="delta warm">${ic("alert",13)} ${stats.risksHigh ? "need attention" : "none open"}</div></div>
          </div>

          ${recentBlock}
        </div>`;
    },
    mount(root) {
      root.querySelectorAll("[data-open-analysis]").forEach((el) => {
        el.addEventListener("click", async () => {
          const id = el.getAttribute("data-open-analysis");
          if (id && window.MergentAPI) {
            window.MergentAPI.setActive(id);
            if (window.MergentHydrate) { try { await window.MergentHydrate(); } catch (e) {} }
          }
          window.APP.go("overview");
        });
      });
      root.querySelectorAll("[data-go='new']").forEach((b) => b.addEventListener("click", () => window.APP.go("new")));
      root.querySelectorAll("[data-sample-run]").forEach((b) => b.addEventListener("click", () => {
        window.__mergentPending = { payload: { source: "sample", sample: "commerce-platform" }, repoName: "acme/commerce-platform" };
        window.APP.go("run");
      }));
    },
  };

  /* ============ NEW ANALYSIS ============ */
  VIEWS.new = {
    title: "New analysis",
    render() {
      const samples = D().sampleRepos.map((s) => `
        <div class="sample-card" data-sample="${esc(s.name)}">
          <span class="sc-ic">${ic("folder",18)}</span>
          <div style="min-width:0">
            <div class="nm">${esc(s.name)}</div>
            <div class="bl">${esc(s.blurb)}</div>
            <div class="mt">${esc(s.langs)} · ${s.services} services</div>
          </div>
        </div>`).join("");
      return `
        <div class="view-inner view-fade">
          <div class="page-head">
            <span class="eyebrow">Analyze architecture</span>
            <h1>Point Mergent at your services</h1>
            <p class="lead">Paste a public GitHub URL, upload a zip, or drop OpenAPI specs. A deterministic parser extracts the facts first — then the agents reason over them.</p>
          </div>

          <div class="banner info">
            <span class="bn-ic">${ic("info",18)}</span>
            <div><div class="bn-t">Hybrid analysis — we never send your whole repo to the model</div>
            <div class="bn-s">Parsers read build files, controllers, ORM models &amp; specs into hard facts; Gemini only reasons over those facts. Cheaper, safer, and it scales to large repos.</div></div>
          </div>

          <div class="intake-grid mt24">
            <div>
              <div class="source-tabs" data-src-tabs>
                <button class="on" data-src="github">${ic("github",16)} GitHub URL</button>
                <button data-src="zip">${ic("upload",16)} Upload zip</button>
                <button data-src="openapi">${ic("file",16)} OpenAPI specs</button>
              </div>

              <div data-src-panel="github">
                <label class="mono" style="font-size:12.5px;color:var(--muted);display:block;margin-bottom:8px">Public repository URL</label>
                <div class="url-input">
                  <input class="input" id="repoUrl" value="https://github.com/acme/commerce-platform" spellcheck="false" />
                  <button class="btn btn-primary" data-analyze>${ic("sparkles",16)} Analyze</button>
                </div>
                <p class="mono" id="urlErr" style="font-size:12px;color:oklch(0.66 0.19 20);margin-top:9px;display:none">Enter a valid public repository URL.</p>
                <p class="muted" style="font-size:13px;margin-top:11px">Mono-repos and multi-service layouts are detected automatically. No token needed for public repos.</p>
              </div>

              <div data-src-panel="zip" style="display:none">
                <div class="dropzone" data-analyze>
                  <div class="dz-ic">${ic("upload",24)}</div>
                  <div class="dz-t">Drop a .zip of your services here</div>
                  <div class="dz-s">or click to browse · up to 200 MB</div>
                </div>
              </div>

              <div data-src-panel="openapi" style="display:none">
                <div class="dropzone" data-analyze>
                  <div class="dz-ic">${ic("file",24)}</div>
                  <div class="dz-t">Drop OpenAPI / Swagger specs</div>
                  <div class="dz-s">.json or .yaml · combine with a repo for richer results</div>
                </div>
              </div>

              <div class="card mt24" style="background:var(--bg-inset)">
                <div class="flex center-y gap12">
                  <span class="ch-ic">${ic("server",17)}</span>
                  <div><div style="font-weight:600;font-size:14.5px">7-agent pipeline</div><div class="muted" style="font-size:13px">Discovery → Dependencies → APIs → Databases → Strategy → Risk → Docs</div></div>
                </div>
              </div>
            </div>

            <div>
              <div class="card-head"><h3>Or try a sample</h3><span class="ch-meta">zero-config</span></div>
              <div class="grid" style="gap:12px">${samples}</div>
              <p class="muted" style="font-size:13px;margin-top:14px">Samples are bundled multi-language repos — also the fallback if a clone or quota check fails, so a demo never hard-fails.</p>
            </div>
          </div>
        </div>`;
    },
    mount(root) {
      const API = window.MergentAPI;
      const tabs = root.querySelector("[data-src-tabs]");
      let activeSrc = "github";
      tabs.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        tabs.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        activeSrc = b.dataset.src;
        root.querySelectorAll("[data-src-panel]").forEach((p) => p.style.display = p.dataset.srcPanel === activeSrc ? "" : "none");
      }));

      // hidden file inputs for zip / openapi
      const zipInput = mkInput(".zip", false);
      const specInput = mkInput(".json,.yaml,.yml", true);
      root.appendChild(zipInput); root.appendChild(specInput);

      function begin(payload, repoName) {
        // The run view performs the actual streaming POST (one request, Vercel-safe).
        if (!API) { window.APP.go("run"); return; }
        window.__mergentPending = { payload, repoName: repoName || payload.url || payload.sample || "analysis" };
        window.APP.go("run");
      }

      root.querySelector("[data-src-panel='github'] [data-analyze]")?.addEventListener("click", () => {
        const url = root.querySelector("#repoUrl").value.trim();
        if (!/^https?:\/\/.+\..+/.test(url)) { root.querySelector("#urlErr").style.display = "block"; return; }
        begin({ source: "github", url }, url.replace(/^https?:\/\//, "").replace(/\.git$/, ""));
      });

      root.querySelector("[data-src-panel='zip'] [data-analyze]")?.addEventListener("click", () => zipInput.click());
      zipInput.addEventListener("change", () => {
        if (zipInput.files[0]) begin({ source: "zip", zipFile: zipInput.files[0] }, zipInput.files[0].name.replace(/\.zip$/i, ""));
      });

      root.querySelector("[data-src-panel='openapi'] [data-analyze]")?.addEventListener("click", () => specInput.click());
      specInput.addEventListener("change", () => {
        if (specInput.files.length) begin({ source: "openapi", specFiles: [...specInput.files] }, "openapi-spec");
      });

      root.querySelectorAll("[data-sample]").forEach((c) => c.addEventListener("click", () =>
        begin({ source: "sample", sample: c.dataset.sample }, c.dataset.sample)));

      function mkInput(accept, multiple) {
        const i = document.createElement("input");
        i.type = "file"; i.accept = accept; i.multiple = !!multiple; i.style.display = "none";
        return i;
      }
    },
  };

  /* ============ RUN (live streaming) ============ */
  let streamTimer = null;
  VIEWS.run = {
    title: "Running analysis",
    render() {
      const pending = window.__mergentPending;
      const repoName = (pending && pending.repoName) || (D().repo && D().repo.name) || "your services";
      const rows = D().agents.map((a) => `
        <div class="as-row" data-st="queued" data-agent="${a.id}">
          <span class="as-ic">${a.n}</span>
          <div class="as-body">
            <div class="as-line"><span class="as-name">${a.name}</span><span class="pill ${a.role}" style="margin-left:auto">${a.role}</span></div>
            <div class="as-detail">queued</div>
            <div class="as-prog"><i></i></div>
          </div>
          <span class="as-check">${ic("checkCircle",18)}</span>
        </div>`).join("");
      return `
        <div class="run-wrap view-fade">
          <div class="page-head">
            <span class="eyebrow">Live analysis</span>
            <div class="head-row">
              <div><h1>Analyzing <span class="mono" style="color:var(--accent)">${esc(repoName)}</span></h1>
              <p class="lead">Each agent parses hard facts, then reasons over them. Progress streams live — no frozen spinner.</p></div>
              <div class="run-pill running" id="runPill"><span class="d"></span> <span id="runPillTxt">running</span></div>
            </div>
          </div>

          <div class="banner info" id="quotaBanner" style="display:none">
            <span class="bn-ic">${ic("zap",18)}</span>
            <div><div class="bn-t" id="quotaT">Checking analysis mode…</div><div class="bn-s" id="quotaS"></div></div>
          </div>

          <div class="run-grid mt8">
            <div class="agent-stream" id="agentStream">${rows}</div>
            <div>
              <div class="card-head"><h3>Stream</h3><span class="ch-meta" id="streamPct">0%</span></div>
              <div class="console" id="console"></div>
            </div>
          </div>
        </div>`;
    },
    mount(root) {
      const API = window.MergentAPI;
      const pending = window.__mergentPending;
      if (pending && API) return this._real(root, API, pending);
      return this._simulated(root);
    },

    /* ---- real backend streaming over fetch (one request) ---- */
    _real(root, API, pending) {
      window.__mergentPending = null;
      VIEWS.run._ivs = [];
      const consoleEl = root.querySelector("#console");
      const pctEl = root.querySelector("#streamPct");
      const pill = root.querySelector("#runPill");
      const pillTxt = root.querySelector("#runPillTxt");
      const rowEls = [...root.querySelectorAll(".as-row")];
      const total = rowEls.length || 7;
      const t0 = Date.now();
      const stamp = () => (((Date.now() - t0) / 1000).toFixed(1)).padStart(5, "0");
      function log(raw) {
        const msg = String(raw);
        let cls = "ac", glyph = "▸";
        if (/^✓|^cloned|ok\b/i.test(msg)) { cls = "ok"; glyph = "✓"; }
        if (/^⚠|fail|fallback/i.test(msg)) { cls = "wm"; glyph = "!"; }
        if (/^↳/.test(msg)) { cls = "ac"; glyph = "↳"; }
        const clean = msg.replace(/^[✓⚠↳▸!]\s*/, "");
        const ln = document.createElement("div");
        ln.className = "ln";
        ln.innerHTML = `<span class="t">${stamp()}s</span><span class="m"><span class="${cls}">${glyph}</span> ${esc(clean)}</span>`;
        consoleEl.appendChild(ln);
        consoleEl.scrollTop = consoleEl.scrollHeight;
      }
      const rowFor = (id) => rowEls.find((r) => r.dataset.agent === id);
      const doneCount = () => rowEls.filter((r) => r.dataset.st === "done").length;
      const setPct = () => { pctEl.textContent = Math.round((doneCount() / total) * 100) + "%"; };

      // show mode banner
      API.config().then((c) => {
        const b = root.querySelector("#quotaBanner");
        if (!b) return;
        b.style.display = "";
        root.querySelector("#quotaT").textContent = c.mode === "gemini" ? "Gemini reasoning enabled" : "Deterministic mode (no API key)";
        root.querySelector("#quotaS").textContent = c.mode === "gemini"
          ? `${c.quotaUsed} / ${c.quotaTotal} free-tier calls used today.`
          : "Parsers extract facts; reasoning uses the built-in deterministic engine. Fully free.";
      }).catch(() => {});

      log("starting analysis…");

      function onAgent({ id, status, detail }) {
        const row = rowFor(id);
        if (!row) return;
        const fill = row.querySelector(".as-prog i");
        const detailEl = row.querySelector(".as-detail");
        if (status === "running") {
          row.dataset.st = "running";
          detailEl.textContent = detail || "working…";
          let w = 8;
          const iv = setInterval(() => { w = Math.min(w + 6, 92); fill.style.width = w + "%"; }, 90);
          row._iv = iv; VIEWS.run._ivs.push(iv);
        } else if (status === "done") {
          clearInterval(row._iv);
          row.dataset.st = "done";
          fill.style.width = "100%";
          detailEl.textContent = detail || "done";
          setPct();
        }
      }

      function onDone({ id, summary }) {
        pctEl.textContent = "100%";
        pill.classList.remove("running"); pill.classList.add("complete");
        pillTxt.textContent = "complete";
        const sum = summary || {};
        log(`analysis complete · ${sum.servicesBefore ?? ""} → ${sum.servicesAfter ?? ""} services · report + backlog ready`);
        if (id) API.setActive(id);
        const cta = document.createElement("div");
        cta.style.cssText = "margin-top:16px;display:flex;gap:12px";
        cta.innerHTML = `<button class="btn btn-primary btn-lg" id="viewResults">${ic("arrowRight",17)} View results</button>`;
        consoleEl.parentElement.appendChild(cta);
        const goResults = async () => { if (window.MergentHydrate) { try { await window.MergentHydrate(); } catch (e) {} } window.APP.go("overview"); };
        cta.querySelector("#viewResults").addEventListener("click", goResults);
        streamTimer = setTimeout(() => { if (location.hash.indexOf("run") >= 0) goResults(); }, 1800);
      }

      function onError(msg) {
        pill.classList.remove("running");
        pillTxt.textContent = "error";
        log("⚠ " + (msg || "analysis failed"));
      }

      API.startStream(pending.payload, { onLog: log, onAgent, onDone, onError })
        .catch((e) => onError(e.message));
    },

    /* ---- simulated fallback (pure static preview, no backend) ---- */
    _simulated(root) {
      VIEWS.run._ivs = [];
      const stream = root.querySelector("#agentStream");
      const consoleEl = root.querySelector("#console");
      const pctEl = root.querySelector("#streamPct");
      const pill = root.querySelector("#runPill");
      const pillTxt = root.querySelector("#runPillTxt");
      const agents = D().agents;
      const rowEls = [...stream.querySelectorAll(".as-row")];
      let line = 0;
      const t0 = Date.now();
      const stamp = () => { const s = ((Date.now() - t0) / 1000).toFixed(1); return s.padStart(5, "0"); };
      function log(html) {
        const ln = document.createElement("div");
        ln.className = "ln";
        ln.innerHTML = `<span class="t">${stamp()}s</span><span class="m">${html}</span>`;
        consoleEl.appendChild(ln);
        consoleEl.scrollTop = consoleEl.scrollHeight;
      }
      log('<span class="ac">▸</span> cloning acme/commerce-platform @ main…');

      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const speed = reduced ? 0.15 : 1;

      // intro lines then quota banner
      setTimeout(() => log('<span class="ok">✓</span> cloned · 3,174 files · 48.2 MB'), 500 * speed);
      setTimeout(() => { log('<span class="wm">!</span> checking Gemini free-tier quota…'); }, 850 * speed);
      setTimeout(() => { log('<span class="ok">✓</span> quota ok · <span class="ac">41/1500</span> calls used'); root.querySelector("#quotaBanner").style.display = ""; }, 1200 * speed);

      let i = -1;
      function runAgent() {
        i++;
        if (i >= agents.length) return finish();
        const a = agents[i], row = rowEls[i];
        row.dataset.st = "running";
        row.querySelector(".as-detail").textContent = a.run;
        log(`<span class="ac">▸</span> [${a.n}/7] <b style="color:var(--text)">${a.name}</b> — <span class="wm">parse</span> ${esc(a.parse.split(".")[0].toLowerCase())}…`);
        const fill = row.querySelector(".as-prog i");
        const dur = (reduced ? 120 : 900);
        const start = Date.now();
        // setInterval (not rAF) so the run keeps advancing even if the tab is backgrounded
        const iv = setInterval(() => {
          const p = Math.min((Date.now() - start) / dur, 1);
          fill.style.width = (p * 100) + "%";
          if (a.role === "reason" && p > 0.5 && !row._reasoned) {
            row._reasoned = true;
            log(`&nbsp;&nbsp;&nbsp;<span class="ac">↳ reason</span> gemini judging over facts…`);
          }
          const done = rowEls.filter((r) => r.dataset.st === "done").length;
          pctEl.textContent = Math.round(((done + p) / agents.length) * 100) + "%";
          if (p >= 1) {
            clearInterval(iv);
            row.dataset.st = "done";
            row.querySelector(".as-detail").textContent = a.done;
            log(`<span class="ok">✓</span> ${a.name} · <span class="ok">${esc(a.done)}</span>`);
            streamTimer = setTimeout(runAgent, reduced ? 30 : 180);
          }
        }, 40);
        VIEWS.run._ivs.push(iv);
      }
      function finish() {
        pctEl.textContent = "100%";
        pill.classList.remove("running"); pill.classList.add("complete");
        pillTxt.textContent = "complete";
        log('<span class="ok">✓</span> analysis complete · <b style="color:var(--accent)">11 → 4 services</b> · report + 14 Jira tasks ready');
        const cta = document.createElement("div");
        cta.style.cssText = "margin-top:16px;display:flex;gap:12px";
        cta.innerHTML = `<button class="btn btn-primary btn-lg" id="viewResults">${ic("arrowRight",17)} View results</button>`;
        consoleEl.parentElement.appendChild(cta);
        cta.querySelector("#viewResults").addEventListener("click", () => window.APP.go("overview"));
        streamTimer = setTimeout(() => { if (location.hash.indexOf("run") >= 0) window.APP.go("overview"); }, reduced ? 400 : 2600);
      }
      setTimeout(runAgent, (reduced ? 200 : 1500));
    },
    unmount() {
      clearTimeout(streamTimer);
      (VIEWS.run._ivs || []).forEach(clearInterval);
      try { VIEWS.run._es && VIEWS.run._es.close(); } catch (e) {}
    },
  };
})();
