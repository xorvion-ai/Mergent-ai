/* ============================================================
   Mergent AI — file scanner
   Walks an extracted/cloned repo and returns a lightweight file
   index. Deterministic; no LLM. Skips vendored/build dirs.
   ============================================================ */
import fs from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", "dist", "build", "out", "target",
  "vendor", ".idea", ".vscode", "__pycache__", ".next", "coverage",
  ".gradle", "bin", "obj", ".venv", "venv", "env",
]);

const TEXT_EXT = new Set([
  ".java", ".kt", ".js", ".ts", ".tsx", ".jsx", ".py", ".go", ".rb",
  ".json", ".yml", ".yaml", ".xml", ".properties", ".env", ".toml",
  ".sql", ".md", ".gradle", ".txt", ".conf", ".cfg", ".ini", ".mod",
]);

const MAX_FILE_BYTES = 512 * 1024; // don't read giant files

/**
 * Walk `root` and return { files: [{rel, abs, ext, dir, name, size}], totalBytes }.
 */
export function scanRepo(root) {
  const files = [];
  let totalBytes = 0;

  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".env") {
        if (SKIP_DIRS.has(e.name)) continue;
      }
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(path.join(dir, e.name));
      } else if (e.isFile()) {
        const abs = path.join(dir, e.name);
        const ext = path.extname(e.name).toLowerCase();
        let size = 0;
        try {
          size = fs.statSync(abs).size;
        } catch {
          continue;
        }
        totalBytes += size;
        files.push({
          rel: path.relative(root, abs).split(path.sep).join("/"),
          abs,
          ext,
          dir: path.dirname(path.relative(root, abs)).split(path.sep).join("/"),
          name: e.name,
          size,
        });
      }
    }
  })(root);

  return { files, totalBytes };
}

/** Read a text file safely (returns "" on error or if too large/binary). */
export function readText(file) {
  if (file.size > MAX_FILE_BYTES) return "";
  if (file.ext && !TEXT_EXT.has(file.ext)) return "";
  try {
    return fs.readFileSync(file.abs, "utf8");
  } catch {
    return "";
  }
}

/** Count lines across a set of files (LOC heuristic). */
export function countLoc(files) {
  let loc = 0;
  for (const f of files) {
    const t = readText(f);
    if (t) loc += t.split("\n").length;
  }
  return loc;
}

export { TEXT_EXT };
