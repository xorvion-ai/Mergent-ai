/* ============================================================
   Mergent AI — deterministic reasoning
   Pure functions that turn FACTS into each agent's output shape.
   These are (a) the fallback when no LLM key is set, and (b) the
   candidate signals fed to Gemini so it reasons over structure,
   not raw code.
   ============================================================ */

/* domain buckets by service-name keywords */
const DOMAINS = [
  { key: "identity", label: "Identity, auth, RBAC & profiles", kw: ["auth", "admin", "profile", "identity", "login", "sso", "rbac", "role", "permission"] },
  { key: "core-user", label: "User accounts, lifecycle & entitlements", kw: ["user", "account", "customer", "member", "people"] },
  { key: "commerce", label: "Billing, subscriptions & payments", kw: ["billing", "payment", "invoice", "order", "cart", "checkout", "subscription", "commerce", "pay", "charge", "ledger"] },
  { key: "messaging", label: "Unified notification, email & SMS", kw: ["notification", "notify", "email", "mail", "sms", "message", "push", "alert"] },
];
const INGRESS = { key: "platform-ingress", label: "Ingress, routing & rate limiting", kw: ["gateway", "ingress", "proxy", "edge", "bff", "router"] };

function scoreDomain(id, dom) {
  const name = id.toLowerCase();
  let best = 0;
  for (const k of dom.kw) if (name.includes(k)) best = Math.max(best, k.length);
  return best;
}

export function assignDomains(services) {
  const map = new Map();
  for (const s of services) {
    if (scoreDomain(s.id, INGRESS) > 0) {
      map.set(s.id, { domain: INGRESS.label, key: INGRESS.key, confidence: 0.99 });
      continue;
    }
    let pick = null, pickScore = 0;
    for (const d of DOMAINS) {
      const sc = scoreDomain(s.id, d);
      if (sc > pickScore) { pickScore = sc; pick = d; }
    }
    if (!pick) {
      // unknown: bucket into core-user as a neutral default
      pick = DOMAINS[1]; pickScore = 0;
    }
    const confidence = Math.min(0.99, 0.74 + pickScore * 0.03);
    map.set(s.id, { domain: humanDomain(s.id, pick), key: pick.key, confidence: +confidence.toFixed(2) });
  }
  return map;
}

function humanDomain(id, dom) {
  const n = id.replace(/-service$/, "");
  const labels = {
    identity: `Authentication & identity (${n})`,
    "core-user": `User accounts & lifecycle (${n})`,
    commerce: `Billing & payments (${n})`,
    messaging: `Messaging & delivery (${n})`,
  };
  return labels[dom.key] || `${n} domain`;
}

/** Build target services (Agent 5) and assign service.target. */
export function buildTargets(services, domainMap, databases) {
  const groups = new Map();
  for (const s of services) {
    const d = domainMap.get(s.id);
    if (!groups.has(d.key)) groups.set(d.key, []);
    groups.get(d.key).push(s);
  }
  const targets = [];
  for (const [key, members] of groups) {
    if (key === INGRESS.key) {
      for (const m of members) m.target = "platform-ingress";
      continue;
    }
    if (members.length < 2) {
      // a lone service still maps to a clean target name
      const t = `${key}-service`;
      for (const m of members) m.target = t;
    } else {
      const t = `${key}-service`;
      for (const m of members) m.target = t;
    }
    const lang = topLang(members);
    targets.push({
      id: `${key}-service`,
      from: members.map((m) => m.id),
      domain: DOMAINS.find((d) => d.key === key)?.label || key,
      lang,
      db: `${key.replace(/-/g, "_")}_db`,
      endpoints: members.reduce((n, m) => n + (m.endpoints || 0), 0),
    });
  }
  return targets;
}

