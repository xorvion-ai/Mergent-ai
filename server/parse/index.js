/* ============================================================
   Mergent AI — fact extraction orchestrator
   Runs every deterministic parser over a repo directory and
   assembles the FACTS bundle. This is the ONLY thing handed to
   the LLM "reason" steps — never raw source.
   ============================================================ */
import path from "node:path";
import { scanRepo } from "./scan.js";
import { detectServices } from "./services.js";
import { extractEndpoints, endpointsFromOpenApi } from "./endpoints.js";
import { extractDatabases } from "./db.js";
import { extractDependencies } from "./deps.js";

/**
 * @param {string} repoDir   extracted/cloned repo root
 * @param {object} meta      { name, url, source, branch }
 * @param {object[]} specs   parsed OpenAPI spec objects (optional)
 * @param {function} onLog   progress logger
 * @returns facts bundle
 */
export function extractFacts(repoDir, meta = {}, specs = [], onLog = () => {}) {
  onLog(`scanning files…`);
  const { files, totalBytes } = scanRepo(repoDir);

  onLog(`detecting services…`);
  const services = detectServices({ files });

  onLog(`extracting datastores…`);
  const { databases, dbByService } = extractDatabases(services);

  onLog(`extracting endpoints…`);
  const endpoints = [];
  for (const s of services) {
    const eps = extractEndpoints(s);
    s.endpoints = eps.length;
    s.db = dbByService.get(s.id) || null;
    endpoints.push(...eps);
  }
  // OpenAPI specs add endpoints (attribute to best-guess service or "spec")
  for (const spec of specs) {
    endpoints.push(...endpointsFromOpenApi(spec, guessSpecService(spec, services)));
  }

  onLog(`tracing dependencies…`);
  const { edges, cycles } = extractDependencies(services, dbByService);

  // languages summary
  const langCount = {};
  for (const s of services) langCount[s.lang] = (langCount[s.lang] || 0) + 1;
  const languages = Object.entries(langCount)
    .map(([name, n]) => ({ name, services: n }))
    .sort((a, b) => b.services - a.services);

  // strip internal file handles before handing facts to the model
  const cleanServices = services.map((s) => ({
    id: s.id,
    lang: s.lang,
    framework: s.framework,
    port: s.port,
    files: s.files,
    loc: s.loc,
    endpoints: s.endpoints,
    db: s.db,
  }));

  const byVerb = {};
  for (const e of endpoints) byVerb[e.method] = (byVerb[e.method] || 0) + 1;

  const facts = {
    repo: {
      name: meta.name || path.basename(repoDir),
      url: meta.url || null,
      source: meta.source || "zip",
      branch: meta.branch || "main",
      sizeMb: +(totalBytes / (1024 * 1024)).toFixed(1),
      files: files.length,
      services: services.length,
      languages,
    },
    services: cleanServices,
    endpoints,
    endpointStats: { total: endpoints.length, byVerb },
    databases,
    dependencies: { edges, cycles },
    counts: {
      services: services.length,
      endpoints: endpoints.length,
      deps: edges.length,
      cycles: cycles.length,
      databases: databases.length,
    },
  };
  return facts;
}

function guessSpecService(spec, services) {
  const title = (spec.info && spec.info.title ? spec.info.title : "").toLowerCase();
  const match = services.find((s) => title.includes(s.id.replace(/-service$/, "")));
  return match ? match.id : (services[0] ? services[0].id : "openapi");
}
