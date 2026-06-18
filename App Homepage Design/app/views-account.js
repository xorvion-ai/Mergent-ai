/* MERGENT APP — account views: Profile · Customer support */
(function () {
  "use strict";
  const VIEWS = (window.VIEWS = window.VIEWS || {});
  const ic = window.IC;
  const D = () => window.MERGENT_DATA;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const A = () => (window.APP && window.APP.auth) || { name: "Member", email: "", isAdmin: false };
  const orgFrom = (a) => a.isAdmin ? "Xorvion" : ((String(a.email).split("@")[1] || "").split(".")[0].replace(/\b\w/g, (c) => c.toUpperCase()) || "Workspace");

  /* ============ PROFILE ============ */
  VIEWS.profile = {
    title: "Profile",
    render() {
      const q = D().summary;
      const quota = D().quota || { used: q.quotaUsed, total: q.quotaTotal };
      const pct = quota.total ? Math.round((quota.used / quota.total) * 100) : 0;
      const a = A();
      const role = a.isAdmin ? "Owner" : "Member";
      const org = orgFrom(a);
      const stats = a.isAdmin ? { analyses: 3, services: 26 } : (D().realStats || { analyses: 0, services: 0 });
      const since = a.since ? new Date(a.since) : null;
      const sinceTxt = since ? since.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—";
      const avatar = window.MergentAvatar ? window.MergentAvatar(a.email, a.name, 64, "border-radius:16px;font-size:26px", a.picture) : `<span class="ava" style="width:64px;height:64px;border-radius:16px;font-size:26px">${esc((String(a.name).trim()[0] || "M").toUpperCase())}</span>`;
      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">Account</span><h1>Profile</h1>
            <p class="lead">Your account, workspace and integrations. Mergent runs entirely on free tiers — no card on file.</p>
          </div>

          <div class="card" style="display:flex;align-items:center;gap:20px;padding:26px 28px">
            ${avatar}
            <div style="min-width:0">
              <div style="font-family:var(--font-display);font-weight:600;font-size:22px">${esc(a.name)}</div>
              <div class="muted mono" style="font-size:13.5px;margin-top:2px">${esc(a.email)}</div>
              <div class="flex gap8 mt8"><span class="pill reason">${a.isAdmin ? "Platform engineer" : "Engineer"}</span><span class="pill">Free tier</span><span class="pill">${role}</span></div>
            </div>
            <button class="btn btn-ghost" style="margin-left:auto" data-edit>${ic("edit",16)} Edit profile</button>
          </div>

          <div class="grid g2 mt24" style="align-items:start">
            <div class="card">
              <div class="card-head"><span class="ch-ic">${ic("user",17)}</span><h3>Account details</h3></div>
              <div class="kv-list">
                <div class="kv"><span class="k">Full name</span><span class="v">${esc(a.name)}</span></div>
                <div class="kv"><span class="k">Work email</span><span class="v mono">${esc(a.email)}</span></div>
                <div class="kv"><span class="k">Organization</span><span class="v">${esc(org)}</span></div>
                <div class="kv"><span class="k">Role</span><span class="v">${role}</span></div>
                <div class="kv"><span class="k">Member since</span><span class="v">${esc(sinceTxt)}</span></div>
                <div class="kv" style="border-bottom:none"><span class="k">Time zone</span><span class="v">UTC+05:30 · IST</span></div>
              </div>
            </div>

            <div class="card">
              <div class="card-head"><span class="ch-ic">${ic("zap",17)}</span><h3>Plan &amp; usage</h3><span class="ch-meta">Free tier</span></div>
              <div class="flex center-y" style="justify-content:space-between"><span class="mono muted" style="font-size:13px">Gemini calls today</span><span class="mono" style="font-weight:600">${q.quotaUsed} / ${q.quotaTotal}</span></div>
              <div style="height:8px;border-radius:8px;background:var(--bg-3);overflow:hidden;margin-top:10px"><i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent-2))"></i></div>
              <div class="muted" style="font-size:12.5px;margin-top:8px">${pct}% used · resets at midnight UTC</div>
              <div class="grid g2 mt16" style="gap:12px">
                <div class="stat" style="padding:16px 18px"><div class="k">analyses run</div><div class="v" style="font-size:28px;margin-top:8px">${stats.analyses}</div></div>
                <div class="stat accent" style="padding:16px 18px"><div class="k">services analyzed</div><div class="v" style="font-size:28px;margin-top:8px">${stats.services}</div></div>
              </div>
            </div>
          </div>

          <div class="grid g2 mt24" style="align-items:start">
            <div class="card">
              <div class="card-head"><span class="ch-ic">${ic("github",17)}</span><h3>Connected accounts</h3></div>
              <div class="endpoint-list">
                <div class="flex center-y gap12" style="padding:12px 0;border-bottom:1px solid var(--border)"><span class="ch-ic" style="width:34px;height:34px">${ic("github",17)}</span><div style="flex:1"><div style="font-weight:600;font-size:14px">GitHub</div><div class="muted mono" style="font-size:12px">github.com/xorvion-ai</div></div><span class="sev low" style="background:oklch(0.74 0.15 150 / .12);color:oklch(0.74 0.15 150)">connected</span></div>
                <div class="flex center-y gap12" style="padding:12px 0"><span class="ch-ic" style="width:34px;height:34px;background:var(--bg-3);color:var(--muted)">${ic("kanban",17)}</span><div style="flex:1"><div style="font-weight:600;font-size:14px">Jira</div><div class="muted mono" style="font-size:12px">export-only · simulated</div></div><button class="btn btn-ghost" style="padding:7px 14px;font-size:13px">Connect</button></div>
              </div>
            </div>

            <div class="card">
              <div class="card-head"><span class="ch-ic">${ic("key",17)}</span><h3>API access</h3></div>
              <div class="muted" style="font-size:13.5px;margin-bottom:12px">Use a key to run analyses from CI. Keys are never stored in your repos.</div>
              <div class="flex gap8 center-y">
                <code class="mono" style="flex:1;background:var(--bg-inset);border-radius:var(--r-md);box-shadow:inset 0 0 0 1px var(--border);padding:11px 13px;font-size:12.5px;color:var(--text-2)">mgt_live_••••••••••••••3f9c</code>
                <button class="btn btn-ghost" data-copy-key>${ic("copy",15)}</button>
              </div>
              <button class="btn btn-ghost mt16" data-regen>${ic("refresh",15)} Regenerate key</button>
            </div>
          </div>

          <div class="card mt24" style="border-left:3px solid oklch(0.66 0.19 20)">
            <div class="card-head"><span class="ch-ic" style="background:oklch(0.66 0.19 20 / .12);color:oklch(0.66 0.19 20)">${ic("shield",17)}</span><h3>Danger zone</h3></div>
            <div class="flex center-y gap16 wrap-flex">
              <div style="flex:1;min-width:200px"><div style="font-weight:600;font-size:14px">Sign out of all sessions</div><div class="muted" style="font-size:13px">End every active session for this account.</div></div>
              <button class="btn btn-ghost" data-signout>${ic("logout",15)} Sign out</button>
            </div>
          </div>
        </div>`;
    },
    mount(root) {
      root.querySelector("[data-copy-key]").addEventListener("click", () => { navigator.clipboard && navigator.clipboard.writeText("mgt_live_xxxxxxxxxxxxx3f9c"); window.APP.flashToast("API key copied"); });
      root.querySelector("[data-regen]").addEventListener("click", () => window.APP.flashToast("New key generated"));
      root.querySelector("[data-edit]").addEventListener("click", () => window.APP.flashToast("Profile editing — wire to your backend"));
      root.querySelector("[data-signout]").addEventListener("click", () => window.APP.logout());
    },
  };

  /* ============ CUSTOMER SUPPORT ============ */
  VIEWS.support = {
    title: "Customer support",
    render() {
      const faqs = [
        { q: "What happens when the Gemini free-tier quota runs out?", a: "Mergent degrades gracefully: it shows a clear message and falls back to a bundled sample analysis so a demo never hard-fails. Quota resets at midnight UTC." },
        { q: "Which languages and frameworks are supported?", a: "Spring Boot (Java), Node/Express (TypeScript), FastAPI (Python) and Go are detected via file-pattern heuristics plus LLM code reading. OpenAPI/Swagger specs are accepted as supplementary input." },
        { q: "Can I analyze a private repository?", a: "Public repos need no token. Private-repo support is on the roadmap — the ingestion layer already accepts an optional token so it can be dropped in later." },
        { q: "Do you send my whole codebase to the model?", a: "No. A deterministic parser extracts hard facts (endpoints, dependencies, tables, configs) and only those facts are sent to Gemini for reasoning. Your raw source is never dumped into the model." },
      ];
      return `
        <div class="view-inner view-fade">
          <div class="page-head"><span class="eyebrow">We're here to help</span>
            <div class="head-row"><div><h1>Customer support</h1>
            <p class="lead">Questions about an analysis, the agent pipeline, or a custom deployment? Reach the team or open a ticket — we read every one.</p></div>
            <span class="run-pill complete"><span class="d"></span> all systems operational</span></div>
          </div>

          <div class="grid g3">
            ${chan("mail","Email us","xorvion.ai@gmail.com","Within 1 business day","mailto:xorvion.ai@gmail.com")}
            ${chan("github","GitHub","github.com/xorvion-ai/Mergent-ai","Star or report a bug","https://github.com/xorvion-ai/Mergent-ai")}
            ${chan("book","Documentation","github.com/xorvion-ai/Mergent-ai#readme","Guides &amp; API reference","https://github.com/xorvion-ai/Mergent-ai#readme")}
          </div>

          <div class="intake-grid mt24" style="grid-template-columns:1.3fr 1fr">
            <div class="card">
              <div class="card-head"><span class="ch-ic">${ic("message",17)}</span><h3>Open a ticket</h3></div>
              <form data-support-form>
                <div class="field-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                  <div class="field"><label>Your name</label><input class="input" data-f="name" placeholder="Ada Lovelace" required /></div>
                  <div class="field"><label>Email</label><input class="input" type="email" data-f="email" placeholder="ada@company.com" required /></div>
                </div>
                <div class="field"><label>Subject</label><input class="input" data-f="subject" placeholder="Brief summary…" required /></div>
                <div class="field"><label>Category</label>
                  <select class="input" data-f="category" style="appearance:none;cursor:pointer">
                    <option>Analysis result looks wrong</option>
                    <option>GitHub clone / ingestion</option>
                    <option>Export (report / Jira)</option>
                    <option>Quota &amp; billing</option>
                    <option>Feature request</option>
                    <option>Something else</option>
                  </select>
                </div>
                <div class="field"><label>Message</label><textarea class="textarea" data-f="message" placeholder="Include the repo URL or analysis id if relevant…"></textarea></div>
                <button class="btn btn-primary btn-lg" type="submit">${ic("arrowRight",16)} Submit ticket</button>
                <p class="form-note">Portfolio demo — tickets you submit appear in the owner's admin console.</p>
              </form>
            </div>

            <div>
              <div class="card-head"><span class="ch-ic">${ic("help",17)}</span><h3>FAQ</h3></div>
              <div id="faqList">${faqs.map((f, i) => `
                <div class="contract" data-faq>
                  <div class="co-head" style="padding:14px 18px"><h3 style="font-size:14px;font-weight:600">${esc(f.q)}</h3><span style="margin-left:auto;color:var(--muted)" class="co-chev">${ic("chevronDown",16)}</span></div>
                  <div class="co-body" style="display:none;padding:0 18px 16px"><p class="muted" style="font-size:13.5px;line-height:1.6;margin:0">${esc(f.a)}</p></div>
                </div>`).join("")}</div>
            </div>
          </div>
        </div>`;
    },
    mount(root) {
      root.querySelectorAll("[data-faq] .co-head").forEach((h) => h.addEventListener("click", () => {
        const body = h.nextElementSibling, open = body.style.display !== "none";
        body.style.display = open ? "none" : "block";
        h.querySelector(".co-chev").style.transform = open ? "" : "rotate(180deg)";
      }));
      const form = root.querySelector("[data-support-form]");
      // prefill from the signed-in account
      const a = A();
      if (a) { const n = form.querySelector("[data-f=name]"), em = form.querySelector("[data-f=email]"); if (n && a.name) n.value = a.name; if (em && a.email) em.value = a.email; }
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const val = (k) => { const el = form.querySelector(`[data-f=${k}]`); return el ? el.value.trim() : ""; };
        const cat = val("category");
        const priority = /wrong|quota|billing/i.test(cat) ? "High" : (/feature/i.test(cat) ? "Low" : "Medium");
        if (window.MERGENT_TICKETS) window.MERGENT_TICKETS.add({ name: val("name"), email: val("email"), subject: val("subject"), category: cat, message: val("message"), priority });
        const b = form.querySelector("[type=submit]"); b.textContent = "Submitted ✓"; b.disabled = true;
        window.APP.flashToast("Ticket submitted");
        setTimeout(() => { b.innerHTML = window.IC("arrowRight",16) + " Submit ticket"; b.disabled = false; form.reset(); if (a) { const n = form.querySelector("[data-f=name]"), em = form.querySelector("[data-f=email]"); if (n && a.name) n.value = a.name; if (em && a.email) em.value = a.email; } }, 2200);
      });
    },
  };

  function chan(icon, title, val, sub, href) {
    const valHtml = href
      ? `<a href="${href}" target="_blank" rel="noopener" class="mono" style="font-size:12.5px;color:var(--accent);margin-top:3px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none">${val}</a>`
      : `<div class="mono" style="font-size:12.5px;color:var(--accent);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${val}</div>`;
    return `<div class="card"><div class="flex center-y gap12"><span class="ch-ic">${ic(icon,17)}</span><div style="min-width:0"><div style="font-weight:600;font-size:14.5px">${title}</div>${valHtml}<div class="muted" style="font-size:12px;margin-top:4px">${sub}</div></div></div></div>`;
  }
})();
