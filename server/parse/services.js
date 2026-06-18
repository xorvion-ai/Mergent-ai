/* ============================================================
   Mergent AI — service detection (deterministic, Agent 1 facts)
   Finds service roots from manifest files and derives
   framework / language / port / size. No LLM.
   ============================================================ */
import path from "node:path";
import { readText } from "./scan.js";

const MANIFESTS = [
  "package.json", "pom.xml", "build.gradle", "build.gradle.kts",
  "requirements.txt", "pyproject.toml", "setup.py", "go.mod", "Dockerfile",
];

/**
 * Detect services from the file index.
 * Returns [{ id, dir, lang, framework, port, files, loc, manifest, _files }].
 */
export function detectServices({ files }) {
  // Map of service-root-dir -> manifest filenames present.
  const roots = new Map();
  for (const f of files) {
    if (MANIFESTS.includes(f.name)) {
      const dir = f.dir === "." ? "" : f.dir;
      if (!roots.has(dir)) roots.set(dir, new Set());
      roots.get(dir).add(f.name);
    }
  }

  // If a Dockerfile-only dir sits under a real manifest dir, ignore the dup.
  const rootDirs = [...roots.keys()];

  const services = [];
  for (const [dir, manifests] of roots) {
    // Skip a bare Dockerfile dir that is nested inside another service root.
    if (manifests.size === 1 && manifests.has("Dockerfile")) {
      const parent = rootDirs.find((d) => d !== dir && dir.startsWith(d + "/"));
      if (parent) continue;
    }

    const svcFiles = files.filter((f) => f.dir === dir || f.dir.startsWith(dir + "/") || (dir === "" && true));
    // When there are multiple services, scope files to the service subtree only.
    const scoped = roots.size > 1 && dir !== ""
      ? files.filter((f) => f.rel.startsWith(dir + "/"))
      : svcFiles;

    const info = classify(dir, manifests, scoped);
    if (!info) continue;
    services.push(info);
  }

  // Single-service repo with no manifest at root but code present.
  if (services.length === 0 && files.length) {
    services.push(classify("", new Set(), files) || {
      id: "service", dir: "", lang: "Unknown", framework: "Unknown",
      port: null, files: files.length, loc: 0, _files: files,
    });
  }

  return dedupe(services);
}

function classify(dir, manifests, scoped) {
  const id = serviceId(dir, scoped);
  const lang = detectLang(manifests, scoped);
  const framework = detectFramework(manifests, scoped, lang);
  const port = detectPort(scoped);
  const loc = scoped.reduce((n, f) => n + estimateLines(f), 0);

  return {
    id,
    dir,
    lang,
    framework,
    port,
    files: scoped.length,
    loc,
    manifest: [...manifests][0] || null,
    _files: scoped,
  };
}

function serviceId(dir, scoped) {
  if (dir) return path.basename(dir);
  // root: try package.json name
  const pkg = scoped.find((f) => f.name === "package.json");
  if (pkg) {
    try {
      const j = JSON.parse(readText(pkg) || "{}");
      if (j.name) return String(j.name).replace(/^@[^/]+\//, "");
    } catch {}
  }
  return "service";
}

function has(manifests, name) {
  return manifests.has(name);
}

function fileText(scoped, name) {
  const f = scoped.find((x) => x.name === name);
  return f ? readText(f) : "";
}

function detectLang(manifests, scoped) {
  if (has(manifests, "go.mod")) return "Go";
  if (has(manifests, "pom.xml") || has(manifests, "build.gradle") || has(manifests, "build.gradle.kts")) return "Java";
  if (has(manifests, "requirements.txt") || has(manifests, "pyproject.toml") || has(manifests, "setup.py")) return "Python";
  if (has(manifests, "package.json")) {
    const hasTs = scoped.some((f) => f.ext === ".ts" || f.ext === ".tsx" || f.name === "tsconfig.json");
    return hasTs ? "TypeScript" : "JavaScript";
  }
  // fall back to dominant extension
  const counts = {};
  for (const f of scoped) counts[f.ext] = (counts[f.ext] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { ".java": "Java", ".go": "Go", ".py": "Python", ".ts": "TypeScript", ".js": "JavaScript" }[top] || "Unknown";
}

function detectFramework(manifests, scoped, lang) {
  const pkg = fileText(scoped, "package.json");
  const pom = fileText(scoped, "pom.xml") + fileText(scoped, "build.gradle") + fileText(scoped, "build.gradle.kts");
  const req = fileText(scoped, "requirements.txt") + fileText(scoped, "pyproject.toml") + fileText(scoped, "setup.py");
  const gomod = fileText(scoped, "go.mod");

  if (lang === "Java") {
    if (/spring-boot|springframework/i.test(pom)) return "Spring Boot";
    if (/quarkus/i.test(pom)) return "Quarkus";
    if (/micronaut/i.test(pom)) return "Micronaut";
    return "Java";
  }
  if (lang === "Python") {
    if (/fastapi/i.test(req)) return "FastAPI";
    if (/flask/i.test(req)) return "Flask";
    if (/django/i.test(req)) return "Django";
    return "Python";
  }
  if (lang === "Go") {
    if (/gin-gonic\/gin/i.test(gomod)) return "Gin";
    if (/labstack\/echo/i.test(gomod)) return "Echo";
    if (/gofiber\/fiber/i.test(gomod)) return "Fiber";
    return "Go (net/http)";
  }
  if (lang === "TypeScript" || lang === "JavaScript") {
    if (/"@nestjs\/core"/i.test(pkg)) return "NestJS";
    if (/"express"/i.test(pkg)) return "Node / Express";
    if (/"fastify"/i.test(pkg)) return "Fastify";
    if (/"koa"/i.test(pkg)) return "Koa";
    return "Node";
  }
  return "Unknown";
}

function detectPort(scoped) {
  // Search common config + Dockerfile + source for a port.
  const candidates = scoped.filter((f) =>
    /application\.(properties|ya?ml)|\.env$|config|Dockerfile|main\.|index\.|app\.|server\./i.test(f.name)
  ).slice(0, 40);
  const patterns = [
    /server\.port\s*[:=]\s*(\d{2,5})/i,
    /\bPORT\s*[:=]\s*["']?(\d{2,5})/i,
    /listen\(\s*(\d{2,5})/i,
    /EXPOSE\s+(\d{2,5})/i,
    /port\s*[:=]\s*["']?(\d{2,5})/i,
    /:(\d{4,5})\b/,
  ];
  for (const f of candidates) {
    const t = readText(f);
    if (!t) continue;
    for (const re of patterns) {
      const m = t.match(re);
      if (m) {
        const p = Number(m[1]);
        if (p >= 80 && p <= 65535) return p;
      }
    }
  }
  return null;
}

function estimateLines(f) {
  // cheap LOC estimate without reading everything: ~40 bytes/line
  if (![".java", ".js", ".ts", ".tsx", ".py", ".go"].includes(f.ext)) return 0;
  return Math.max(1, Math.round(f.size / 38));
}

function dedupe(services) {
  const seen = new Map();
  for (const s of services) {
    if (!seen.has(s.id)) seen.set(s.id, s);
  }
  return [...seen.values()];
}
