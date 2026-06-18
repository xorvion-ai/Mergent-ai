/* ============================================================
   Mergent AI — 7-agent pipeline
   Each agent: deterministic PARSE (facts already extracted) →
   Gemini REASON over those facts → validated structured output.
   Emits live progress; assembles the full analysis object in the
   exact shape the frontend (window.MERGENT_DATA) consumes.
   ============================================================ */
import { reason, usage } from "../llm/provider.js";
import {
  assignDomains, buildTargets, findOverlaps, buildDbMerges,
  buildMigration, deriveRisks, buildJira,
} from "./heuristics.js";

const AGENTS = [
  { n: 1, id: "discovery", name: "Service Discovery", role: "parse", run: "scanning build files & Dockerfiles…" },
  { n: 2, id: "deps", name: "Dependency Mapping", role: "reason", run: "tracing inter-service calls…" },
  { n: 3, id: "apis", name: "API Analysis", role: "reason", run: "normalizing endpoints…" },
  { n: 4, id: "db", name: "Database Analysis", role: "reason", run: "inventorying datastores…" },
  { n: 5, id: "strategy", name: "Migration Strategy", role: "reason", run: "planning target architecture…" },
  { n: 6, id: "risk", name: "Risk Analysis", role: "reason", run: "classifying risks…" },
  { n: 7, id: "docs", name: "Documentation", role: "parse", run: "writing report & backlog…" },
];

const isArr = (x) => Array.isArray(x);

/**
 * @param facts  output of extractFacts()
 * @param emit   (event, data) => void  — SSE bridge
 */
