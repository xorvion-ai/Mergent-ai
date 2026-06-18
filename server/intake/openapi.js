/* ============================================================
   Mergent AI — OpenAPI / Swagger intake
   Parses uploaded specs into { info, paths } objects. JSON is
   parsed fully; YAML is read with a light path/method extractor
   (avoids a yaml dependency while still surfacing endpoints).
   ============================================================ */

/** Parse spec text (JSON or YAML) into a minimal { info, paths } object. */
export function parseSpec(text, filename = "") {
  const t = String(text || "").trim();
  if (!t) return null;

  // Try JSON first.
  try {
    const obj = JSON.parse(t);
    if (obj && obj.paths) return { info: obj.info || {}, paths: obj.paths };
  } catch {}

  // Light YAML extraction: find `paths:` block, then "/path:" and verb lines.
  return parseYamlPaths(t, filename);
}

function parseYamlPaths(text, filename) {
  const lines = text.split(/\r?\n/);
  const paths = {};
  let title = (filename || "").replace(/\.(ya?ml|json)$/i, "");

  let inPaths = false;
  let pathsIndent = -1;
  let currentPath = null;
  let currentIndent = -1;

  const verbRe = /^(get|post|put|delete|patch|head|options):/i;

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.search(/\S/);

    const tMatch = trimmed.match(/^title:\s*["']?(.+?)["']?$/i);
    if (tMatch && !inPaths) title = tMatch[1];

    if (/^paths:\s*$/i.test(trimmed)) { inPaths = true; pathsIndent = indent; continue; }
    if (!inPaths) continue;

    // a new top-level key at <= paths indent ends the paths block
    if (indent <= pathsIndent && !/^\//.test(trimmed)) { inPaths = false; continue; }

    const pathMatch = trimmed.match(/^("?)(\/[^"':]*)\1\s*:/);
    if (pathMatch && indent > pathsIndent) {
      currentPath = pathMatch[2];
      currentIndent = indent;
      paths[currentPath] = paths[currentPath] || {};
      continue;
    }

    if (currentPath && indent > currentIndent) {
      const v = trimmed.match(verbRe);
      if (v) paths[currentPath][v[1].toLowerCase()] = {};
    }
  }

  return Object.keys(paths).length ? { info: { title }, paths } : null;
}
