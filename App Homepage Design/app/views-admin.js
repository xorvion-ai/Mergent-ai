/* MERGENT APP — Admin console (owner-only) + shared support-ticket store */
(function () {
  "use strict";
  const VIEWS = (window.VIEWS = window.VIEWS || {});
  const ic = window.IC;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const initial = (n) => (String(n || "?").trim()[0] || "?").toUpperCase();

  /* ============ SHARED TICKET STORE ============ */
  const TKEY = "mergent-tickets";
  const H = 3600e3, DAY = 86400e3;
  const SEED = [
    { id: 1042, name: "Dao Tran",     email: "dao.tran@vellum.dev",     subject: "Dependency graph missing a Kafka edge", category: "Analysis result looks wrong", priority: "High",   status: "open",     ts: Date.now() - 2 * H },
    { id: 1041, name: "Priya Nair",   email: "priya@northwind.io",      subject: "Jira CSV import rejected by our instance", category: "Export (report / Jira)",     priority: "Medium", status: "open",     ts: Date.now() - 5 * H },
    { id: 1040, name: "Sam Okafor",   email: "sam@oktane.sh",           subject: "Hit free-tier quota mid-run",              category: "Quota & billing",          priority: "High",   status: "open",     ts: Date.now() - 1 * DAY },
    { id: 1039, name: "Marco Reyes",  email: "marco@finlystack.com",    subject: "Private repo clone — any ETA?",            category: "GitHub clone / ingestion", priority: "Low",    status: "resolved", ts: Date.now() - 2 * DAY },
    { id: 1038, name: "Lena Fischer", email: "lena@brightwire.eu",      subject: "Add GraphQL endpoint detection",           category: "Feature request",          priority: "Low",    status: "resolved", ts: Date.now() - 5 * DAY },
  ];
  function loadTickets() {
    try { const v = JSON.parse(localStorage.getItem(TKEY)); if (Array.isArray(v)) return v; } catch (e) {}
    const seed = SEED.map((t) => Object.assign({ key: "TKT-" + t.id }, t));
    saveTickets(seed); return seed;
  }
  function saveTickets(list) { try { localStorage.setItem(TKEY, JSON.stringify(list)); } catch (e) {} }
  window.MERGENT_TICKETS = {
    list() { return loadTickets().slice().sort((a, b) => b.ts - a.ts); },
    add(obj) {
      const list = loadTickets();
      const id = list.reduce((m, t) => Math.max(m, t.id), 1037) + 1;
      list.push(Object.assign({ id, key: "TKT-" + id, status: "open", ts: Date.now() }, obj));
      saveTickets(list); return id;
    },
    setStatus(id, status) {
      const list = loadTickets(); const t = list.find((x) => x.id === id);
      if (t) { t.status = status; saveTickets(list); }
    },
    openCount() { return loadTickets().filter((t) => t.status === "open").length; },
  };

  /* ============ SEED USERS ============ */
  const USERS = [
    { name: "Xorvion",      email: "platform@xorvion.dev", role: "Owner",  plan: "Free", runs: 3,  last: "2m ago",  status: "active" },
    { name: "Dao Tran",     email: "dao.tran@vellum.dev",  role: "Member", plan: "Free", runs: 21, last: "18m ago", status: "active" },
    { name: "Priya Nair",   email: "priya@northwind.io",   role: "Member", plan: "Free", runs: 12, last: "1h ago",  status: "active" },
    { name: "Marco Reyes",  email: "marco@finlystack.com", role: "Member", plan: "Free", runs: 7,  last: "3h ago",  status: "active" },
    { name: "Ravi Menon",   email: "ravi@authnull.com",    role: "Member", plan: "Free", runs: 5,  last: "6h ago",  status: "active" },
    { name: "Lena Fischer", email: "lena@brightwire.eu",   role: "Member", plan: "Free", runs: 9,  last: "yesterday", status: "active" },
    { name: "Sam Okafor",   email: "sam@oktane.sh",        role: "Member", plan: "Free", runs: 2,  last: "2d ago",  status: "idle" },
    { name: "Chloe Wu",     email: "chloe@gridpath.ai",    role: "Member", plan: "Free", runs: 0,  last: "—",       status: "invited" },
  ];

  const HEALTH = [
    { name: "Gemini API",        metric: "312 / 1500 calls today", st: "ok" },
    { name: "GitHub ingestion",  metric: "1.2s avg clone",         st: "ok" },
    { name: "Agent pipeline",    metric: "7 / 7 agents online",    st: "ok" },
    { name: "Diagram render",    metric: "240ms p95",              st: "ok" },
    { name: "Export service",    metric: "Jira CSV elevated",      st: "degraded" },
    { name: "Database",          metric: "primary · 18ms",         st: "ok" },
  ];

  function rel(ts) {
    if (!ts) return "";
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  const userStatus = (s) => `<span class="sev ${s === "active" ? "low" : s === "idle" ? "med" : "high"}" style="${s === "invited" ? "color:var(--muted);background:var(--bg-3)" : ""}">${s}</span>`;
  const prio = (p) => `<span class="sev ${p === "High" ? "high" : p === "Medium" ? "med" : "low"}">${p}</span>`;

  function ticketRows() {
    return window.MERGENT_TICKETS.list().map((t) => `
      <tr data-ticket="${t.id}">
        <td class="mono-cell" style="color:var(--accent);font-weight:600">${esc(t.key)}</td>
        <td><div class="svc-name" style="gap:11px"><span class="ava" style="width:30px;height:30px;border-radius:9px;font-size:12px">${esc(initial(t.name))}</span><span><span style="display:block;color:var(--text);font-weight:600;font-size:13.5px">${esc(t.name)}</span><span class="mono muted" style="font-size:11.5px">${esc(t.email)}</span></span></div></td>
        <td><span style="display:block;color:var(--text-2);font-size:13.5px">${esc(t.subject)}</span><span class="mono muted" style="font-size:11.5px">${esc(t.category)}</span></td>
        <td>${prio(t.priority)}</td>
        <td>${t.status === "open" ? `<span class="sev med" style="color:var(--warm)">open</span>` : `<span class="sev low" style="color:oklch(0.74 0.15 150);background:oklch(0.74 0.15 150 / .12)">resolved</span>`}</td>
        <td class="mono-cell muted">${rel(t.ts)}</td>
        <td style="text-align:right"><button class="btn btn-ghost" style="padding:6px 12px;font-size:12.5px" data-toggle="${t.id}">${t.status === "open" ? "Resolve" : "Reopen"}</button></td>
      </tr>`).join("");
  }

  /* ============ ADMIN CONSOLE ============ */
  VIEWS.admin = {
    title: "Admin console",
    render() {
      const totalRuns = USERS.reduce((s, u) => s + u.runs, 0) + 84; // platform lifetime
      const openTickets = window.MERGENT_TICKETS.openCount();
      const health = HEALTH.map((h) => `
        <div class="card" style="padding:16px 18px;background:var(--bg-inset)">
          <div class="flex center-y" style="justify-content:space-between">
            <span style="font-weight:600;font-size:14px">${esc(h.name)}</span>
            <span class="sev ${h.st === "ok" ? "low" : "med"}" style="${h.st === "ok" ? "color:oklch(0.74 0.15 150);background:oklch(0.74 0.15 150 / .12)" : ""}">${h.st === "ok" ? "operational" : "degraded"}</span>
          </div>
          <div class="mono muted" style="font-size:12px;margin-top:8px">${esc(h.metric)}</div>
        </div>`).join("");
      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">Owner only · xorvion.ai@gmail.com</span>
            <div class="head-row"><div><h1>Admin console</h1>
            <p class="lead">Platform-wide oversight — only visible to the owner account. Manage members, watch system health, and triage every support ticket in one place.</p></div>
            <span class="run-pill complete"><span class="d"></span> all systems operational</span></div>
          </div>

          <div class="grid g4" style="margin-bottom:28px">
            <div class="stat"><div class="k">total users</div><div class="v" id="totalUsers">—</div><div class="delta good" id="activeUsers">${ic("users",13)} loading…</div></div>
            <div class="stat accent"><div class="k">analyses run</div><div class="v">${totalRuns}</div><div class="delta good">${ic("activity",13)} platform lifetime</div></div>
            <div class="stat"><div class="k">Gemini calls today</div><div class="v">312<span style="font-size:18px;color:var(--muted)"> / 1500</span></div><div class="delta good">${ic("zap",13)} 21% of free tier</div></div>
            <div class="stat ${openTickets ? "warm" : ""}"><div class="k">open tickets</div><div class="v" id="openTicketStat">${openTickets}</div><div class="delta ${openTickets ? "warm" : "good"}">${ic("lifebuoy",13)} ${openTickets ? "awaiting reply" : "all clear"}</div></div>
          </div>

          <div class="card-head"><span class="ch-ic">${ic("activity",17)}</span><h3>Platform health</h3><span class="ch-meta">live</span></div>
          <div class="grid g3" style="gap:14px;margin-bottom:14px">${health}</div>
          <div class="card" style="padding:18px 20px">
            <div class="flex center-y" style="justify-content:space-between"><span class="mono muted" style="font-size:13px">Gemini free-tier quota · today</span><span class="mono" style="font-weight:600">312 / 1500</span></div>
            <div style="height:8px;border-radius:8px;background:var(--bg-3);overflow:hidden;margin-top:10px"><i style="display:block;height:100%;width:21%;background:linear-gradient(90deg,var(--accent),var(--accent-2))"></i></div>
            <div class="muted" style="font-size:12.5px;margin-top:8px">21% used · resets at midnight UTC · graceful fallback to sample analysis on exhaustion</div>
          </div>

          <div class="card-head mt32"><span class="ch-ic">${ic("users",17)}</span><h3>Users</h3><span class="ch-meta" id="userMeta">loading…</span>
            <div style="margin-left:auto;position:relative;width:240px">
              <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted)">${ic("search",15)}</span>
              <input class="input" id="userSearch" placeholder="Search name or email…" style="padding:9px 12px 9px 34px;font-size:13px" />
            </div>
          </div>
          <div class="tbl-wrap">
            <table class="tbl"><thead><tr>
              <th class="no-sort">User</th><th class="no-sort">Role</th><th class="no-sort">Analyses</th><th class="no-sort">Logins</th><th class="no-sort">Last active</th><th class="no-sort">Status</th><th class="no-sort" style="text-align:right">Manage</th>
            </tr></thead><tbody id="userBody"><tr><td colspan="7" class="mono muted" style="text-align:center;padding:24px">Loading users…</td></tr></tbody></table>
            <div class="tbl-foot"><span id="userFoot">—</span><span>owner-managed · real signups</span></div>
          </div>

          <div class="card-head mt32"><span class="ch-ic">${ic("lifebuoy",17)}</span><h3>Support tickets</h3><span class="ch-meta" id="ticketMeta"></span></div>
          <div class="tbl-wrap">
            <table class="tbl"><thead><tr>
              <th class="no-sort" style="width:90px">Ticket</th><th class="no-sort">Requester</th><th class="no-sort">Subject</th><th class="no-sort">Priority</th><th class="no-sort">Status</th><th class="no-sort">When</th><th class="no-sort" style="text-align:right">Action</th>
            </tr></thead><tbody id="ticketBody">${ticketRows()}</tbody></table>
            <div class="tbl-foot"><span>Tickets submitted from <b style="color:var(--accent)">Customer support</b> land here in real time.</span><span id="ticketFoot"></span></div>
          </div>
        </div>`;
    },
    mount(root) {
      function refreshTickets() {
        root.querySelector("#ticketBody").innerHTML = ticketRows();
        bindToggles();
        const open = window.MERGENT_TICKETS.openCount();
        const total = window.MERGENT_TICKETS.list().length;
        root.querySelector("#ticketMeta").textContent = open + " open · " + total + " total";
        root.querySelector("#ticketFoot").textContent = open + " awaiting reply";
        const stat = root.querySelector("#openTicketStat");
        if (stat) stat.textContent = open;
      }
      function bindToggles() {
        root.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
          const id = +b.dataset.toggle;
          const t = window.MERGENT_TICKETS.list().find((x) => x.id === id);
          const next = t && t.status === "open" ? "resolved" : "open";
          window.MERGENT_TICKETS.setStatus(id, next);
          window.APP.flashToast(next === "resolved" ? "Ticket resolved" : "Ticket reopened");
          refreshTickets();
        }));
      }
      refreshTickets();

      /* ---- real users from the server ---- */
      const API = window.MergentAPI;
      const ownerEmail = "xorvion.ai@gmail.com";
      function userStatusOf(u) { return u.disabled ? "disabled" : (u.analysesRun > 0 ? "active" : "idle"); }
      function statusPill(s) {
        if (s === "disabled") return `<span class="sev high">disabled</span>`;
        return `<span class="sev ${s === "active" ? "low" : "med"}" style="${s === "active" ? "color:oklch(0.74 0.15 150);background:oklch(0.74 0.15 150 / .12)" : ""}">${s}</span>`;
      }
      function relIso(iso) { return iso ? rel(new Date(iso).getTime()) : "—"; }

      function renderUsers(list) {
        const body = root.querySelector("#userBody");
        if (!list.length) { body.innerHTML = `<tr><td colspan="7" class="mono muted" style="text-align:center;padding:24px">No users yet — signups will appear here.</td></tr>`; }
        else body.innerHTML = list.map((u) => {
          const owner = u.isAdmin || String(u.email).toLowerCase() === ownerEmail;
          const st = userStatusOf(u);
          const actions = owner
            ? `<span class="mono muted" style="font-size:12px">owner</span>`
            : `<button class="btn btn-ghost" style="padding:6px 11px;font-size:12px" data-disable="${esc(u.email)}" data-now="${u.disabled ? 1 : 0}">${u.disabled ? "Enable" : "Disable"}</button>
               <button class="btn btn-ghost" style="padding:6px 11px;font-size:12px;color:oklch(0.66 0.19 20)" data-del="${esc(u.email)}">Delete</button>`;
          return `<tr data-urow data-email="${esc(u.email)}">
            <td><div class="svc-name" style="gap:11px"><span class="ava" style="width:32px;height:32px;border-radius:9px;font-size:13px">${esc(initial(u.name || u.email))}</span><span><span style="display:block;color:var(--text);font-weight:600;font-size:14px">${esc(u.name || u.email.split("@")[0])}</span><span class="mono muted" style="font-size:11.5px">${esc(u.email)}</span></span></div></td>
            <td>${owner ? `<span class="pill reason">Owner</span>` : `<span class="pill">Member</span>`}</td>
            <td class="mono-cell" style="color:var(--text)">${u.analysesRun || 0}</td>
            <td class="mono-cell muted">${u.loginCount || 0}</td>
            <td class="mono-cell muted">${esc(relIso(u.lastSeen))}</td>
            <td>${statusPill(st)}</td>
            <td style="text-align:right;white-space:nowrap">${actions}</td>
          </tr>`;
        }).join("");

        const active = list.filter((u) => userStatusOf(u) === "active").length;
        root.querySelector("#totalUsers").textContent = list.length;
        root.querySelector("#activeUsers").innerHTML = `${ic("users",13)} ${active} active`;
        root.querySelector("#userMeta").textContent = `${list.length} ${list.length === 1 ? "member" : "members"}`;
        root.querySelector("#userFoot").textContent = `${list.length} ${list.length === 1 ? "member" : "members"}`;
        bindUserActions();
      }

      function bindUserActions() {
        root.querySelectorAll("[data-disable]").forEach((b) => b.addEventListener("click", async () => {
          try { await API.setDisabled(b.dataset.disable, b.dataset.now !== "1"); window.APP.flashToast(b.dataset.now === "1" ? "User enabled" : "User disabled"); loadUsers(); }
          catch (e) { window.APP.flashToast("Action failed"); }
        }));
        root.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
          if (!confirm("Delete " + b.dataset.del + " and all their analyses?")) return;
          try { await API.removeUser(b.dataset.del); window.APP.flashToast("User deleted"); loadUsers(); }
          catch (e) { window.APP.flashToast("Delete failed"); }
        }));
      }

      async function loadUsers() {
        try {
          const { users } = await API.listUsers();
          renderUsers(users || []);
        } catch (e) {
          root.querySelector("#userBody").innerHTML = `<tr><td colspan="7" class="mono muted" style="text-align:center;padding:24px">Could not load users (admin only).</td></tr>`;
        }
      }
      loadUsers();

      const search = root.querySelector("#userSearch");
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        let shown = 0;
        root.querySelectorAll("#userBody [data-urow]").forEach((r) => {
          const hit = !q || r.textContent.toLowerCase().includes(q);
          r.style.display = hit ? "" : "none";
          if (hit) shown++;
        });
        root.querySelector("#userFoot").textContent = shown + (shown === 1 ? " member" : " members");
      });
    },
  };
})();