export async function runAnalysis(facts, emit = () => {}) {
  const log = (msg) => emit("log", { msg });
  const startAgent = (a) => emit("agent", { id: a.id, n: a.n, status: "running", detail: a.run });
  const doneAgent = (a, detail) => emit("agent", { id: a.id, n: a.n, status: "done", detail });

  const services = facts.services.map((s) => ({ ...s }));

  /* ---- Agent 1: Service Discovery ---- */
  let a = AGENTS[0]; startAgent(a);
  const domainHeur = assignDomains(services);
  const disc = await reason("discovery", {
    instruction:
      "For each service, infer a short human-readable business domain and a confidence (0–1). " +
      'Return {"services":[{"id":string,"domain":string,"confidence":number}]} covering every service id.',
    facts: { services: services.map((s) => ({ id: s.id, lang: s.lang, framework: s.framework, endpoints: s.endpoints, db: s.db })) },
    validate: (o) => o && isArr(o.services) && o.services.length === services.length && o.services.every((x) => x.id && x.domain),
    fallback: () => ({ services: services.map((s) => ({ id: s.id, domain: domainHeur.get(s.id).domain, confidence: domainHeur.get(s.id).confidence })) }),
  }, log);
  const discById = new Map(disc.services.map((s) => [s.id, s]));
  for (const s of services) {
    const d = discById.get(s.id) || {};
    s.domain = d.domain || domainHeur.get(s.id).domain;
    s.confidence = clamp01(d.confidence ?? domainHeur.get(s.id).confidence);
  }
  doneAgent(a, `${services.length} services · ${facts.repo.languages.length} languages`);

  /* ---- Agent 2: Dependency Mapping ---- */
  a = AGENTS[1]; startAgent(a);
  if (a.role === "reason") log("↳ reason gemini judging over facts…");
  const dependencies = { edges: facts.dependencies.edges, cycles: facts.dependencies.cycles };
  if (dependencies.cycles.length) {
    const cy = await reason("deps", {
      instruction:
        "Given dependency edges and detected cycles, write a one-sentence explanation for each cycle and a severity (high|med|low). " +
        'Return {"cycles":[{"path":[string],"severity":string,"note":string}]} preserving the given cycle paths.',
      facts: { edges: dependencies.edges, cycles: dependencies.cycles },
      validate: (o) => o && isArr(o.cycles) && o.cycles.length === dependencies.cycles.length && o.cycles.every((c) => c.note),
      fallback: () => ({ cycles: dependencies.cycles.map((c) => ({ path: c.path, severity: c.severity, note: `Cycle across ${c.path.join(" → ")}: members cannot be deployed independently.` })) }),
    }, log);
    dependencies.cycles = dependencies.cycles.map((c, i) => ({ ...c, severity: cy.cycles[i]?.severity || c.severity, note: cy.cycles[i]?.note || "" }));
  }
  doneAgent(a, `${dependencies.edges.length} edges · ${dependencies.cycles.length} cycles`);

  /* ---- Agent 3: API Analysis ---- */
  a = AGENTS[2]; startAgent(a);
  log("↳ reason gemini judging over facts…");
  const overlapHeur = findOverlaps(facts.endpoints);
  const apiRes = await reason("apis", {
    instruction:
      "Given a list of endpoints across services, identify groups of duplicate or semantically-equivalent endpoints across DIFFERENT services. " +
      'Return {"overlaps":[{"id":string,"verb":string,"path":string,"kind":string,"services":[string],"note":string,"severity":"high|med|low"}]}. ' +
      "kind ∈ {Exact duplicate, Semantic duplicate, Overlapping, Conflicting}. Only include groups spanning 2+ services.",
    facts: { endpoints: facts.endpoints },
    validate: (o) => o && isArr(o.overlaps) && o.overlaps.every((g) => g.services && g.services.length >= 2 && g.severity),
    fallback: () => ({ overlaps: overlapHeur }),
  }, log);
  const apiOverlaps = apiRes.overlaps.length ? apiRes.overlaps : overlapHeur;
  const apiStats = {
    total: facts.endpointStats.total,
    byVerb: facts.endpointStats.byVerb,
    duplicates: apiOverlaps.length,
    clean: Math.max(0, facts.endpointStats.total - apiOverlaps.length),
  };
  doneAgent(a, `${apiStats.total} endpoints · ${apiOverlaps.length} duplicates`);

  /* ---- Agent 4: Database Analysis ---- */
  a = AGENTS[3]; startAgent(a);
  log("↳ reason gemini judging over facts…");
  const databases = facts.databases.map((d) => ({ ...d }));
  const dbMergeHeur = buildDbMerges(databases, services, domainHeur); // also sets db.target
  const dbRes = await reason("db", {
    instruction:
      "Given databases (engine, owner, tables) and their proposed merge targets, refine each merge with a clear rationale note and severity. " +
      'Return {"merges":[{"target":string,"engine":string,"from":[string],"conflict":string,"note":string,"severity":"high|med|low"}]}.',
    facts: { databases, proposedMerges: dbMergeHeur },
    validate: (o) => o && isArr(o.merges) && o.merges.every((m) => m.target && isArr(m.from) && m.note),
    fallback: () => ({ merges: dbMergeHeur }),
  }, log);
  const dbMerges = dbRes.merges.length ? dbRes.merges : dbMergeHeur;
  doneAgent(a, `${databases.length} stores · ${dbMerges.length} mergeable`);

  /* ---- Agent 5: Migration Strategy ---- */
  a = AGENTS[4]; startAgent(a);
  log("↳ reason gemini judging over facts…");
  const targets = buildTargets(services, domainHeur, databases); // assigns service.target
  const migHeur = buildMigration(services, targets, dependencies.cycles, dbMerges);
  const migRes = await reason("strategy", {
    instruction:
      "Given the current services, the proposed target services, detected cycles and DB merges, produce a migration strategy. " +
      'Return {"rationale":string,"phases":[{"n":number,"title":string,"risk":"high|med|low","weeks":string,"services":[string],"steps":[string]}],"totalWeeks":string}. ' +
      "Order phases by dependency safety: break cycles first, merge leaf domains toward owners, collapse shared DBs last.",
    facts: { services: services.map((s) => ({ id: s.id, target: s.target })), targets, cycles: dependencies.cycles, dbMerges },
    validate: (o) => o && o.rationale && isArr(o.phases) && o.phases.length >= 1 && o.phases.every((p) => p.title && isArr(p.steps)),
    fallback: () => migHeur,
  }, log);
  const migration = migRes.phases ? migRes : migHeur;
  doneAgent(a, `${services.length} → ${targets.length || 1} services`);

  /* ---- Agent 6: Risk Analysis ---- */
  a = AGENTS[5]; startAgent(a);
  log("↳ reason gemini judging over facts…");
  const riskHeur = deriveRisks(facts, apiOverlaps, dbMerges);
  const riskRes = await reason("risk", {
    instruction:
      "Given derived risk signals (shared DBs, cycles, duplicate APIs, engine mismatches, stateful/leaf services), produce a risk register. " +
      'Return {"risks":[{"id":string,"level":"high|med|low","title":string,"signal":string,"impact":string,"mitigation":string}]}.',
    facts: { signals: riskHeur.map((r) => ({ signal: r.signal, title: r.title })), cycles: dependencies.cycles, sharedDb: facts.dependencies.edges.filter((e) => e.type === "shared-db"), duplicateGroups: apiOverlaps.length },
    validate: (o) => o && isArr(o.risks) && o.risks.length >= 1 && o.risks.every((r) => r.level && r.title && r.impact),
    fallback: () => ({ risks: riskHeur }),
  }, log);
  const risks = riskRes.risks.length ? riskRes.risks : riskHeur;
  const risksHigh = risks.filter((r) => r.level === "high").length;
  const risksMed = risks.filter((r) => r.level === "med").length;
  const risksLow = risks.filter((r) => r.level === "low").length;
  doneAgent(a, `${risksHigh} high · ${risksMed} medium · ${risksLow} low`);

  /* ---- Agent 7: Documentation / Jira ---- */
  a = AGENTS[6]; startAgent(a);
  const jiraHeur = buildJira(migration, risks);
  const jiraRes = await reason("docs", {
    instruction:
      "Given migration phases and risks, produce a Jira-ready backlog. " +
      'Return {"jira":[{"key":string,"title":string,"epic":string,"priority":"Highest|High|Medium|Low","points":number,"status":"To Do","deps":[string],"desc":string}]}. ' +
      "Use keys MIG-1, MIG-2, … and set deps to earlier MIG keys where ordering matters.",
    facts: { phases: migration.phases, risks: risks.map((r) => ({ id: r.id, level: r.level, title: r.title })) },
    validate: (o) => o && isArr(o.jira) && o.jira.length >= 1 && o.jira.every((t) => t.key && t.title),
    fallback: () => ({ jira: jiraHeur }),
  }, log);
  const jira = jiraRes.jira.length ? jiraRes.jira : jiraHeur;
  doneAgent(a, `report + ${jira.length} Jira tasks`);

  /* ---- assemble summary ---- */
  const dbTargets = new Set(databases.map((d) => d.target).filter(Boolean));
  const summary = {
    servicesBefore: services.length,
    servicesAfter: (targets.length || 0) + (services.some((s) => s.target === "platform-ingress") ? 1 : 0) || services.length,
    depsBefore: dependencies.edges.length,
    depsAfter: Math.max(targets.length, 1),
    dupApis: apiOverlaps.length,
    endpoints: apiStats.total,
    dbBefore: databases.length,
    dbAfter: dbTargets.size || databases.length,
    risksHigh, risksMed, risksLow,
    cyclesFound: dependencies.cycles.length,
    durationSec: 0,
    quotaUsed: usage.calls,
    quotaTotal: usage.budget,
    mode: usage.mode,
  };

  return {
    repo: { ...facts.repo, scannedAt: null, commit: facts.repo.commit || "" },
    summary,
    services: services.map((s) => ({
      id: s.id, lang: s.lang, framework: s.framework, port: s.port, files: s.files,
      loc: s.loc, endpoints: s.endpoints, db: s.db, domain: s.domain,
      target: s.target || null, confidence: s.confidence,
    })),
    targets,
    dependencies,
    apiOverlaps,
    apiStats,
    databases,
    dbMerges,
    migration,
    risks,
    jira,
    agents: AGENTS,
  };
}

function clamp01(n) {
  n = Number(n);
  if (!isFinite(n)) return 0.85;
  if (n > 1) n = n / 100;
  return Math.max(0.5, Math.min(0.99, +n.toFixed(2)));
}

export { AGENTS };
