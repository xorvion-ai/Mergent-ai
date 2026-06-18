/* ============================================================
   Mergent AI — GitHub intake (zip download, no git binary)
   Downloads the repository archive from codeload and extracts it.
   Works in serverless (Vercel) where `git` is unavailable, and
   needs no token for public repos.
   ============================================================ */
import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/** Validate + parse a public GitHub URL into {owner, repo, name, url}. */
export function normalizeRepoUrl(url) {
  const u = String(url || "").trim();
  if (!/^https?:\/\/.+\..+/.test(u)) throw new Error("Enter a valid public repository URL.");
  const cleaned = u.replace(/\.git$/, "").replace(/\/$/, "");
  const m = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (!m) throw new Error("Only public GitHub repository URLs are supported.");
  return { owner: m[1], repo: m[2], name: `${m[1]}/${m[2]}`, url: cleaned };
}

/**
 * Download + extract a public repo archive.
 * @returns { dir, meta:{name,url,source,branch,commit} }
 */
export async function cloneRepo(url, id) {
  const { owner, repo, name, url: clean } = normalizeRepoUrl(url);
  const dir = path.join(config.workDir, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  let branch = "main";
  let buffer = await tryFetchZip(owner, repo, "main");
  if (!buffer) { buffer = await tryFetchZip(owner, repo, "master"); branch = "master"; }
  if (!buffer) {
    // ask the API for the real default branch, then retry
    const def = await defaultBranch(owner, repo);
    if (def) { buffer = await tryFetchZip(owner, repo, def); branch = def; }
  }
  if (!buffer) throw new Error("could not download repository archive (private or not found)");

  const zip = new AdmZip(buffer);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    // GitHub archives nest everything under "<repo>-<branch>/"; strip that first segment
    const rel = entry.entryName.split("/").slice(1).join("/");
    if (!rel) continue;
    const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
    const dest = path.join(dir, safe);
    if (!dest.startsWith(dir)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.getData());
  }

  return { dir, meta: { name, url: clean, source: "github", branch, commit: "" } };
}

async function tryFetchZip(owner, repo, ref) {
  const url = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${ref}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "mergent-ai" } });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

async function defaultBranch(owner, repo) {
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { "User-Agent": "mergent-ai", Accept: "application/vnd.github+json" } });
    if (!r.ok) return null;
    const j = await r.json();
    return j.default_branch || null;
  } catch {
    return null;
  }
}
