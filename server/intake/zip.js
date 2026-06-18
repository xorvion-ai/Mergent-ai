/* ============================================================
   Mergent AI — zip intake
   Extracts an uploaded .zip of services into a work dir.
   ============================================================ */
import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/**
 * @param {Buffer} buffer  uploaded zip
 * @param {string} id      analysis id
 * @param {string} name    original filename
 * @returns { dir, meta }
 */
export function extractZip(buffer, id, name = "upload.zip") {
  const dir = path.join(config.workDir, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const zip = new AdmZip(buffer);
  // Guard against path traversal.
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const safe = path.normalize(entry.entryName).replace(/^(\.\.[/\\])+/, "");
    const dest = path.join(dir, safe);
    if (!dest.startsWith(dir)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.getData());
  }

  // If the zip wrapped everything in a single top folder, descend into it.
  const root = collapseSingleRoot(dir);

  const repoName = name.replace(/\.zip$/i, "") || "uploaded-services";
  return { dir: root, meta: { name: repoName, url: null, source: "zip", branch: "—", commit: "" } };
}

function collapseSingleRoot(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== "__MACOSX");
  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(dir, entries[0].name);
  }
  return dir;
}
