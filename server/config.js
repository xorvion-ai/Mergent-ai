/* ============================================================
   Mergent AI — configuration
   Loads .env (zero-dep parser) and exposes typed config.
   ============================================================ */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

/* On Vercel the project filesystem is read-only except /tmp. */
const ON_VERCEL = Boolean(process.env.VERCEL);
const DATA_ROOT = ON_VERCEL ? path.join(os.tmpdir(), "mergent") : path.join(ROOT, "data");

/* Minimal .env loader — avoids a dotenv dependency. */
function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnv();

export const config = {
  root: ROOT,
  port: Number(process.env.PORT) || 3000,
  /** Web root — the design prototype is served as-is. */
  webRoot: path.join(ROOT, "App Homepage Design"),
  dataDir: DATA_ROOT,
  workDir: path.join(DATA_ROOT, "work"),
  analysesDir: path.join(DATA_ROOT, "analyses"),
  samplesDir: path.join(ROOT, "samples"),
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    dailyBudget: Number(process.env.GEMINI_DAILY_BUDGET) || 1500,
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  // Firebase Authentication (email-link "magic link" — Firebase sends the email).
  // All values are PUBLIC web config, taken from Firebase console → Project settings.
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  },
  // (Optional) transactional SMTP fallback if Firebase isn't configured.
  // Use a provider API/SMTP key as SMTP_PASS — never a personal account password.
  mail: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || process.env.SMTP_USER || "",
  },
  // secret for signing magic-link tokens (set a stable value in prod)
  authSecret: process.env.AUTH_SECRET || process.env.SMTP_PASS || "mergent-dev-secret-change-me",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 200,
  get hasLLM() {
    return Boolean(this.gemini.apiKey);
  },
  get hasMail() {
    return Boolean(this.mail.host && this.mail.user && this.mail.pass);
  },
  get hasFirebase() {
    return Boolean(this.firebase.apiKey && this.firebase.authDomain && this.firebase.projectId);
  },
};

/* Ensure runtime directories exist. */
for (const dir of [config.dataDir, config.workDir, config.analysesDir]) {
  fs.mkdirSync(dir, { recursive: true });
}
