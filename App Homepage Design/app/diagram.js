/* ============================================================
   MERGENT APP — diagram engine
   Clean, interactive boxes-&-arrows (Mermaid-like) rendered as
   SVG. Used for the architecture before/after centerpiece and
   the full dependency graph. Hover highlights neighbours;
   click fires onNode(id).
   ============================================================ */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const VB_W = 1040, VB_H = 600;
  const BOX_W = 156, BOX_H = 48;

  function el(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // point on a box border heading toward (tx,ty)
  function borderPoint(n, tx, ty) {
    const cx = n.cx, cy = n.cy, hw = n.w / 2, hh = n.h / 2;
    let dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const sx = hw / (Math.abs(dx) || 1e-6), sy = hh / (Math.abs(dy) || 1e-6);
    const s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
  }

  // ---- build the architecture spec (before | after) ----
  const D = () => window.MERGENT_DATA;

  function archSpec(mode) {
    if (mode === "after") {
      const t = D().targets;
      const nodes = [
        { id: "platform-ingress", label: "platform-ingress", sub: "routing · auth · rate-limit", rx: 0.5, ry: 0.12, cls: "hub" },
        { id: t[0].id, label: t[0].id, sub: t[0].domain, rx: 0.17, ry: 0.58, cls: "target" },
        { id: t[1].id, label: t[1].id, sub: t[1].domain, rx: 0.39, ry: 0.58, cls: "target" },
        { id: t[2].id, label: t[2].id, sub: t[2].domain, rx: 0.61, ry: 0.58, cls: "target" },
        { id: t[3].id, label: t[3].id, sub: t[3].domain, rx: 0.83, ry: 0.58, cls: "target" },
      ];
      const edges = [
        { from: "platform-ingress", to: t[0].id, cls: "clean" },
        { from: "platform-ingress", to: t[1].id, cls: "clean" },
        { from: "platform-ingress", to: t[2].id, cls: "clean" },
        { from: "platform-ingress", to: t[3].id, cls: "clean" },
        { from: t[1].id, to: t[0].id, cls: "clean" },
        { from: t[2].id, to: t[3].id, cls: "clean queue" },
      ];
      return { nodes, edges, clusters: [] };
    }
    // before — current sprawl
    const pos = {
      "api-gateway": [0.5, 0.09, "hub"],
      "auth-service": [0.12, 0.30],
      "admin-service": [0.31, 0.21],
      "profile-service": [0.13, 0.55],
      "user-service": [0.5, 0.35],
      "account-service": [0.49, 0.61],
      "billing-service": [0.87, 0.32],
      "payment-service": [0.71, 0.53],
      "notification-service": [0.35, 0.82],
      "email-service": [0.13, 0.83],
      "sms-service": [0.57, 0.85],
    };
    const svcById = {};
    D().services.forEach((s) => (svcById[s.id] = s));
    const nodes = Object.keys(pos).map((id) => {
      const p = pos[id], s = svcById[id];
      return { id, label: id, sub: s ? (s.lang) : "", rx: p[0], ry: p[1], cls: p[2] || "" };
    });
    const edges = D().dependencies.edges.map((e) => ({
      from: e.from, to: e.to,
      cls: e.cycle ? "cycle" : (e.type === "shared-db" ? "shared-db" : (e.type === "queue" ? "queue" : "")),
    }));
    return { nodes, edges, clusters: [] };
  }

  // full dependency graph (same as before, but every node interactive)
  function depSpec() { return archSpec("before"); }

  // ---- render ----
  function render(container, spec, opts) {
    opts = opts || {};
    container.innerHTML = "";
    const svg = el("svg", { viewBox: `0 0 ${VB_W} ${VB_H}`, class: "dg-svg" });

    // marker defs
    const defs = el("defs", {});
    [["arr-d", "var(--border-2)"], ["arr-cycle", "oklch(0.66 0.19 20)"], ["arr-clean", "var(--accent)"], ["arr-warm", "var(--warm)"]].forEach(([id, fill]) => {
      const m = el("marker", { id, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    // dot grid bg
    const g = el("g", { class: "dg-grid" });
    for (let x = 40; x < VB_W; x += 40) for (let y = 40; y < VB_H; y += 40) g.appendChild(el("circle", { cx: x, cy: y, r: 1, fill: "var(--border)", opacity: 0.3 }));
    svg.appendChild(g);

    // resolve node coords
    const byId = {};
    spec.nodes.forEach((n) => {
      n.w = BOX_W; n.h = BOX_H;
      n.cx = n.rx * VB_W; n.cy = n.ry * VB_H;
      byId[n.id] = n;
    });

    // edges layer
    const edgeLayer = el("g", { class: "dg-edges" });
    const edgeEls = [];
    spec.edges.forEach((e) => {
      const a = byId[e.from], b = byId[e.to];
      if (!a || !b) return;
      const p1 = borderPoint(a, b.cx, b.cy), p2 = borderPoint(b, a.cx, a.cy);
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      // gentle bow so parallel edges separate
      const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
      const bow = e.cls && e.cls.indexOf("cycle") >= 0 ? 26 : 14;
      const cxp = mx - (dy / len) * bow, cyp = my + (dx / len) * bow;
      const marker = e.cls && e.cls.indexOf("cycle") >= 0 ? "arr-cycle" : (e.cls && e.cls.indexOf("clean") >= 0 ? "arr-clean" : (e.cls && e.cls.indexOf("shared-db") >= 0 ? "arr-warm" : "arr-d"));
      const path = el("path", {
        d: `M${p1.x} ${p1.y} Q${cxp} ${cyp} ${p2.x} ${p2.y}`,
        class: "dg-edge " + (e.cls || ""),
        "marker-end": e.cls && e.cls.indexOf("shared-db") >= 0 ? "" : `url(#${marker})`,
      });
      path._from = e.from; path._to = e.to;
      edgeLayer.appendChild(path);
      edgeEls.push(path);
    });
    svg.appendChild(edgeLayer);

    // nodes layer
    const nodeLayer = el("g", { class: "dg-nodes" });
    const nodeEls = {};
    spec.nodes.forEach((n) => {
      const grp = el("g", { class: "dg-node " + (n.cls || ""), transform: `translate(${n.cx - n.w / 2}, ${n.cy - n.h / 2})` });
      grp.appendChild(el("rect", { x: 0, y: 0, width: n.w, height: n.h, rx: 11 }));
      grp.appendChild(el("circle", { class: "dg-dot", cx: 16, cy: n.h / 2, r: 4 }));
      const lbl = el("text", { class: "dg-label", x: 30, y: n.sub ? n.h / 2 - 3 : n.h / 2 + 4 });
      lbl.textContent = n.label;
      grp.appendChild(lbl);
      if (n.sub) {
        const sub = el("text", { class: "dg-sub", x: 30, y: n.h / 2 + 12 });
        sub.textContent = n.sub.length > 24 ? n.sub.slice(0, 23) + "…" : n.sub;
        grp.appendChild(sub);
      }
      grp.addEventListener("mouseenter", () => highlight(n.id));
      grp.addEventListener("mouseleave", () => highlight(null));
      grp.addEventListener("click", () => opts.onNode && opts.onNode(n.id));
      nodeLayer.appendChild(grp);
      nodeEls[n.id] = grp;
    });
    svg.appendChild(nodeLayer);

    function highlight(id) {
      if (!id) {
        edgeEls.forEach((p) => p.classList.remove("dim", "hot"));
        Object.values(nodeEls).forEach((g) => g.classList.remove("dim"));
        return;
      }
      const connected = new Set([id]);
      edgeEls.forEach((p) => {
        const on = p._from === id || p._to === id;
        p.classList.toggle("hot", on);
        p.classList.toggle("dim", !on);
        if (on) { connected.add(p._from); connected.add(p._to); }
      });
      Object.entries(nodeEls).forEach(([nid, gEl]) => gEl.classList.toggle("dim", !connected.has(nid)));
    }

    container.appendChild(svg);
    return { highlight, selectNode: (id) => { Object.values(nodeEls).forEach((g) => g.classList.remove("sel")); if (nodeEls[id]) nodeEls[id].classList.add("sel"); } };
  }

  window.MERGENT_DIAGRAM = { render, archSpec, depSpec };
})();
