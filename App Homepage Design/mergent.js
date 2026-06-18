/* ============================================================
   MERGENT — interactions
   ============================================================ */
(function () {
  "use strict";

  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- THEME ---------- */
  const THEME_KEY = "mergent-theme";
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  (function initTheme() {
    let t = "dark";
    try { t = localStorage.getItem(THEME_KEY) || "dark"; } catch (e) {}
    document.documentElement.setAttribute("data-theme", t);
  })();
  function bindTheme() {
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
      b.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme");
        applyTheme(cur === "dark" ? "light" : "dark");
        window.dispatchEvent(new Event("mergent:theme"));
      });
    });
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ---------- INTERACTIVE LOGO ---------- */
  function buildLogo(el) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 40 40");
    svg.setAttribute("class", "logo-mark");
    svg.style.overflow = "visible";

    const center = { x: 20, y: 20 };
    const outers = [
      { x: 9, y: 10 }, { x: 31, y: 10 }, { x: 9, y: 30 }, { x: 31, y: 30 },
    ];
    // lines
    const lines = outers.map((o) => {
      const ln = document.createElementNS(svgNS, "line");
      ln.setAttribute("stroke", "currentColor");
      ln.setAttribute("stroke-width", "1.4");
      ln.setAttribute("stroke-linecap", "round");
      ln.setAttribute("opacity", "0.45");
      svg.appendChild(ln);
      return ln;
    });
    // outer nodes
    const dots = outers.map(() => {
      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("r", "3.1");
      c.setAttribute("fill", "currentColor");
      c.setAttribute("opacity", "0.85");
      svg.appendChild(c);
      return c;
    });
    // center node
    const core = document.createElementNS(svgNS, "circle");
    core.setAttribute("r", "5");
    core.setAttribute("cx", center.x);
    core.setAttribute("cy", center.y);
    core.setAttribute("fill", "var(--accent)");
    svg.appendChild(core);

    el.innerHTML = "";
    el.appendChild(svg);
    el.style.color = "var(--text)";

    // assemble-on-load: start scattered
    const scatter = outers.map((o, i) => ({
      x: o.x + (Math.cos(i * 1.7) * 22),
      y: o.y + (Math.sin(i * 2.3) * 22),
    }));
    let pointer = null, hovering = false;
    const state = outers.map((o, i) => ({ x: prefersReduced ? o.x : scatter[i].x, y: prefersReduced ? o.y : scatter[i].y }));
    let assembled = prefersReduced;

    function place() {
      outers.forEach((o, i) => {
        let tx = o.x, ty = o.y;
        if (hovering && pointer) {
          tx += (pointer.x - o.x) * 0.28;
          ty += (pointer.y - o.y) * 0.28;
        }
        if (!assembled) { tx = state[i].x; ty = state[i].y; }
        state[i].x = lerp(state[i].x, tx, 0.18);
        state[i].y = lerp(state[i].y, ty, 0.18);
        dots[i].setAttribute("cx", state[i].x);
        dots[i].setAttribute("cy", state[i].y);
        lines[i].setAttribute("x1", center.x);
        lines[i].setAttribute("y1", center.y);
        lines[i].setAttribute("x2", state[i].x);
        lines[i].setAttribute("y2", state[i].y);
      });
      let cx = center.x, cy = center.y;
      if (hovering && pointer) { cx += (pointer.x - center.x) * 0.12; cy += (pointer.y - center.y) * 0.12; }
      core.setAttribute("cx", lerp(parseFloat(core.getAttribute("cx")), cx, 0.18));
      core.setAttribute("cy", lerp(parseFloat(core.getAttribute("cy")), cy, 0.18));
    }
    let raf;
    function loop() { place(); raf = requestAnimationFrame(loop); }
    setTimeout(() => { assembled = true; }, 120);
    loop();

    const host = el.closest(".logo") || el;
    host.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      pointer = { x: ((e.clientX - r.left) / r.width) * 40, y: ((e.clientY - r.top) / r.height) * 40 };
      hovering = true;
    });
    host.addEventListener("pointerleave", () => { hovering = false; pointer = null; });
  }

  /* ---------- GRAPH VIZ (hero meld + before/after) ---------- */
  class GraphViz {
    constructor(canvas, opts) {
      this.cv = canvas;
      this.ctx = canvas.getContext("2d");
      this.opts = opts;
      this.m = opts.mode === "loop" ? 0 : (opts.startM || 0);
      this.targetM = this.m;
      this.t0 = performance.now();
      this.dpr = Math.min(devicePixelRatio || 1, 2);
      this.visible = true;
      this.flowOffset = 0;
      this.resize();
      addEventListener("resize", () => this.resize());
      this._tick = this.tick.bind(this);
      requestAnimationFrame(this._tick);
      try { this.draw(); } catch (e) {}
      if (opts.mode === "loop") {
        const io = new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; });
        io.observe(canvas);
      }
    }
    resize() {
      const r = this.cv.getBoundingClientRect();
      this.W = r.width; this.H = r.height;
      this.cv.width = r.width * this.dpr;
      this.cv.height = r.height * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.opts && this.opts.static) { try { this.draw(); } catch (e) {} }
    }
    cleanRel(node) {
      const L = this.opts.layout || "ring";
      const c = node.cluster;
      if (L === "orbit") { const map = { 4:[.5,.5], 0:[.5,.17], 2:[.83,.5], 3:[.5,.83], 1:[.17,.5] }; return map[c] || [node.kx, node.ky]; }
      if (L === "flow")  { const map = { 4:[.15,.5], 0:[.74,.16], 2:[.74,.39], 1:[.74,.62], 3:[.74,.85] }; return map[c] || [node.kx, node.ky]; }
      return [node.kx, node.ky];
    }
    pos(node, m) {
      const pad = this.opts.pad || 0.13;
      const sx = (rx) => pad * this.W + rx * (1 - 2 * pad) * this.W;
      const sy = (ry) => pad * this.H + ry * (1 - 2 * pad) * this.H;
      const k = this.cleanRel(node);
      const cx = lerp(node.cx, k[0], m);
      const cy = lerp(node.cy, k[1], m);
      return { x: sx(cx), y: sy(cy) };
    }
    tick(now) {
      requestAnimationFrame(this._tick);
      if (this.opts.mode === "loop") {
        if (!this.visible) return;
        if (prefersReduced) { this.m = this.opts.staticM != null ? this.opts.staticM : 1; this.phaseName = "consolidated"; }
        else {
          const dur = this.opts.duration || 13000;
          let p = ((now - this.t0) % dur) / dur; // 0..1
          // phases: chaos hold, scan, meld, clean hold, return
          if (p < 0.10) { this.m = 0; this.phaseName = "scanning dependencies"; this.scan = -1; }
          else if (p < 0.24) { this.m = 0; this.phaseName = "analyzing architecture"; this.scan = (p - 0.10) / 0.14; }
          else if (p < 0.50) { this.m = easeInOut((p - 0.24) / 0.26); this.phaseName = "melding services"; this.scan = -1; }
          else if (p < 0.92) { this.m = 1; this.phaseName = "consolidated · 11 → 4"; this.scan = -1; }
          else { this.m = 1 - easeInOut((p - 0.92) / 0.08); this.phaseName = "re-running analysis"; this.scan = -1; }
        }
        const lbl = this.opts.phaseEl;
        if (lbl && lbl.textContent !== this.phaseName) lbl.textContent = this.phaseName;
      } else {
        this.m = lerp(this.m, this.targetM, prefersReduced ? 1 : 0.10);
      }
      this.flowOffset = (this.flowOffset + 0.6) % 24;
      this.draw();
    }
    C() {
      return {
        accent: cssVar("--accent") || "#4cc",
        warm: cssVar("--warm") || "#e87",
        border: cssVar("--border") || "#333",
        txt: cssVar("--muted") || "#888",
        txt2: cssVar("--text-2") || "#bbb",
        bg: cssVar("--bg-inset") || "#111",
        surf: cssVar("--bg-2") || "#181a1f",
      };
    }
    draw() {
      const ctx = this.ctx, m = this.m, O = this.opts, c = this.C();
      ctx.clearRect(0, 0, this.W, this.H);
      this.drawBackground(ctx, m, c);

      // --- chaos edges (fade out) ---
      const ce = clamp(1 - m * 3.4, 0, 1);
      if (ce > 0.01) {
        O.chaosEdges.forEach((e) => {
          const a = this.pos(O.nodes[e[0]], m), b = this.pos(O.nodes[e[1]], m);
          ctx.beginPath(); ctx.moveTo(a.x, a.y);
          const mx = (a.x + b.x) / 2 + (e[3] || 0), my = (a.y + b.y) / 2 + (e[4] || 0);
          ctx.quadraticCurveTo(mx, my, b.x, b.y);
          ctx.strokeStyle = e[2] === "bad" ? c.warm : c.border;
          ctx.globalAlpha = ce * (e[2] === "bad" ? 0.85 : 0.4);
          ctx.lineWidth = e[2] === "bad" ? 1.7 : 1.0;
          if (e[2] === "bad") ctx.setLineDash([4, 4]);
          ctx.stroke(); ctx.setLineDash([]);
        });
        ctx.globalAlpha = 1;
      }
      // --- clean connectors (fade in) ---
      const fe = clamp((m - 0.42) * 2.4, 0, 1);
      if (fe > 0.01) {
        O.cleanEdges.forEach((e) => {
          const a = this.pos(O.nodes[e[0]], m), b = this.pos(O.nodes[e[1]], m);
          const path = this.connectorPath(a, b, O.connector || "line");
          ctx.beginPath(); this.tracePath(ctx, path);
          ctx.strokeStyle = c.accent; ctx.globalAlpha = fe * 0.5; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.stroke();
          if (!prefersReduced && O.flow !== false) {
            const total = this.pathLength(path);
            for (let d = (this.flowOffset % 26); d < total; d += 26) {
              const pt = this.pointAt(path, d);
              ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.8, 0, 7); ctx.fillStyle = c.accent; ctx.globalAlpha = fe * 0.95; ctx.fill();
            }
          }
        });
        ctx.globalAlpha = 1;
      }
      // --- scan sweep ---
      if (this.scan != null && this.scan >= 0) {
        const x = this.scan * this.W;
        const g = ctx.createLinearGradient(x - 70, 0, x + 10, 0);
        g.addColorStop(0, "transparent"); g.addColorStop(1, c.accent);
        ctx.fillStyle = g; ctx.globalAlpha = 0.16; ctx.fillRect(0, 0, x, this.H);
        ctx.globalAlpha = 0.85; ctx.fillStyle = c.accent; ctx.fillRect(x - 1.5, 0, 2, this.H);
        ctx.globalAlpha = 1;
      }
      // --- nodes: members under, leads over ---
      O.nodes.forEach((n) => { if (!n.lead) this.drawMember(ctx, n, m, c); });
      O.nodes.forEach((n) => { if (n.lead) this.drawLead(ctx, n, m, c); });
    }
    drawMember(ctx, n, m, c) {
      const a = clamp(1 - m * 3.4, 0, 1);
      if (a < 0.02) return;
      const p = this.pos(n, m), r = this.opts.nodeR || 6;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7);
      ctx.fillStyle = c.bg; ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = c.border; ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.42, 0, 7); ctx.fillStyle = c.txt; ctx.globalAlpha = a * 0.5; ctx.fill();
      if (m < 0.22) {
        ctx.font = `${this.opts.font ? this.opts.font - 1 : 10}px JetBrains Mono, monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = c.txt;
        ctx.globalAlpha = a * clamp(1 - m * 4.5, 0, 1);
        ctx.fillText(n.name, p.x, p.y + r + 5);
      }
      ctx.globalAlpha = 1;
    }
    drawLead(ctx, n, m, c) {
      const O = this.opts, p = this.pos(n, m), r = O.nodeR || 6;
      const circleA = 1 - smooth(0.16, 0.40, m);
      const cleanA = smooth(0.50, 0.82, m);
      if (circleA > 0.02) {
        ctx.globalAlpha = circleA;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = c.bg; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = c.accent; ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.42, 0, 7); ctx.fillStyle = c.accent; ctx.fill();
        if (m < 0.22) {
          ctx.font = `${O.font ? O.font - 1 : 10}px JetBrains Mono, monospace`;
          ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = c.txt;
          ctx.globalAlpha = circleA * clamp(1 - m * 4.5, 0, 1);
          ctx.fillText(n.name, p.x, p.y + r + 5);
        }
        ctx.globalAlpha = 1;
      }
      if (cleanA > 0.02) {
        if (O.style === "orb") this.drawOrb(ctx, p, n, cleanA, c);
        else this.drawCard(ctx, p, n, cleanA, c);
      }
    }
    drawCard(ctx, p, n, alpha, c) {
      const O = this.opts, isHub = n.cluster === 4;
      const nameFont = `600 ${O.font || 12}px "Space Grotesk", system-ui, sans-serif`;
      const subFont = `${O.subFont || 10}px JetBrains Mono, monospace`;
      ctx.font = nameFont; const nameW = ctx.measureText(n.kname).width;
      ctx.font = subFont; const subW = n.ksub ? ctx.measureText(n.ksub).width : 0;
      const w = Math.max(nameW, subW) + 46;
      const h = n.ksub ? 48 : 36;
      const x = Math.round(p.x - w / 2), y = Math.round(p.y - h / 2);
      const glow = this.opts.glow != null ? this.opts.glow : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = c.accent; ctx.shadowBlur = (isHub ? 22 : 12) * glow; ctx.shadowOffsetY = 3 * glow;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fillStyle = c.surf; ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 12);
      ctx.globalAlpha = alpha * (isHub ? 0.13 : 0.07) * (0.4 + glow * 0.6); ctx.fillStyle = c.accent; ctx.fill();
      ctx.globalAlpha = alpha; ctx.lineWidth = isHub ? 1.7 : 1.2; ctx.strokeStyle = c.accent; ctx.stroke();
      // status dot
      ctx.beginPath(); ctx.arc(x + 16, p.y, 3.6, 0, 7); ctx.fillStyle = c.accent; ctx.fill();
      ctx.beginPath(); ctx.arc(x + 16, p.y, 6.5, 0, 7); ctx.globalAlpha = alpha * 0.3; ctx.fillStyle = c.accent; ctx.fill(); ctx.globalAlpha = alpha;
      // text
      ctx.textAlign = "left";
      ctx.font = nameFont; ctx.fillStyle = c.accent;
      if (n.ksub) {
        ctx.textBaseline = "alphabetic"; ctx.fillText(n.kname, x + 28, p.y - 2);
        ctx.font = subFont; ctx.fillStyle = c.txt; ctx.textBaseline = "top"; ctx.fillText(n.ksub, x + 28, p.y + 5);
      } else {
        ctx.textBaseline = "middle"; ctx.fillText(n.kname, x + 28, p.y + 1);
      }
      ctx.restore();
    }
    drawOrb(ctx, p, n, alpha, c) {
      const O = this.opts, isHub = n.cluster === 4, R = isHub ? 21 : 15;
      const glow = this.opts.glow != null ? this.opts.glow : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      if (glow > 0.5) { ctx.beginPath(); ctx.arc(p.x, p.y, R + 8, 0, 7); ctx.strokeStyle = c.accent; ctx.globalAlpha = alpha * 0.28; ctx.lineWidth = 1.1; ctx.stroke(); ctx.globalAlpha = alpha; }
      ctx.shadowColor = c.accent; ctx.shadowBlur = (isHub ? 20 : 12) * glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.fillStyle = c.surf; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.globalAlpha = alpha * 0.13 * (0.4 + glow * 0.6); ctx.fillStyle = c.accent; ctx.fill(); ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.6; ctx.strokeStyle = c.accent; ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, isHub ? 5 : 3.6, 0, 7); ctx.fillStyle = c.accent; ctx.fill();
      ctx.font = `600 ${O.font || 11}px "Space Grotesk", system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = c.accent;
      ctx.fillText(n.kname, p.x, p.y + R + 10);
      if (n.ksub) { ctx.font = `${O.subFont || 9}px JetBrains Mono, monospace`; ctx.fillStyle = c.txt; ctx.fillText(n.ksub, p.x, p.y + R + 12 + (O.font || 11)); }
      ctx.restore();
    }
    drawBackground(ctx, m, c) {
      const k = this.opts.bg;
      if (!k) return;
      if (k === "grid") {
        const g = 26; ctx.fillStyle = c.border; ctx.globalAlpha = 0.16;
        for (let x = g; x < this.W; x += g) for (let y = g; y < this.H; y += g) { ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        if (m > 0.4) { const cx = this.W / 2, cy = this.H / 2; const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.W * 0.5); rg.addColorStop(0, c.accent); rg.addColorStop(1, "transparent"); ctx.globalAlpha = (m - 0.4) * 0.12; ctx.fillStyle = rg; ctx.fillRect(0, 0, this.W, this.H); ctx.globalAlpha = 1; }
      } else if (k === "radial") {
        const cx = this.W / 2, cy = this.H / 2;
        ctx.strokeStyle = c.border; ctx.globalAlpha = 0.22;
        [0.18, 0.32, 0.46].forEach((rr) => { ctx.beginPath(); ctx.arc(cx, cy, this.W * rr, 0, 7); ctx.stroke(); });
        ctx.globalAlpha = 1;
        if (!prefersReduced && !this.opts.static) { const ang = (performance.now() / 1500) % (Math.PI * 2); ctx.save(); ctx.globalAlpha = 0.10 * clamp(m + 0.35, 0, 1); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, this.W * 0.5, ang, ang + 0.55); ctx.closePath(); ctx.fillStyle = c.accent; ctx.fill(); ctx.restore(); }
      } else if (k === "lines") {
        ctx.strokeStyle = c.border; ctx.globalAlpha = 0.13;
        for (let x = this.W * 0.1; x < this.W; x += this.W * 0.16) { ctx.beginPath(); ctx.moveTo(x, this.H * 0.06); ctx.lineTo(x, this.H * 0.94); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
    }
    connectorPath(a, b, type) {
      if (type === "elbow") { const mx = (a.x + b.x) / 2; return { type: "poly", pts: [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b] }; }
      if (type === "curve") { const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; const dx = b.x - a.x, dy = b.y - a.y; return { type: "quad", a, c: { x: cx - dy * 0.12, y: cy + dx * 0.12 }, b }; }
      return { type: "line", a, b };
    }
    tracePath(ctx, path) {
      if (path.type === "line") { ctx.moveTo(path.a.x, path.a.y); ctx.lineTo(path.b.x, path.b.y); }
      else if (path.type === "quad") { ctx.moveTo(path.a.x, path.a.y); ctx.quadraticCurveTo(path.c.x, path.c.y, path.b.x, path.b.y); }
      else { ctx.moveTo(path.pts[0].x, path.pts[0].y); for (let i = 1; i < path.pts.length; i++) ctx.lineTo(path.pts[i].x, path.pts[i].y); }
    }
    qpt(a, cc, b, t) { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * cc.x + t * t * b.x, y: u * u * a.y + 2 * u * t * cc.y + t * t * b.y }; }
    pathLength(path) {
      if (path.type === "line") return Math.hypot(path.b.x - path.a.x, path.b.y - path.a.y);
      if (path.type === "poly") { let L = 0; for (let i = 1; i < path.pts.length; i++) L += Math.hypot(path.pts[i].x - path.pts[i - 1].x, path.pts[i].y - path.pts[i - 1].y); return L; }
      let L = 0, prev = path.a; for (let i = 1; i <= 14; i++) { const pt = this.qpt(path.a, path.c, path.b, i / 14); L += Math.hypot(pt.x - prev.x, pt.y - prev.y); prev = pt; } return L;
    }
    pointAt(path, d) {
      if (path.type === "line") { const L = this.pathLength(path) || 1; const t = clamp(d / L, 0, 1); return { x: lerp(path.a.x, path.b.x, t), y: lerp(path.a.y, path.b.y, t) }; }
      if (path.type === "poly") { let rem = d; for (let i = 1; i < path.pts.length; i++) { const seg = Math.hypot(path.pts[i].x - path.pts[i - 1].x, path.pts[i].y - path.pts[i - 1].y); if (rem <= seg) { const t = rem / seg; return { x: lerp(path.pts[i - 1].x, path.pts[i].x, t), y: lerp(path.pts[i - 1].y, path.pts[i].y, t) }; } rem -= seg; } return path.pts[path.pts.length - 1]; }
      const L = this.pathLength(path) || 1; return this.qpt(path.a, path.c, path.b, clamp(d / L, 0, 1));
    }
  }

  // shared node set (microservices → consolidated)
  function makeNodes() {
    // cx,cy = chaos rel pos ; kx,ky = clean rel pos ; cluster lead carries kname
    return [
      { name: "auth-service",     cx: .18, cy: .20, kx: .20, ky: .22, cluster: 0, lead: true,  kname: "identity-service", ksub: "auth · admin · profile" },
      { name: "admin-service",    cx: .46, cy: .11, kx: .20, ky: .22, cluster: 0 },
      { name: "profile-service",  cx: .74, cy: .18, kx: .20, ky: .22, cluster: 0 },
      { name: "user-service",     cx: .13, cy: .54, kx: .20, ky: .78, cluster: 1, lead: true,  kname: "user-service", ksub: "user · account" },
      { name: "account-service",  cx: .40, cy: .46, kx: .20, ky: .78, cluster: 1 },
      { name: "billing-service",  cx: .85, cy: .44, kx: .80, ky: .22, cluster: 2, lead: true,  kname: "billing-service", ksub: "billing · payment" },
      { name: "payment-service",  cx: .66, cy: .58, kx: .80, ky: .22, cluster: 2 },
      { name: "notification-svc", cx: .22, cy: .84, kx: .80, ky: .78, cluster: 3, lead: true,  kname: "messaging-service", ksub: "notif · email · sms" },
      { name: "email-service",    cx: .52, cy: .82, kx: .80, ky: .78, cluster: 3 },
      { name: "sms-service",      cx: .80, cy: .80, kx: .80, ky: .78, cluster: 3 },
      { name: "api-gateway",      cx: .50, cy: .35, kx: .50, ky: .50, cluster: 4, lead: true,  kname: "api-gateway", ksub: "ingress · routing" },
    ];
  }
  const CHAOS_EDGES = [
    [0,4],[4,1],[1,2],[2,5],[5,6],[6,4],[3,4],[3,7],[7,8],[8,9],[9,5],
    [10,1],[10,4],[10,6],[0,3],
    [2,6,"bad"],[7,9,"bad"],[0,2,"bad"],[5,8,"bad"],
  ];
  const CLEAN_EDGES = [[10,0],[10,3],[10,5],[10,7]];
  window.MergentGraph = GraphViz;
  window.MergentGraphData = { makeNodes, CHAOS_EDGES, CLEAN_EDGES };

  /* ---------- AGENT PIPELINE (working animation) ---------- */
  const AGENTS = [
    { n: "Service Discovery",  role: "parse",  run: "scanning build files\u2026",     done: "11 services · 4 languages" },
    { n: "Dependency Mapping", role: "reason", run: "tracing service calls\u2026",     done: "28 edges · 2 cycles" },
    { n: "API Analysis",       role: "reason", run: "normalizing endpoints\u2026",     done: "94 endpoints · 9 duplicates" },
    { n: "Database Analysis",  role: "reason", run: "inventorying datastores\u2026",   done: "7 stores · 3 mergeable" },
    { n: "Migration Strategy", role: "reason", run: "planning target arch\u2026",      done: "11 → 4 services" },
    { n: "Risk Analysis",      role: "reason", run: "classifying risks\u2026",         done: "3 high · 5 medium" },
    { n: "Documentation",      role: "parse",  run: "writing report\u2026",            done: "report + 14 Jira tasks" },
  ];
  window.MergentAgents = AGENTS;

  class AgentRunner {
    constructor(opts = {}) {
      this.agents = opts.agents || AGENTS;
      this.onUpdate = opts.onUpdate || function () {};
      this.runMs = opts.runMs || 900;
      this.gapMs = opts.gapMs || 160;
      this.holdMs = opts.holdMs || 2000;
      this.state = this.agents.map(() => ({ status: "queued", prog: 0 }));
      this.i = -1;
    }
    start() {
      if (prefersReduced) { this.state.forEach((s) => { s.status = "done"; s.prog = 1; }); this.onUpdate(this.state, -2); return; }
      this.i = -1; this.next();
    }
    next() {
      this.i++;
      if (this.i >= this.agents.length) { this.onUpdate(this.state, -1); this._t = setTimeout(() => this.reset(), this.holdMs); return; }
      const idx = this.i; this.state[idx].status = "running"; this.onUpdate(this.state, idx, "start");
      const t0 = performance.now();
      const tick = (now) => {
        const p = clamp((now - t0) / this.runMs, 0, 1); this.state[idx].prog = p; this.onUpdate(this.state, idx);
        if (p < 1) this._raf = requestAnimationFrame(tick);
        else { this.state[idx].status = "done"; this.onUpdate(this.state, idx, "done"); this._t = setTimeout(() => this.next(), this.gapMs); }
      };
      this._raf = requestAnimationFrame(tick);
    }
    reset() { this.state = this.agents.map(() => ({ status: "queued", prog: 0 })); this.onUpdate(this.state, -3); this.next(); }
    stop() { cancelAnimationFrame(this._raf); clearTimeout(this._t); }
  }
  window.MergentAgentRunner = AgentRunner;

  function buildAgentPanel(el, opts) {
    opts = opts || {};
    const agents = opts.agents || AGENTS;
    el.classList.add("agent-panel");
    el.innerHTML =
      '<div class="ap-head"><span class="ap-title">' + (opts.title || "Analysis pipeline") + '</span><span class="ap-meta mono">7 agents</span></div>' +
      '<div class="ap-rows"></div>' +
      '<div class="ap-foot"><div class="ap-track"><div class="ap-fill"></div></div><span class="ap-status mono">initializing\u2026</span></div>';
    const rowsEl = el.querySelector(".ap-rows");
    const rows = agents.map((a) => {
      const r = document.createElement("div"); r.className = "ap-row"; r.dataset.status = "queued";
      r.innerHTML =
        '<span class="ap-dot"></span>' +
        '<div class="ap-body"><div class="ap-line"><span class="ap-name">' + a.n + '</span><span class="ap-detail mono">queued</span></div><div class="ap-bar"><div class="ap-bar-fill"></div></div></div>' +
        '<span class="ap-badge mono">' + a.role + '</span>';
      rowsEl.appendChild(r); return r;
    });
    const fill = el.querySelector(".ap-fill"), statusEl = el.querySelector(".ap-status");
    const runner = new AgentRunner(Object.assign({}, opts, { agents, onUpdate: (state, active, phase) => {
      let doneCount = 0;
      state.forEach((s, i) => {
        const r = rows[i]; r.dataset.status = s.status;
        const detail = r.querySelector(".ap-detail"), barf = r.querySelector(".ap-bar-fill");
        if (s.status === "queued") { detail.textContent = "queued"; barf.style.width = "0%"; }
        else if (s.status === "running") { detail.textContent = agents[i].run; barf.style.width = (s.prog * 100) + "%"; }
        else { detail.textContent = agents[i].done; barf.style.width = "100%"; doneCount++; }
      });
      fill.style.width = (doneCount / agents.length * 100) + "%";
      if (active === -1 || active === -2) statusEl.textContent = "analysis complete · 11 → 4";
      else if (active >= 0) statusEl.textContent = "running · " + agents[active].n;
      else statusEl.textContent = "initializing\u2026";
      if (opts.hook) opts.hook(state, active, phase);
    }}));
    return runner;
  }
  window.buildAgentPanel = buildAgentPanel;

  function initHeroViz() {
    const cv = document.getElementById("heroCanvas");
    if (!cv) return;
    new GraphViz(cv, {
      mode: "loop", duration: 13000, style: "card", layout: "ring", bg: null, connector: "line",
      glow: 0.28, flow: true, nodeR: 6, font: 12.5, subFont: 10, pad: 0.17,
      nodes: makeNodes(), chaosEdges: CHAOS_EDGES, cleanEdges: CLEAN_EDGES,
      phaseEl: document.getElementById("vizPhase"),
    });
  }

  /* ---------- BEFORE / AFTER ---------- */
  function initBeforeAfter() {
    const cv = document.getElementById("baCanvas");
    if (!cv) return;
    const viz = new GraphViz(cv, {
      mode: "manual", startM: 0, style: "card", layout: "ring", bg: null, connector: "line",
      glow: 0.3, flow: true, nodeR: 6, font: 13, subFont: 10.5, pad: 0.15,
      nodes: makeNodes(), chaosEdges: CHAOS_EDGES, cleanEdges: CLEAN_EDGES,
    });
    const readout = {
      before: { services: 11, deps: 28, dup: 9, db: 7 },
      after:  { services: 4, deps: 6, dup: 0, db: 3 },
    };
    function setReadout(state) {
      const d = readout[state];
      document.querySelectorAll("[data-ro]").forEach((el) => {
        const k = el.getAttribute("data-ro");
        el.textContent = d[k];
        el.style.color = state === "after" && (k === "dup" || k === "deps")
          ? "var(--accent)" : (state === "before" && k !== "services" ? "var(--warm)" : "");
      });
    }
    const btns = document.querySelectorAll("[data-ba]");
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const state = b.getAttribute("data-ba");
      viz.targetM = state === "after" ? 1 : 0;
      setReadout(state);
    }));
    setReadout("before");
  }

  /* ---------- LOGIN AUTH ANIMATED ASIDE ---------- */
  function initAuthAside() {
    const cv = document.getElementById("authCanvas");
    if (!cv) return;
    new GraphViz(cv, {
      static: true, startM: 1, style: "orb", layout: "orbit", bg: "radial", connector: "line",
      glow: 0.34, flow: true, nodeR: 5, font: 12, subFont: 9.5, pad: 0.2,
      nodes: makeNodes(), chaosEdges: CHAOS_EDGES, cleanEdges: CLEAN_EDGES,
    });
  }

  /* ---------- PIPELINE SEQUENCER ---------- */
  function initPipeline() {
    const pipe = document.getElementById("pipe");
    if (!pipe) return;
    const agents = [...pipe.querySelectorAll(".agent")];
    const fill = pipe.querySelector(".pipe-line .fill");
    let started = false, timer;
    function run() {
      let i = 0;
      const step = () => {
        agents.forEach((a, k) => a.classList.toggle("on", k <= i));
        if (fill) fill.style.width = ((i + 1) / agents.length * 100) + "%";
        i++;
        if (i < agents.length) timer = setTimeout(step, 520);
        else timer = setTimeout(() => { agents.forEach((a) => a.classList.remove("on")); if (fill) fill.style.width = "0%"; timer = setTimeout(step, 700); }, 2400);
      };
      step();
    }
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !started) { started = true; if (prefersReduced) { agents.forEach(a => a.classList.add("on")); if (fill) fill.style.width = "100%"; } else run(); }
    }, { threshold: 0.4 });
    io.observe(pipe);
  }

  /* ---------- SCROLL REVEAL ---------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- NAV ---------- */
  function initNav() {
    const nav = document.querySelector(".nav");
    if (nav) {
      const onScroll = () => nav.classList.toggle("scrolled", scrollY > 8);
      onScroll(); addEventListener("scroll", onScroll, { passive: true });
    }
    const burger = document.querySelector(".nav-burger");
    const menu = document.querySelector(".mobile-menu");
    if (burger && menu) {
      burger.addEventListener("click", () => menu.classList.toggle("open"));
      menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => menu.classList.remove("open")));
    }
  }

  /* ---------- LEGAL TOC ---------- */
  function initLegalToc() {
    const toc = document.querySelector(".legal-toc");
    if (!toc) return;
    const links = [...toc.querySelectorAll("a")];
    const secs = links.map((l) => document.querySelector(l.getAttribute("href"))).filter(Boolean);
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    secs.forEach((s) => io.observe(s));
  }

  /* ---------- FORM (demo) ---------- */
  function initForms() {
    document.querySelectorAll("[data-demo-form]").forEach((f) => {
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const btn = f.querySelector("[type=submit]");
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = "Sent ✓"; btn.disabled = true;
        setTimeout(() => { btn.textContent = orig; btn.disabled = false; f.reset(); }, 2200);
      });
    });
  }

  /* ---------- TWEAKS PANEL ---------- */
  const TWEAK_KEY = "mergent-tweaks";
  function initTweaks() {
    const panel = document.getElementById("tweaks");
    if (!panel) return;
    let state = { accent: null, motion: "on", headline: null };
    try { state = Object.assign(state, JSON.parse(localStorage.getItem(TWEAK_KEY) || "{}")); } catch (e) {}

    const accents = {
      cyan: "199", azure: "230", violet: "285", emerald: "165", amber: "70",
    };
    function applyAccent(hue) {
      if (!hue) { document.documentElement.style.removeProperty("--accent"); document.documentElement.style.removeProperty("--accent-2"); return; }
      const dark = document.documentElement.getAttribute("data-theme") !== "light";
      document.documentElement.style.setProperty("--accent", `oklch(${dark ? "0.81 0.13" : "0.56 0.13"} ${hue})`);
      document.documentElement.style.setProperty("--accent-2", `oklch(${dark ? "0.70 0.135" : "0.50 0.13"} ${parseFloat(hue) + 14})`);
    }
    function applyMotion(v) {
      document.body.classList.toggle("no-motion", v === "off");
    }
    function applyHeadline(v) {
      const h = document.querySelector("[data-headline]");
      if (h && v) h.textContent = v;
    }
    function save() { try { localStorage.setItem(TWEAK_KEY, JSON.stringify(state)); } catch (e) {} }

    // build swatches
    const swRow = panel.querySelector("[data-sw-row]");
    if (swRow) {
      Object.entries(accents).forEach(([name, hue]) => {
        const s = document.createElement("div");
        s.className = "sw"; s.title = name;
        s.style.background = `oklch(0.78 0.14 ${hue})`;
        s.addEventListener("click", () => {
          state.accent = hue; applyAccent(hue); save();
          swRow.querySelectorAll(".sw").forEach((x) => x.classList.remove("sel"));
          s.classList.add("sel");
        });
        if (state.accent === hue) s.classList.add("sel");
        swRow.appendChild(s);
      });
    }
    // motion segment
    panel.querySelectorAll("[data-motion]").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-motion") === state.motion);
      b.addEventListener("click", () => {
        state.motion = b.getAttribute("data-motion");
        panel.querySelectorAll("[data-motion]").forEach((x) => x.classList.toggle("on", x === b));
        applyMotion(state.motion); save();
      });
    });
    // headline input
    const hi = panel.querySelector("[data-headline-input]");
    if (hi) {
      if (state.headline) hi.value = state.headline;
      hi.addEventListener("input", () => { state.headline = hi.value; applyHeadline(hi.value); save(); });
    }

    if (state.accent) applyAccent(state.accent);
    applyMotion(state.motion);
    if (state.headline) applyHeadline(state.headline);
    window.addEventListener("mergent:theme", () => { if (state.accent) applyAccent(state.accent); });

    // host protocol
    function setOpen(open) { panel.classList.toggle("show", open); }
    window.addEventListener("message", (e) => {
      const d = e.data || {};
      if (d.type === "tweaks:toggle" || d.type === "toggleTweaks") setOpen(!!d.open);
      if (d.type === "tweaks:open") setOpen(true);
      if (d.type === "tweaks:close") setOpen(false);
    });
    const tb = document.getElementById("tweaksBtn");
    if (tb) tb.addEventListener("click", () => setOpen(!panel.classList.contains("show")));
  }

  /* ---------- BOOT ---------- */
  function boot() {
    bindTheme();
    document.querySelectorAll("[data-logo]").forEach(buildLogo);
    initHeroViz();
    initBeforeAfter();
    initAuthAside();
    initPipeline();
    initReveal();
    initNav();
    initLegalToc();
    initForms();
    initTweaks();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
