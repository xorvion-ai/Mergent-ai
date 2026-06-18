/* ============================================================
   MERGENT APP — backend client + hydration
   - Auth + user tracking via the server.
   - One streaming POST runs the whole analysis; we parse SSE over
     fetch (works on Vercel — single request).
   - Demo data shows for the xorvion admin; other users get their
     own real analyses (and can still run a sample).
   ============================================================ */
(function () {
  "use strict";

  const AUTH_KEY = "mergent-auth";
  const ACTIVE_KEY = "mergent-active";

  function auth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; } }
  function headers(extra) {
    const a = auth();
    return Object.assign({ "x-mergent-email": (a && a.email) || "" }, extra || {});
  }
  async function jget(url) {
    const r = await fetch(url, { headers: headers({ Accept: "application/json" }) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  const API = {
    isAdmin() { const a = auth(); return !!(a && a.isAdmin); },
    email() { const a = auth(); return a && a.email; },

    async login(email, name) {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "login failed");
      return j; // { email, name, isAdmin, disabled }
    },

    get: (id) => jget("/api/analyses/" + id),
    recent: () => jget("/api/analyses"),
    config: () => jget("/api/config"),
    reportUrl: (id, fmt) => "/api/analyses/" + id + "/report?format=" + (fmt || "html"),
    jiraUrl: (id, fmt) => "/api/analyses/" + id + "/jira?format=" + (fmt || "json"),

    // admin
    listUsers: () => jget("/api/admin/users"),
    async setDisabled(email, disabled) {
      const r = await fetch("/api/admin/users/" + encodeURIComponent(email) + "/disabled", {
        method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ disabled }),
      });
      if (!r.ok) throw new Error("failed");
    },
    async removeUser(email) {
      const r = await fetch("/api/admin/users/" + encodeURIComponent(email), { method: "DELETE", headers: headers() });
      if (!r.ok) throw new Error("failed");
    },

    setActive(id) { try { sessionStorage.setItem(ACTIVE_KEY, id); } catch (e) {} },
    getActive() { try { return sessionStorage.getItem(ACTIVE_KEY); } catch (e) { return null; } },
    clearActive() { try { sessionStorage.removeItem(ACTIVE_KEY); } catch (e) {} },

    /**
     * Start an analysis and stream its progress (SSE-over-fetch).
     * payload: { source, url?, sample?, zipFile?, specFiles?[] }
     * handlers: { onStarted(id), onLog(msg), onAgent({id,status,detail}), onDone({id,summary}), onError(msg) }
     */
    async startStream(payload, handlers) {
      const fd = new FormData();
      fd.append("source", payload.source);
      if (payload.url) fd.append("url", payload.url);
      if (payload.sample) fd.append("sample", payload.sample);
      if (payload.zipFile) fd.append("zip", payload.zipFile, payload.zipFile.name);
      (payload.specFiles || []).forEach((f) => fd.append("specs", f, f.name));

      const res = await fetch("/api/analyses", { method: "POST", headers: headers(), body: fd });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "could not start analysis");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop();
        for (const chunk of chunks) dispatch(chunk, handlers);
      }
      if (buf.trim()) dispatch(buf, handlers);
    },
  };

  function dispatch(chunk, h) {
    let event = "message", data = "";
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    let parsed = {};
    try { parsed = JSON.parse(data); } catch (e) { return; }
    if (event === "started" && h.onStarted) h.onStarted(parsed.id);
    else if (event === "log" && h.onLog) h.onLog(parsed.msg);
    else if (event === "agent" && h.onAgent) h.onAgent(parsed);
    else if (event === "done" && h.onDone) h.onDone(parsed);
    else if (event === "error" && h.onError) h.onError(parsed.msg);
  }

  /**
   * Replace window.MERGENT_DATA with the active analysis (if any) and
   * hydrate the dashboard. Non-admins get their own real data; the bundled
   * sample dataset remains as a baseline only for the admin account.
   */
  async function hydrate() {
    const id = API.getActive();
    let loaded = false;
    if (id) {
      try {
        const res = await API.get(id);
        if (res && res.status === "complete" && res.data) {
          window.MERGENT_DATA = Object.assign({}, window.MERGENT_DATA, res.data);
          loaded = true;
        }
      } catch (e) {}
    }
    try {
      const info = await API.recent();
      window.MERGENT_ADMIN = !!info.isAdmin;
      if (window.MERGENT_DATA) {
        if (info.isAdmin) {
          // admin keeps the rich demo dashboard, plus any real recents on top
          if (info.recent && info.recent.length) {
            const demoRows = (window.MERGENT_DATA.recent || []).map((r) => ({ ...r, active: false }));
            window.MERGENT_DATA.recent = info.recent.concat(demoRows).slice(0, 12);
          }
        } else {
          // regular users: only their own real analyses + real rollups, no demo
          window.MERGENT_DATA.recent = info.recent || [];
          window.MERGENT_DATA.realStats = info.stats;
        }
        if (info.samples && info.samples.length) {
          window.MERGENT_DATA.sampleRepos = info.samples.map((s) => ({ name: s.name, langs: s.langs, services: s.services, blurb: s.blurb }));
        }
        window.MERGENT_DATA.mode = info.mode;
        window.MERGENT_DATA.quota = { used: info.quotaUsed, total: info.quotaTotal };
      }
    } catch (e) {}
    return loaded;
  }

  window.MergentAPI = API;
  window.MergentHydrate = hydrate;

  /* ---- real avatar from email (Gravatar; identicon when no photo) ---- */
  function gravatarUrl(email, size) {
    const e = String(email || "").trim().toLowerCase();
    return `https://www.gravatar.com/avatar/${md5(e)}?s=${size || 80}&d=identicon&r=g`;
  }
  // expose an <img> avatar that falls back to an initials tile if the image fails
  window.MergentAvatar = function (email, name, size, extraStyle, photoUrl) {
    const s = size || 40;
    const init = (String(name || email || "M").trim()[0] || "M").toUpperCase();
    const style = `width:${s}px;height:${s}px;${extraStyle || ""}`;
    const src = photoUrl || gravatarUrl(email, s * 2);
    return `<span class="ava" style="${style};overflow:hidden;padding:0">` +
      `<img src="${src}" referrerpolicy="no-referrer" alt="" style="width:100%;height:100%;object-fit:cover;display:block" ` +
      `onerror="this.style.display='none';this.parentNode.textContent='${init}'"/></span>`;
  };
  window.MergentGravatar = gravatarUrl;
  function hashStr(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

  /* compact MD5 (RFC 1321) — for Gravatar hashing only */
  function md5(str) {
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function ac(q, a, b, x, s, t) { a = (((a + q) | 0) + ((x + t) | 0)) | 0; return (((rl(a, s)) + b) | 0); }
    function ff(a, b, c, d, x, s, t) { return ac((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return ac((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return ac(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return ac(c ^ (b | ~d), a, b, x, s, t); }
    function toBytes(s) { const u = unescape(encodeURIComponent(s)); const b = []; for (let i = 0; i < u.length; i++) b.push(u.charCodeAt(i)); return b; }
    function toWords(b) {
      const w = []; for (let i = 0; i < b.length * 8; i += 8) w[i >> 5] |= (b[i / 8] & 0xff) << (i % 32); return w;
    }
    const bytes = toBytes(str); const len = bytes.length * 8; const x = toWords(bytes);
    x[len >> 5] |= 0x80 << (len % 32); x[(((len + 64) >>> 9) << 4) + 14] = len;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const oa = a, ob = b, oc = c, od = d; for (let j = i; j < i + 16; j++) if (x[j] === undefined) x[j] = 0;
      a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586); c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426); c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417); c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101); c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632); c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
      a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083); c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690); c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784); c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463); c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353); c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222); c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835); c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415); c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606); c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744); c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379); c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = (a + oa) | 0; b = (b + ob) | 0; c = (c + oc) | 0; d = (d + od) | 0;
    }
    function toHex(n) { let s = ""; for (let i = 0; i < 4; i++) s += ("0" + ((n >> (i * 8)) & 0xff).toString(16)).slice(-2); return s; }
    return toHex(a) + toHex(b) + toHex(c) + toHex(d);
  }
})();
