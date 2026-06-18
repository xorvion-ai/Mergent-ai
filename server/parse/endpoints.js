/* ============================================================
   Mergent AI — endpoint extraction (deterministic, Agent 3 facts)
   Pulls { service, method, path } from controllers/routes across
   Spring, Express/Nest, FastAPI/Flask and Gin, plus OpenAPI specs.
   ============================================================ */
import { readText } from "./scan.js";

const VERBS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

/** Extract endpoints for one service. Returns [{ service, method, path }]. */
export function extractEndpoints(service) {
  const out = [];
  const seen = new Set();
  const add = (method, p) => {
    method = String(method).toUpperCase();
    if (!VERBS.includes(method)) return;
    let cleaned = normalizePath(p);
    if (!cleaned) return;
    const key = method + " " + cleaned;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ service: service.id, method, path: cleaned });
  };

  for (const f of service._files) {
    if (![".java", ".kt", ".js", ".ts", ".py", ".go"].includes(f.ext)) continue;
    const text = readText(f);
    if (!text) continue;
    switch (f.ext) {
      case ".java":
      case ".kt":
        springEndpoints(text, add);
        break;
      case ".js":
      case ".ts":
        expressNestEndpoints(text, add);
        break;
      case ".py":
        pythonEndpoints(text, add);
        break;
      case ".go":
        goEndpoints(text, add);
        break;
    }
  }
  return out;
}

function springEndpoints(text, add) {
  // class-level base path
  const base = (text.match(/@RequestMapping\(\s*(?:value\s*=\s*)?["']([^"']*)["']/) || [])[1] || "";
  const re = /@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*)?(?:\{?\s*)?["']([^"']*)["']/g;
  let m;
  while ((m = re.exec(text))) {
    let verb = m[1].toUpperCase();
    if (verb === "REQUEST") {
      const methodMatch = text.slice(m.index, m.index + 160).match(/method\s*=\s*RequestMethod\.(\w+)/);
      verb = methodMatch ? methodMatch[1] : "GET";
    }
    add(verb, join(base, m[2]));
  }
}

function expressNestEndpoints(text, add) {
  // express / fastify: app.get('/x'), router.post("/y")
  const re = /\b(?:app|router|server|api|r)\.(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi;
  let m;
  while ((m = re.exec(text))) add(m[1], m[2]);

  // NestJS decorators with optional controller prefix
  const base = (text.match(/@Controller\(\s*[`'"]([^`'"]*)[`'"]/) || [])[1] || "";
  const dre = /@(Get|Post|Put|Delete|Patch)\s*\(\s*[`'"]?([^`'")]*)[`'"]?\s*\)/gi;
  while ((m = dre.exec(text))) add(m[1], join(base, m[2]));
}

function pythonEndpoints(text, add) {
  // FastAPI / Flask: @app.get("/x"), @router.post("/y"), @app.route("/z", methods=["POST"])
  const re = /@(?:app|router|api|bp|blueprint)\.(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi;
  let m;
  while ((m = re.exec(text))) add(m[1], m[2]);

  const routeRe = /@(?:app|bp|blueprint)\.route\s*\(\s*[`'"]([^`'"]+)[`'"]([^)]*)\)/gi;
  while ((m = routeRe.exec(text))) {
    const methods = (m[2].match(/methods\s*=\s*\[([^\]]*)\]/) || [])[1];
    if (methods) {
      for (const v of methods.match(/[A-Z]+/g) || []) add(v, m[1]);
    } else add("GET", m[1]);
  }
}

function goEndpoints(text, add) {
  // Gin / Echo / Fiber / mux: r.GET("/x", ...), router.POST("/y", ...)
  const re = /\b\w+\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  let m;
  while ((m = re.exec(text))) add(m[1], m[2]);
  // net/http: mux.HandleFunc("/x", ...)
  const hf = /HandleFunc\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  while ((m = hf.exec(text))) add("GET", m[1]);
}

/** Endpoints declared in an OpenAPI/Swagger spec object. */
export function endpointsFromOpenApi(spec, serviceId) {
  const out = [];
  if (!spec || !spec.paths) return out;
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const verb of Object.keys(methods)) {
      if (VERBS.includes(verb.toUpperCase())) {
        out.push({ service: serviceId || "openapi", method: verb.toUpperCase(), path: normalizePath(p) });
      }
    }
  }
  return out;
}

function join(base, p) {
  base = base || "";
  p = p || "";
  if (!p) return base || "/";
  if (!base) return p;
  return (base.replace(/\/$/, "") + "/" + p.replace(/^\//, "")).replace(/\/+/g, "/");
}

function normalizePath(p) {
  if (!p) return "";
  let s = String(p).trim();
  if (!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\/+$/, "") || "/";
  // normalize path params: {id}, :id, <id> -> {id}
  s = s.replace(/:(\w+)/g, "{$1}").replace(/<[^>]*?(\w+)>/g, "{$1}");
  if (s.length > 80) return ""; // junk
  if (/[<>{}()\s]/.test(s.replace(/\{\w+\}/g, ""))) return "";
  return s;
}
