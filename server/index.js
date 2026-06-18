/* ============================================================
   Mergent AI — HTTP server (Vercel-safe, single-request runs)
   - Frontend (static) + JSON API.
   - One streaming POST runs the whole 7-agent pipeline and emits
     SSE events in the SAME request (works on serverless — no
     shared in-memory state needed between calls).
   - Auth + user tracking + admin user-management via the DB layer
     (Neon Postgres in prod, in-memory locally).
   ============================================================ */
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { config } from "./config.js";
import { usage } from "./llm/provider.js";
import * as db from "./db.js";
import { extractFacts } from "./parse/index.js";
import { runAnalysis } from "./agents/pipeline.js";
import { cloneRepo, normalizeRepoUrl } from "./intake/github.js";
import { extractZip } from "./intake/zip.js";
import { parseSpec } from "./intake/openapi.js";
import { resolveSample, defaultSample, SAMPLES } from "./intake/samples.js";
import { reportHTML, reportText, jiraJSON, jiraCSV } from "./report.js";
import { sendMagicLink, signToken, verifyToken } from "./mailer.js";

export const ADMIN_EMAIL = "xorvion.ai@gmail.com";

const app = express();
app.set("trust proxy", true); // correct req.protocol/host behind Vercel's proxy
app.use(express.json({ limit: "2mb" }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadMb * 1024 * 1024 } });

let dbReady = db.initDb().catch((e) => console.error("DB init failed:", e.message));

const newId = () => "an_" + crypto.randomBytes(6).toString("hex");
const emailOf = (req) => String(req.header("x-mergent-email") || req.body?.email || "").toLowerCase().trim();
const isAdminEmail = (e) => String(e || "").toLowerCase() === ADMIN_EMAIL;

/* ---------------- auth / users ---------------- */
app.post("/api/auth/login", async (req, res) => {
  await dbReady;
  const email = String(req.body.email || "").toLowerCase().trim();
  const name = String(req.body.name || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "valid email required" });
  const isAdmin = isAdminEmail(email);
  const existing = await db.getUser(email);
  if (existing && existing.disabled) return res.status(403).json({ error: "This account has been disabled." });
  const user = await db.upsertUserOnLogin({ email, name, isAdmin });
  res.json({ email: user.email, name: user.name, isAdmin: user.isAdmin, disabled: user.disabled });
});

/* ---------------- Firebase email-link sign-in ---------------- */
// The browser completes Firebase's email-link flow and sends us the resulting
// Firebase ID token; we validate it via Identity Toolkit (public API key) and
// upsert our own user record.
app.post("/api/auth/firebase", async (req, res) => {
  await dbReady;
  const idToken = req.body.idToken;
  if (!idToken) return res.status(400).json({ error: "no token" });
  if (!config.hasFirebase) return res.status(400).json({ error: "Firebase not configured" });
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.firebase.apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
    });
    const j = await r.json();
    if (!r.ok || !j.users || !j.users[0]) throw new Error("invalid Firebase token");
    const fb = j.users[0];
    const email = String(fb.email || "").toLowerCase().trim();
    if (!email || fb.emailVerified === false) throw new Error("email not verified");
    const existing = await db.getUser(email);
    if (existing && existing.disabled) return res.status(403).json({ error: "This account has been disabled." });
    const user = await db.upsertUserOnLogin({ email, name: fb.displayName || "", isAdmin: isAdminEmail(email) });
    res.json({ email: user.email, name: user.name, isAdmin: user.isAdmin, disabled: user.disabled, picture: fb.photoUrl || "" });
  } catch (e) {
    res.status(401).json({ error: "Sign-in failed: " + e.message });
  }
});

