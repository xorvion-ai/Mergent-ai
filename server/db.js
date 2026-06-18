/* ============================================================
   Mergent AI — data layer
   Postgres (Neon) when a connection string is present (Vercel),
   otherwise an in-memory store so local dev needs no database.
   Same async API either way.
   ============================================================ */
import pg from "pg";

function resolveConn() {
  // Common names first (works with any Neon/Vercel default)
  const direct =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED;
  if (direct) return direct;
  // Fallback: any env var whose VALUE is a postgres connection string
  // (covers custom prefixes like STORAGE_DATABASE_URL, etc.)
  for (const v of Object.values(process.env)) {
    if (typeof v === "string" && /^postgres(ql)?:\/\/\S+/.test(v)) return v;
  }
  return "";
}
const CONN = resolveConn();

export const usingPostgres = Boolean(CONN);

let pool = null;
if (usingPostgres) {
  pool = new pg.Pool({
    connectionString: CONN,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

/* ---------- in-memory fallback ---------- */
const mem = { users: new Map(), analyses: new Map() };

/* ---------- schema ---------- */
export async function initDb() {
  if (!usingPostgres) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      email        TEXT PRIMARY KEY,
      name         TEXT,
      is_admin     BOOLEAN DEFAULT false,
      disabled     BOOLEAN DEFAULT false,
      login_count  INTEGER DEFAULT 0,
      analyses_run INTEGER DEFAULT 0,
      first_seen   TIMESTAMPTZ DEFAULT now(),
      last_seen    TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id           TEXT PRIMARY KEY,
      user_email   TEXT,
      repo_name    TEXT,
      source       TEXT,
      status       TEXT,
      error        TEXT,
      data         JSONB,
      created_at   TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS analyses_user_idx ON analyses(user_email);
  `);
}

/* ---------- users ---------- */
export async function upsertUserOnLogin({ email, name, isAdmin }) {
  email = String(email).toLowerCase().trim();
  if (usingPostgres) {
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, is_admin, login_count, last_seen)
       VALUES ($1,$2,$3,1, now())
       ON CONFLICT (email) DO UPDATE
         SET login_count = users.login_count + 1,
             last_seen = now(),
             name = COALESCE(NULLIF($2,''), users.name),
             is_admin = $3
       RETURNING *`,
      [email, name || "", !!isAdmin]
    );
    return rowToUser(rows[0]);
  }
  let u = mem.users.get(email);
  if (!u) {
    u = { email, name: name || "", isAdmin: !!isAdmin, disabled: false, loginCount: 0, analysesRun: 0, firstSeen: new Date().toISOString(), lastSeen: null };
    mem.users.set(email, u);
  }
  u.loginCount++;
  u.lastSeen = new Date().toISOString();
  if (name) u.name = name;
  u.isAdmin = !!isAdmin;
  return { ...u };
}

export async function getUser(email) {
  email = String(email || "").toLowerCase().trim();
  if (!email) return null;
  if (usingPostgres) {
    const { rows } = await pool.query(`SELECT * FROM users WHERE email=$1`, [email]);
    return rows[0] ? rowToUser(rows[0]) : null;
  }
  const u = mem.users.get(email);
  return u ? { ...u } : null;
}

export async function listUsers() {
  if (usingPostgres) {
    const { rows } = await pool.query(`SELECT * FROM users ORDER BY last_seen DESC NULLS LAST`);
    return rows.map(rowToUser);
  }
  return [...mem.users.values()].sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen))).map((u) => ({ ...u }));
}

export async function setUserDisabled(email, disabled) {
  email = String(email).toLowerCase().trim();
  if (usingPostgres) {
    await pool.query(`UPDATE users SET disabled=$2 WHERE email=$1`, [email, !!disabled]);
    return;
  }
  const u = mem.users.get(email);
  if (u) u.disabled = !!disabled;
}

export async function deleteUser(email) {
  email = String(email).toLowerCase().trim();
  if (usingPostgres) {
    await pool.query(`DELETE FROM analyses WHERE user_email=$1`, [email]);
    await pool.query(`DELETE FROM users WHERE email=$1`, [email]);
    return;
  }
  mem.users.delete(email);
  for (const [id, a] of mem.analyses) if (a.userEmail === email) mem.analyses.delete(id);
}

async function bumpAnalysesRun(email) {
  if (!email) return;
  if (usingPostgres) {
    await pool.query(`UPDATE users SET analyses_run = analyses_run + 1 WHERE email=$1`, [email]);
    return;
  }
  const u = mem.users.get(email);
  if (u) u.analysesRun++;
}

/* ---------- analyses ---------- */
export async function saveAnalysis(rec) {
  if (usingPostgres) {
    await pool.query(
      `INSERT INTO analyses (id, user_email, repo_name, source, status, error, data, created_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE
         SET status=$5, error=$6, data=$7, completed_at=$9`,
      [rec.id, rec.userEmail || null, rec.repoName, rec.source, rec.status, rec.error || null,
       rec.data ? JSON.stringify(rec.data) : null, rec.createdAt, rec.completedAt || null]
    );
  } else {
    mem.analyses.set(rec.id, { ...rec });
  }
  if (rec.status === "complete") await bumpAnalysesRun(rec.userEmail);
}

export async function getAnalysis(id) {
  if (usingPostgres) {
    const { rows } = await pool.query(`SELECT * FROM analyses WHERE id=$1`, [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: r.id, userEmail: r.user_email, repoName: r.repo_name, source: r.source, status: r.status, error: r.error, data: r.data, createdAt: r.created_at, completedAt: r.completed_at };
  }
  return mem.analyses.get(id) || null;
}

export async function recentAnalyses({ email, isAdmin, limit = 12 }) {
  let recs;
  if (usingPostgres) {
    const q = isAdmin
      ? await pool.query(`SELECT * FROM analyses WHERE status='complete' ORDER BY completed_at DESC NULLS LAST LIMIT $1`, [limit])
      : await pool.query(`SELECT * FROM analyses WHERE status='complete' AND user_email=$1 ORDER BY completed_at DESC NULLS LAST LIMIT $2`, [String(email || "").toLowerCase(), limit]);
    recs = q.rows.map((r) => ({ id: r.id, repoName: r.repo_name, source: r.source, data: r.data, completedAt: r.completed_at }));
  } else {
    recs = [...mem.analyses.values()]
      .filter((a) => a.status === "complete" && (isAdmin || a.userEmail === String(email || "").toLowerCase()))
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
      .slice(0, limit);
  }
  return recs;
}

function rowToUser(r) {
  return {
    email: r.email, name: r.name, isAdmin: r.is_admin, disabled: r.disabled,
    loginCount: r.login_count, analysesRun: r.analyses_run,
    firstSeen: r.first_seen, lastSeen: r.last_seen,
  };
}
