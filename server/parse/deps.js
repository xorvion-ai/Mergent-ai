/* ============================================================
   Mergent AI — dependency extraction (deterministic, Agent 2 facts)
   Finds inter-service edges (http / queue / shared-db) by scanning
   each service for references to other services' names, ports and
   URLs, queue topics, and shared database identifiers. Detects
   cycles via DFS. No LLM.
   ============================================================ */
import { readText } from "./scan.js";

/**
 * @param services [{ id, port, _files }]
 * @param dbByService Map<serviceId, dbId>  (from db parser)
 * @returns { edges:[{from,to,type,calls}], cycles:[{id,path,severity}] }
 */
export function extractDependencies(services, dbByService = new Map()) {
  const ids = services.map((s) => s.id);
  const portMap = new Map(); // port -> serviceId
  for (const s of services) if (s.port) portMap.set(String(s.port), s.id);

  const edgeMap = new Map(); // "from|to|type" -> count

  const bump = (from, to, type, n = 1) => {
    if (from === to || !to) return;
    const k = `${from}|${to}|${type}`;
    edgeMap.set(k, (edgeMap.get(k) || 0) + n);
  };

  for (const s of services) {
    const others = ids.filter((id) => id !== s.id);
    for (const f of s._files) {
      if (![".java", ".kt", ".js", ".ts", ".py", ".go", ".yml", ".yaml", ".properties", ".env", ".json"].includes(f.ext)) continue;
      const t = stripComments(readText(f), f.ext);
      if (!t) continue;

      // 1) direct service-name references (URLs, hostnames, config keys)
      for (const other of others) {
        const re = new RegExp(`\\b${escapeRe(other)}\\b`, "g");
        const hits = (t.match(re) || []).length;
        if (hits) {
          // queue if mentioned near a broker/topic keyword
          const queueish = new RegExp(`(kafka|rabbit|amqp|sqs|topic|queue|publish|emit|enqueue)[^\\n]{0,40}${escapeRe(other)}|${escapeRe(other)}[^\\n]{0,40}(topic|queue)`, "i").test(t);
          bump(s.id, other, queueish ? "queue" : "http", hits);
        }
      }

      // 2) references by port (http://host:PORT)
      for (const [port, sid] of portMap) {
        if (sid === s.id) continue;
        if (new RegExp(`:${port}\\b`).test(t)) bump(s.id, sid, "http", 1);
      }
    }
  }

  // 3) shared-db edges: services pointing at the same database id
  const byDb = new Map();
  for (const [sid, db] of dbByService) {
    if (!db) continue;
    if (!byDb.has(db)) byDb.set(db, []);
    byDb.get(db).push(sid);
  }
  for (const owners of byDb.values()) {
    if (owners.length > 1) {
      for (let i = 0; i < owners.length; i++)
        for (let j = i + 1; j < owners.length; j++)
          bump(owners[i], owners[j], "shared-db", 0);
    }
  }

  const edges = [...edgeMap.entries()].map(([k, calls]) => {
    const [from, to, type] = k.split("|");
    return { from, to, type, calls };
  });

  const cycles = detectCycles(edges.filter((e) => e.type !== "shared-db"));
  // tag edges that belong to a cycle
  cycles.forEach((c, idx) => {
    for (let i = 0; i < c.path.length - 1; i++) {
      const a = c.path[i], b = c.path[i + 1];
      const e = edges.find((x) => x.from === a && x.to === b);
      if (e) e.cycle = idx + 1;
    }
  });

  return { edges, cycles };
}

function detectCycles(edges) {
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  }
  const cycles = [];
  const seenCycleKeys = new Set();
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const stack = [];

  function dfs(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adj.get(node) || []) {
      if (color.get(next) === GRAY) {
        // found a cycle: slice stack from next .. node, close it
        const start = stack.indexOf(next);
        const path = stack.slice(start).concat(next);
        const key = [...path].sort().join(">");
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push({ id: cycles.length + 1, path, severity: path.length <= 3 ? "high" : "med" });
        }
      } else if ((color.get(next) || WHITE) === WHITE) {
        dfs(next);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const node of adj.keys()) if ((color.get(node) || WHITE) === WHITE) dfs(node);
  return cycles;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip comments so prose mentions of other services don't fake edges. */
function stripComments(t, ext) {
  if (!t) return t;
  // block comments /* ... */ (code) and <!-- --> (xml/html)
  t = t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const lineComment = [".yml", ".yaml", ".properties", ".env"].includes(ext) ? "#" : "//";
  return t
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf(lineComment);
      // keep "://" (URLs) — only strip when not part of a scheme
      if (lineComment === "//") {
        const m = line.match(/(^|[^:])\/\//);
        if (m) return line.slice(0, m.index + m[1].length);
        return line;
      }
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}