/* ---------------- magic-link email sign-in (SMTP fallback) ---------------- */
app.post("/api/auth/magic/request", async (req, res) => {
  await dbReady;
  const email = String(req.body.email || "").toLowerCase().trim();
  const name = String(req.body.name || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "valid email required" });
  const existing = await db.getUser(email);
  if (existing && existing.disabled) return res.status(403).json({ error: "This account has been disabled." });

  // No mail configured → passwordless demo sign-in (keeps the app usable for free)
  if (!config.hasMail) {
    const user = await db.upsertUserOnLogin({ email, name, isAdmin: isAdminEmail(email) });
    return res.json({ demo: true, email: user.email, name: user.name, isAdmin: user.isAdmin });
  }

  const token = signToken({ email, name, exp: Date.now() + 15 * 60 * 1000 });
  const origin = `${req.protocol}://${req.get("host")}`;
  const link = `${origin}/Login.html?magic=${encodeURIComponent(token)}`;
  try {
    await sendMagicLink(email, link, name);
    res.json({ sent: true });
  } catch (e) {
    res.status(500).json({ error: "could not send email — " + e.message });
  }
});

app.post("/api/auth/magic/verify", async (req, res) => {
  await dbReady;
  const payload = verifyToken(req.body.token);
  if (!payload) return res.status(400).json({ error: "This sign-in link is invalid or has expired." });
  const existing = await db.getUser(payload.email);
  if (existing && existing.disabled) return res.status(403).json({ error: "This account has been disabled." });
  const user = await db.upsertUserOnLogin({ email: payload.email, name: payload.name, isAdmin: isAdminEmail(payload.email) });
  res.json({ email: user.email, name: user.name, isAdmin: user.isAdmin, disabled: user.disabled });
});

/* ---------------- admin (xorvion only) ---------------- */
function requireAdmin(req, res, next) {
  if (!isAdminEmail(emailOf(req))) return res.status(403).json({ error: "admin only" });
  next();
}
app.get("/api/admin/users", requireAdmin, async (_req, res) => {
  await dbReady;
  res.json({ users: await db.listUsers() });
});
app.post("/api/admin/users/:email/disabled", requireAdmin, async (req, res) => {
  await dbReady;
  if (isAdminEmail(req.params.email)) return res.status(400).json({ error: "cannot disable the owner account" });
  await db.setUserDisabled(req.params.email, !!req.body.disabled);
  res.json({ ok: true });
});
app.delete("/api/admin/users/:email", requireAdmin, async (req, res) => {
  await dbReady;
  if (isAdminEmail(req.params.email)) return res.status(400).json({ error: "cannot delete the owner account" });
  await db.deleteUser(req.params.email);
  res.json({ ok: true });
});

/* ---------------- meta ---------------- */
app.get("/api/config", (req, res) => {
  res.json({ mode: usage.mode, quotaUsed: usage.calls, quotaTotal: usage.budget, samples: SAMPLES, isAdmin: isAdminEmail(emailOf(req)), googleClientId: config.googleClientId, mail: config.hasMail, firebase: config.hasFirebase ? config.firebase : null });
});

