/* ============================================================
   Mergent AI — datastore extraction (deterministic, Agent 4 facts)
   Detects the database engine each service uses and inventories
   tables/collections from configs, ORM entities and migrations.
   ============================================================ */
import { readText } from "./scan.js";

const ENGINE_PATTERNS = [
  [/postgres|postgresql|jdbc:postgresql|psycopg|pg8000|"pg"/i, "PostgreSQL"],
  [/mysql|jdbc:mysql|mariadb|mysql2/i, "MySQL"],
  [/mongodb|mongoose|mongo:\/\/|pymongo/i, "MongoDB"],
  [/redis|ioredis|redis:\/\//i, "Redis"],
  [/sqlite/i, "SQLite"],
  [/cassandra/i, "Cassandra"],
  [/dynamodb/i, "DynamoDB"],
];

/**
 * @param services [{ id, _files }]
 * @returns { databases:[{id,engine,owner,tables,target:null}], dbByService:Map }
 */
export function extractDatabases(services) {
  const dbByService = new Map();
  // engineByService used to synthesize a db id when no explicit name found
  const result = new Map(); // dbId -> { id, engine, owners:Set, tables:Set }

  for (const s of services) {
    let engine = null;
    let dbName = null;
    const tables = new Set();

    for (const f of s._files) {
      if (![".java", ".kt", ".js", ".ts", ".py", ".go", ".yml", ".yaml", ".properties", ".env", ".json", ".sql"].includes(f.ext)) continue;
      const t = readText(f);
      if (!t) continue;

      if (!engine) {
        for (const [re, name] of ENGINE_PATTERNS) {
          if (re.test(t)) { engine = name; break; }
        }
      }
      if (!dbName) dbName = findDbName(t);

      collectTables(t, f.ext, tables);
    }

    if (!engine && tables.size === 0) {
      dbByService.set(s.id, null);
      continue;
    }
    engine = engine || "Unknown";
    const id = dbName || `${s.id.replace(/-service$/, "").replace(/[^a-z0-9]+/gi, "_")}_db`;
    dbByService.set(s.id, id);

    if (!result.has(id)) result.set(id, { id, engine, owners: new Set(), tables: new Set() });
    const rec = result.get(id);
    rec.owners.add(s.id);
    if (rec.engine === "Unknown" && engine !== "Unknown") rec.engine = engine;
    tables.forEach((tb) => rec.tables.add(tb));
  }

  const databases = [...result.values()].map((r) => ({
    id: r.id,
    engine: r.engine,
    owner: [...r.owners].join(" · "),
    tables: [...r.tables].slice(0, 12),
    target: null,
  }));

  return { databases, dbByService };
}

function findDbName(t) {
  const patterns = [
    /jdbc:\w+:\/\/[^/\s]+\/(\w+)/i,
    /mongodb(?:\+srv)?:\/\/[^/\s]+\/(\w+)/i,
    /(?:DATABASE_URL|DB_NAME|database)\s*[:=]\s*["']?[^"'\s]*?\/?(\w+_db)\b/i,
    /\b(\w+_db)\b/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && m[1] && m[1].length <= 32 && !/^(test|public|information_schema)$/i.test(m[1])) return m[1];
  }
  return null;
}

function collectTables(t, ext, tables) {
  let m;
  // SQL CREATE TABLE
  const sqlRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?["'`]?(\w+)["'`]?/gi;
  while ((m = sqlRe.exec(t))) tables.add(m[1].toLowerCase());

  // JPA @Entity + @Table(name="...")
  if (ext === ".java" || ext === ".kt") {
    const tblRe = /@Table\s*\(\s*name\s*=\s*["'](\w+)["']/g;
    while ((m = tblRe.exec(t))) tables.add(m[1].toLowerCase());
    if (/@Entity/.test(t)) {
      const cls = t.match(/class\s+(\w+)/);
      if (cls) tables.add(pluralize(cls[1].toLowerCase()));
    }
  }
  // Mongoose models / SQLAlchemy __tablename__
  if (ext === ".js" || ext === ".ts") {
    const mg = /(?:model|Schema)\s*\(\s*["'](\w+)["']/g;
    while ((m = mg.exec(t))) tables.add(m[1].toLowerCase());
  }
  if (ext === ".py") {
    const tn = /__tablename__\s*=\s*["'](\w+)["']/g;
    while ((m = tn.exec(t))) tables.add(m[1].toLowerCase());
  }
}

function pluralize(s) {
  if (/[^aeiou]y$/.test(s)) return s.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/.test(s)) return s + "es";
  return s + "s";
}