function topLang(members) {
  const c = {};
  for (const m of members) c[m.lang] = (c[m.lang] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
}

/* ---- API overlap (Agent 3) ---- */
export function findOverlaps(endpoints) {
  // group by a semantic key: last meaningful path segment + verb family
  const groups = new Map();
  for (const e of endpoints) {
    const key = semanticKey(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const overlaps = [];
  let gid = 1;
  for (const [, eps] of groups) {
    const services = [...new Set(eps.map((e) => e.service))];
    if (services.length < 2) continue;
    const exact = new Set(eps.map((e) => e.method + " " + e.path)).size === 1;
    const verbs = [...new Set(eps.map((e) => e.method))];
    const conflicting = verbs.includes("DELETE") && services.length > 1;
    const paths = [...new Set(eps.map((e) => e.path))].join("  ·  ");
    overlaps.push({
      id: "G" + gid++,
      verb: eps[0].method,
      path: paths,
      kind: conflicting ? "Conflicting" : exact ? "Exact duplicate" : "Semantic duplicate",
      services,
      note: conflicting
        ? "Same resource deleted from multiple services with potentially different cascade behavior — data-integrity risk."
        : exact
        ? "Identical route exposed by multiple services; drift risk on response shape."
        : "Multiple services expose an equivalent capability under different paths.",
      severity: conflicting ? "high" : services.length >= 3 ? "high" : "med",
    });
  }
  return overlaps.sort((a, b) => sev(b.severity) - sev(a.severity));
}

function semanticKey(e) {
  // normalize path params and pick the resource noun
  const segs = e.path.split("/").filter(Boolean).map((s) => (s.startsWith("{") ? "{}" : s));
  const noun = segs.filter((s) => s !== "{}").pop() || "/";
  const singular = noun.replace(/s$/, "").replace(/(login|auth)/, "auth");
  const family = e.method === "GET" ? "read" : e.method === "DELETE" ? "del" : "write";
  return `${family}:${singular}`;
}

const sev = (s) => ({ high: 3, med: 2, low: 1 }[s] || 0);

/* ---- DB merges (Agent 4) ---- */
export function buildDbMerges(databases, services, domainMap) {
  // assign each db a target by the domain of its (first) owner
  for (const db of databases) {
    const firstOwner = String(db.owner).split(" · ")[0];
    const d = domainMap.get(firstOwner);
    db.target = d ? `${d.key.replace(/-/g, "_")}_db` : null;
  }
  const byTarget = new Map();
  for (const db of databases) {
    if (!db.target) continue;
    if (!byTarget.has(db.target)) byTarget.set(db.target, []);
    byTarget.get(db.target).push(db);
  }
  const merges = [];
  for (const [target, dbs] of byTarget) {
    if (dbs.length < 2) continue;
    const conflictTable = sharedTable(dbs);
    const engines = [...new Set(dbs.map((d) => d.engine))];
    merges.push({
      target,
      engine: engines.includes("PostgreSQL") ? "PostgreSQL" : engines[0],
      from: dbs.map((d) => d.id),
      conflict: conflictTable || (engines.length > 1 ? "engine mismatch" : "none"),
      note: conflictTable
        ? `Multiple stores define a \`${conflictTable}\` table. Merge on a canonical key; reconcile divergent columns.`
        : engines.length > 1
        ? `Heterogeneous engines (${engines.join(", ")}). Pick one system of record and migrate the rest.`
        : "Co-locate to remove cross-service joins-over-HTTP.",
      severity: conflictTable ? "high" : engines.length > 1 ? "med" : "low",
    });
  }
  return merges;
}

function sharedTable(dbs) {
  const counts = {};
  for (const db of dbs) for (const t of db.tables || []) counts[t] = (counts[t] || 0) + 1;
  const shared = Object.entries(counts).find(([, n]) => n > 1);
  return shared ? shared[0] : null;
}

/* ---- Migration strategy (Agent 5) ---- */
export function buildMigration(services, targets, cycles, dbMerges) {
  const phases = [];
  let n = 1;
  if (cycles.length) {
    phases.push({
      n: n++, title: "Break circular dependencies", risk: "high", weeks: "1–2",
      services: [...new Set(cycles.flatMap((c) => c.path))],
      steps: [
        "Extract shared contracts so cyclic callers no longer call back synchronously",
        "Replace synchronous callbacks with events on the message bus",
        "Re-run the dependency agent to confirm the cycles are gone",
      ],
    });
  }
  for (const t of targets) {
    if (t.from.length < 2) continue;
    phases.push({
      n: n++, title: `Merge ${t.id.replace(/-service$/, "")} domain`, risk: "med", weeks: "2–3",
      services: t.from,
      steps: [
        `Stand up ${t.id} skeleton (${t.lang})`,
        `Fold ${t.from.join(", ")} behind one boundary`,
        `Consolidate datastores → ${t.db}`,
        "Cut over gateway routes",
      ],
    });
  }
  phases.push({
    n: n++, title: "Thin the gateway & decommission", risk: "low", weeks: "1",
    services: services.filter((s) => s.target === "platform-ingress").map((s) => s.id),
    steps: ["Reduce ingress to routing + auth + rate-limit", "Remove retired routes", "Archive decommissioned services"],
  });
  return {
    rationale:
      "Consolidate the estate into domain-aligned services plus a thin ingress. Sequencing follows the dependency graph: break cycles first, then merge leaf services toward their domain owner, collapsing shared databases last to avoid dual-write windows.",
    phases,
    totalWeeks: `${phases.length * 2}–${phases.length * 3}`,
  };
}

/* ---- Risk register (Agent 6) ---- */
export function deriveRisks(facts, overlaps, dbMerges) {
  const risks = [];
  let n = 1;
  const id = () => "R" + n++;

  // shared DB
  const shared = facts.dependencies.edges.filter((e) => e.type === "shared-db");
  for (const e of shared) {
    risks.push({
      id: id(), level: "high", title: `Shared database between ${e.from} and ${e.to}`, signal: "shared database",
      impact: `${e.from} and ${e.to} read/write the same store; a schema change needs a coordinated, atomic deploy.`,
      mitigation: "Establish a single owner and expose reads via API / read replica during transition.",
    });
  }
  // cycles
  for (const c of facts.dependencies.cycles) {
    risks.push({
      id: id(), level: "high", title: `Circular dependency: ${c.path.join(" → ")}`, signal: "circular dependency",
      impact: "No service in the cycle can be deployed or rolled back independently; failures cascade around the ring.",
      mitigation: "Extract the shared contract and break the cycle before any merge (Phase 1).",
    });
  }
  // duplicate APIs
  const dups = overlaps.length;
  if (dups) {
    risks.push({
      id: id(), level: dups >= 5 ? "high" : "med", title: `${dups} duplicate / equivalent endpoint groups`, signal: "duplicate APIs",
      impact: "Behavioral drift between copies produces inconsistent responses and hard-to-debug failures.",
      mitigation: "Converge on one owner per capability during the domain merges.",
    });
  }
  // engine mismatch merges
  for (const m of dbMerges.filter((x) => /mismatch/.test(x.conflict))) {
    risks.push({
      id: id(), level: "med", title: `Heterogeneous engines merging into ${m.target}`, signal: "schema mismatch",
      impact: `Stores ${m.from.join(", ")} model data differently; a naive merge can lose nested data.`,
      mitigation: "Map documents to a JSONB extension keyed on the canonical id.",
    });
  }
  // low-risk stateless leaf services
  const leaf = facts.services.filter((s) => !facts.dependencies.edges.some((e) => e.from === s.id));
  for (const s of leaf.slice(0, 2)) {
    risks.push({
      id: id(), level: "low", title: `${s.id} is a low-coupling leaf`, signal: "stateless service",
      impact: "Low-risk merge candidate; few inbound dependencies to rewire.", mitigation: "Fold in last.",
    });
  }
  if (!risks.length) {
    risks.push({ id: id(), level: "low", title: "No structural risks detected", signal: "clean", impact: "The estate shows no cycles, shared DBs or duplicate APIs.", mitigation: "Proceed with standard merge sequencing." });
  }
  return risks;
}

/* ---- Jira backlog (Agent 7) ---- */
export function buildJira(migration, risks) {
  const tasks = [];
  let k = 1;
  const prio = { high: "Highest", med: "High", low: "Medium" };
  for (const ph of migration.phases) {
    const epic = ph.title;
    ph.steps.forEach((step, i) => {
      tasks.push({
        key: "MIG-" + k++,
        title: step,
        epic,
        priority: prio[ph.risk] || "Medium",
        points: [3, 5, 8, 13][i % 4],
        status: "To Do",
        deps: tasks.length && i === 0 ? [] : tasks.length ? [tasks[tasks.length - 1].key] : [],
        desc: `${step} — part of phase ${ph.n}: ${ph.title}.`,
      });
    });
  }
  return tasks;
}

export { DOMAINS, INGRESS };