/* Sign in with Google — verify the token Google handed the browser, then upsert. */
app.post("/api/auth/google", async (req, res) => {
  await dbReady;
  try {
    let email = "", name = "", picture = "";
    if (req.body.access_token) {
      const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${req.body.access_token}` } });
      if (!r.ok) throw new Error("could not verify Google token");
      const u = await r.json();
      email = u.email; name = u.name || u.given_name || ""; picture = u.picture || "";
    } else if (req.body.credential) {
      const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(req.body.credential));
      const info = await r.json();
      if (!r.ok) throw new Error("invalid Google credential");
      if (config.googleClientId && info.aud !== config.googleClientId) throw new Error("token audience mismatch");
      email = info.email; name = info.name || ""; picture = info.picture || "";
    } else {
      return res.status(400).json({ error: "no Google token" });
    }
    email = String(email || "").toLowerCase().trim();
    if (!email) throw new Error("Google returned no email");
    const existing = await db.getUser(email);
    if (existing && existing.disabled) return res.status(403).json({ error: "This account has been disabled." });
    const user = await db.upsertUserOnLogin({ email, name, isAdmin: isAdminEmail(email) });
    res.json({ email: user.email, name: user.name, isAdmin: user.isAdmin, disabled: user.disabled, picture });
  } catch (e) {
    res.status(401).json({ error: "Google sign-in failed: " + e.message });
  }
});

app.get("/api/analyses", async (req, res) => {
  await dbReady;
  const email = emailOf(req);
  const admin = isAdminEmail(email);
  const recs = await db.recentAnalyses({ email, isAdmin: admin, limit: 12 });
  const recent = recs.map((r, i) => ({
    id: r.id,
    repo: r.data?.repo?.name || r.repoName,
    source: r.data?.repo?.source === "sample" ? "github" : (r.data?.repo?.source || r.source),
    services: r.data?.summary?.servicesBefore ?? 0,
    after: r.data?.summary?.servicesAfter ?? 0,
    risksHigh: r.data?.summary?.risksHigh ?? 0,
    when: relTime(r.completedAt),
    status: "complete",
    active: i === 0,
  }));
  // dashboard rollups (used for non-admin real stats)
  const stats = recs.reduce((a, r) => {
    a.analyses++;
    a.services += r.data?.summary?.servicesBefore || 0;
    a.risksHigh += r.data?.summary?.risksHigh || 0;
    return a;
  }, { analyses: 0, services: 0, risksHigh: 0 });
  res.json({ recent, stats, samples: SAMPLES, isAdmin: admin, quotaUsed: usage.calls, quotaTotal: usage.budget, mode: usage.mode });
});

app.get("/api/analyses/:id", async (req, res) => {
  await dbReady;
  const rec = await db.getAnalysis(req.params.id);
  if (!rec) return res.status(404).json({ error: "not found" });
  res.json({ id: rec.id, status: rec.status, error: rec.error, data: rec.data });
});

/* ---------------- start: one streaming request ---------------- */
app.post("/api/analyses", upload.any(), async (req, res) => {
  await dbReady;
  const source = (req.body.source || "github").toLowerCase();
  const url = req.body.url || "";
  const sampleName = req.body.sample || "";
  const email = emailOf(req);

  const user = email ? await db.getUser(email) : null;
  if (user && user.disabled) return res.status(403).json({ error: "Account disabled." });

  let repoName = "analysis";
  try {
    if (source === "github" && url) repoName = normalizeRepoUrl(url).name;
    else if (source === "sample") repoName = (resolveSample(sampleName) || defaultSample())?.sample.name || "sample";
    else if (source === "zip") repoName = (req.files?.[0]?.originalname || "upload.zip").replace(/\.zip$/i, "");
    else if (source === "openapi") repoName = "openapi-spec";
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const id = newId();
  const createdAt = new Date().toISOString();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const emit = (event, data) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} };
  const log = (msg) => emit("log", { msg });
  emit("started", { id });

  const t0 = Date.now();
  try {
    const data = await produceAnalysis({ source, url, sampleName, files: req.files || [], id, emit, log });
    data.summary.durationSec = Math.round((Date.now() - t0) / 1000);
    data.repo.scannedAt = new Date().toISOString();
    await db.saveAnalysis({ id, userEmail: email || null, repoName: data.repo.name, source, status: "complete", data, createdAt, completedAt: new Date().toISOString() });
    emit("done", { id, summary: data.summary });
  } catch (e) {
    await db.saveAnalysis({ id, userEmail: email || null, repoName, source, status: "error", error: e.message, createdAt }).catch(() => {});
    emit("error", { msg: e.message });
  }
  res.end();
});

/* core: intake -> facts -> agents (shared by the streaming route) */
async function produceAnalysis({ source, url, sampleName, files, id, emit, log }) {
  let repoDir, meta, specs = [], usedFallback = false;

  for (const f of files) {
    if (/\.(ya?ml|json)$/i.test(f.originalname) && !/\.zip$/i.test(f.originalname)) {
      const spec = parseSpec(f.buffer.toString("utf8"), f.originalname);
      if (spec) specs.push(spec);
    }
  }

  try {
    if (source === "github") {
      if (!url) throw new Error("no url");
      log(`downloading ${normalizeRepoUrl(url).name} …`);
      ({ dir: repoDir, meta } = await cloneRepo(url, id));
      log(`fetched archive`);
    } else if (source === "zip") {
      const zip = files.find((f) => /\.zip$/i.test(f.originalname));
      if (!zip) throw new Error("no zip uploaded");
      ({ dir: repoDir, meta } = extractZip(zip.buffer, id, zip.originalname));
      log(`extracted ${zip.originalname}`);
    } else if (source === "openapi") {
      repoDir = path.join(config.workDir, id);
      fs.mkdirSync(repoDir, { recursive: true });
      files.forEach((f, i) => fs.writeFileSync(path.join(repoDir, f.originalname || `spec-${i}.json`), f.buffer));
      meta = { name: "openapi-spec", source: "openapi", branch: "—" };
    } else {
      const samp = resolveSample(sampleName) || defaultSample();
      if (!samp) throw new Error("sample unavailable");
      repoDir = samp.dir; meta = samp.meta;
    }
  } catch (e) {
    const samp = defaultSample();
    if (!samp) throw e;
    usedFallback = true;
    repoDir = samp.dir; meta = { ...samp.meta };
    log(`⚠ intake failed (${e.message}) — falling back to bundled sample`);
  }

  log("extracting facts (deterministic parse)…");
  let facts = extractFacts(repoDir, meta, specs, log);
  if (!facts.services.length && source !== "openapi") {
    const samp = defaultSample();
    if (samp) { usedFallback = true; log("⚠ no services detected — using bundled sample"); facts = extractFacts(samp.dir, samp.meta, [], log); }
  }
  log(usage.mode === "gemini" ? `gemini reasoning enabled · ${usage.calls}/${usage.budget} calls used` : "deterministic mode (no API key)");

  const data = await runAnalysis(facts, emit);
  data.summary.fallback = usedFallback;
  return data;
}

/* ---------------- report + jira ---------------- */
app.get("/api/analyses/:id/report", async (req, res) => {
  await dbReady;
  const rec = await db.getAnalysis(req.params.id);
  if (!rec || !rec.data) return res.status(404).json({ error: "not ready" });
  const fmt = (req.query.format || "html").toLowerCase();
  if (fmt === "text" || fmt === "txt") res.type("text/plain").send(reportText(rec.data));
  else res.type("text/html").send(reportHTML(rec.data));
});
app.get("/api/analyses/:id/jira", async (req, res) => {
  await dbReady;
  const rec = await db.getAnalysis(req.params.id);
  if (!rec || !rec.data) return res.status(404).json({ error: "not ready" });
  const fmt = (req.query.format || "json").toLowerCase();
  if (fmt === "csv") res.type("text/csv").send(jiraCSV(rec.data));
  else res.type("application/json").send(jiraJSON(rec.data));
});

function relTime(iso) {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/* ---------------- static frontend ---------------- */
app.get("/", (_req, res) => res.redirect("/Homepage.html"));
app.use(express.static(config.webRoot, { extensions: ["html"] }));

/* On Vercel the app is imported as a handler; locally we listen. */
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`\n  Mergent AI  ·  http://localhost:${config.port}`);
    console.log(`  LLM mode    ·  ${usage.mode}${usage.mode === "gemini" ? " (" + config.gemini.model + ")" : " (no key — deterministic)"}`);
    console.log(`  Store       ·  ${db.usingPostgres ? "Postgres" : "in-memory"}\n`);
  });
}

export default app;
