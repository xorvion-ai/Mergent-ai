/* ============================================================
   MERGENT APP — sample analysis dataset
   The full 11 → 4 consolidation from PROJECT_BRIEF.md, wired
   through every screen. This is the shape the real backend
   (per-agent structured JSON) should produce.
   ============================================================ */
(function () {
  "use strict";

  /* ---- the analysis subject ---- */
  const repo = {
    name: "acme/commerce-platform",
    url: "https://github.com/acme/commerce-platform",
    source: "github",
    branch: "main",
    commit: "a3f9c21",
    sizeMb: 48.2,
    files: 3174,
    services: 11,
    scannedAt: "2026-06-14T09:42:00Z",
    languages: [
      { name: "Java", pct: 38, services: 3 },
      { name: "TypeScript", pct: 29, services: 4 },
      { name: "Python", pct: 19, services: 2 },
      { name: "Go", pct: 14, services: 2 },
    ],
  };

  /* ---- headline counters (drive overview + readouts) ---- */
  const summary = {
    servicesBefore: 11, servicesAfter: 4,
    depsBefore: 28, depsAfter: 6,
    dupApis: 9, endpoints: 94,
    dbBefore: 7, dbAfter: 3,
    risksHigh: 3, risksMed: 5, risksLow: 6,
    cyclesFound: 2,
    durationSec: 178,
    quotaUsed: 41, quotaTotal: 1500,
  };

  /* ---- 11 services (Agent 1: Service Discovery) ---- */
  // target: identity | core-user | commerce | messaging  (api-gateway → platform ingress)
  const services = [
    { id: "auth-service", lang: "Java", framework: "Spring Boot", port: 8080, files: 214, loc: 18420, endpoints: 12, db: "auth_db", domain: "Authentication & token issuance", target: "identity-service", confidence: 0.97 },
    { id: "admin-service", lang: "Java", framework: "Spring Boot", port: 8081, files: 168, loc: 13110, endpoints: 9, db: "admin_db", domain: "Admin console & RBAC", target: "identity-service", confidence: 0.91 },
    { id: "profile-service", lang: "TypeScript", framework: "Node / Express", port: 3002, files: 96, loc: 7240, endpoints: 11, db: "profile_db", domain: "User profiles & preferences", target: "identity-service", confidence: 0.88 },
    { id: "user-service", lang: "TypeScript", framework: "Node / Express", port: 3001, files: 121, loc: 9880, endpoints: 14, db: "user_db", domain: "User accounts & lifecycle", target: "core-user-service", confidence: 0.95 },
    { id: "account-service", lang: "Python", framework: "FastAPI", port: 8000, files: 88, loc: 6310, endpoints: 10, db: "user_db", domain: "Account settings & entitlements", target: "core-user-service", confidence: 0.9 },
    { id: "billing-service", lang: "Java", framework: "Spring Boot", port: 8090, files: 193, loc: 16540, endpoints: 13, db: "billing_db", domain: "Invoicing & subscriptions", target: "commerce-service", confidence: 0.96 },
    { id: "payment-service", lang: "Go", framework: "Gin", port: 9000, files: 74, loc: 5120, endpoints: 8, db: "billing_db", domain: "Payment capture & refunds", target: "commerce-service", confidence: 0.93 },
    { id: "notification-service", lang: "TypeScript", framework: "Node / Express", port: 3003, files: 67, loc: 4490, endpoints: 7, db: "notif_db", domain: "Notification orchestration", target: "messaging-service", confidence: 0.94 },
    { id: "email-service", lang: "Python", framework: "FastAPI", port: 8002, files: 52, loc: 3380, endpoints: 5, db: "notif_db", domain: "Transactional email delivery", target: "messaging-service", confidence: 0.92 },
    { id: "sms-service", lang: "Go", framework: "Gin", port: 9001, files: 41, loc: 2610, endpoints: 4, db: "sms_db", domain: "SMS / OTP delivery", target: "messaging-service", confidence: 0.9 },
    { id: "api-gateway", lang: "TypeScript", framework: "Node / Express", port: 8080, files: 59, loc: 3970, endpoints: 1, db: null, domain: "Ingress, routing & rate limiting", target: "platform-ingress", confidence: 0.99 },
  ];

  /* target services (Agent 5) */
  const targets = [
    { id: "identity-service", from: ["auth-service", "admin-service", "profile-service"], domain: "Identity, auth, RBAC & profiles", lang: "Java", db: "identity_db", endpoints: 24 },
    { id: "core-user-service", from: ["user-service", "account-service"], domain: "User accounts, lifecycle & entitlements", lang: "TypeScript", db: "commerce_db", endpoints: 18 },
    { id: "commerce-service", from: ["billing-service", "payment-service"], domain: "Billing, subscriptions & payments", lang: "Java", db: "commerce_db", endpoints: 16 },
    { id: "messaging-service", from: ["notification-service", "email-service", "sms-service"], domain: "Unified notification, email & SMS", lang: "TypeScript", db: "messaging_db", endpoints: 11 },
  ];

  /* ---- dependency edges (Agent 2) ---- */
  // type: http | queue | shared-db ; cycle: true marks members of a circular dep
  const dependencies = {
    edges: [
      { from: "api-gateway", to: "auth-service", type: "http", calls: 41 },
      { from: "api-gateway", to: "user-service", type: "http", calls: 38 },
      { from: "api-gateway", to: "billing-service", type: "http", calls: 22 },
      { from: "api-gateway", to: "profile-service", type: "http", calls: 17 },
      { from: "auth-service", to: "profile-service", type: "http", calls: 31, cycle: 1 },
      { from: "profile-service", to: "admin-service", type: "http", calls: 12, cycle: 1 },
      { from: "admin-service", to: "auth-service", type: "http", calls: 19, cycle: 1 },
      { from: "user-service", to: "auth-service", type: "http", calls: 44 },
      { from: "user-service", to: "account-service", type: "http", calls: 27 },
      { from: "account-service", to: "billing-service", type: "http", calls: 16 },
      { from: "billing-service", to: "payment-service", type: "http", calls: 29 },
      { from: "payment-service", to: "notification-service", type: "queue", calls: 18 },
      { from: "billing-service", to: "user-service", type: "http", calls: 21 },
      { from: "notification-service", to: "email-service", type: "queue", calls: 33, cycle: 2 },
      { from: "email-service", to: "notification-service", type: "http", calls: 9, cycle: 2 },
      { from: "notification-service", to: "sms-service", type: "queue", calls: 14 },
      { from: "profile-service", to: "notification-service", type: "queue", calls: 11 },
      { from: "admin-service", to: "billing-service", type: "http", calls: 8 },
      { from: "auth-service", to: "user-service", type: "shared-db", calls: 0 },
      { from: "account-service", to: "user-service", type: "shared-db", calls: 0 },
    ],
    cycles: [
      { id: 1, path: ["auth-service", "profile-service", "admin-service", "auth-service"], severity: "high", note: "Token refresh in auth-service calls profile-service, which calls admin-service for role hydration, which calls back to auth-service to validate. Deploys must be coordinated across all three." },
      { id: 2, path: ["notification-service", "email-service", "notification-service"], severity: "high", note: "notification-service enqueues to email-service, which calls back synchronously for template metadata — a request can block on its own queue consumer." },
    ],
  };

  /* ---- API endpoints + overlap (Agent 3) ---- */
  // overlap groups list semantically-equivalent endpoints across services
  const apiOverlaps = [
    { id: "G1", verb: "GET", path: "/users  ·  /user/list  ·  /profiles", kind: "Semantic duplicate", services: ["user-service", "admin-service", "profile-service"], note: "Three list endpoints return overlapping user objects with divergent field sets.", severity: "high" },
    { id: "G2", verb: "POST", path: "/login  ·  /auth/login", kind: "Exact duplicate", services: ["auth-service", "admin-service"], note: "admin-service ships its own copy of the login handler; drift risk on token format.", severity: "high" },
    { id: "G3", verb: "GET", path: "/user/{id}", kind: "Exact duplicate", services: ["profile-service", "user-service"], note: "Identical route, different response schema.", severity: "med" },
    { id: "G4", verb: "POST", path: "/notify  ·  /notifications/send", kind: "Semantic duplicate", services: ["notification-service", "email-service"], note: "Two entrypoints for the same delivery intent.", severity: "med" },
    { id: "G5", verb: "PUT", path: "/profile  ·  /account/profile", kind: "Semantic duplicate", services: ["profile-service", "account-service"], note: "Profile mutation split across two owners.", severity: "med" },
    { id: "G6", verb: "GET", path: "/permissions  ·  /roles", kind: "Overlapping", services: ["auth-service", "admin-service"], note: "RBAC reads duplicated between auth and admin.", severity: "med" },
    { id: "G7", verb: "POST", path: "/charge  ·  /payments", kind: "Semantic duplicate", services: ["billing-service", "payment-service"], note: "Payment capture exposed from both services.", severity: "med" },
    { id: "G8", verb: "GET", path: "/account  ·  /accounts/{id}", kind: "Overlapping", services: ["account-service", "user-service"], note: "Account read paths overlap.", severity: "low" },
    { id: "G9", verb: "DELETE", path: "/user/{id}  ·  /accounts/{id}", kind: "Conflicting", services: ["user-service", "account-service"], note: "Two delete paths with different cascade behavior — data-integrity risk.", severity: "high" },
  ];
  const apiStats = { total: 94, byVerb: { GET: 48, POST: 27, PUT: 11, DELETE: 8 }, duplicates: 9, clean: 76 };

  /* ---- databases (Agent 4) ---- */
  const databases = [
    { id: "auth_db", engine: "MySQL", owner: "auth-service", tables: ["users", "roles", "permissions", "sessions", "refresh_tokens"], rows: "1.2M", target: "identity_db" },
    { id: "admin_db", engine: "MySQL", owner: "admin-service", tables: ["admins", "users", "audit_log", "feature_flags"], rows: "210K", target: "identity_db" },
    { id: "profile_db", engine: "MongoDB", owner: "profile-service", tables: ["profiles", "avatars", "preferences"], rows: "980K", target: "identity_db" },
    { id: "user_db", engine: "PostgreSQL", owner: "user-service · account-service", tables: ["users", "accounts", "addresses", "entitlements"], rows: "2.4M", target: "commerce_db" },
    { id: "billing_db", engine: "PostgreSQL", owner: "billing-service · payment-service", tables: ["invoices", "subscriptions", "payments", "refunds"], rows: "3.1M", target: "commerce_db" },
    { id: "notif_db", engine: "MongoDB", owner: "notification-service · email-service", tables: ["messages", "templates", "delivery_log"], rows: "5.8M", target: "messaging_db" },
    { id: "sms_db", engine: "Redis", owner: "sms-service", tables: ["otp_cache", "rate_limits"], rows: "ephemeral", target: "messaging_db" },
  ];
  const dbMerges = [
    { target: "identity_db", engine: "PostgreSQL", from: ["auth_db", "admin_db", "profile_db"], conflict: "users", note: "Three independent `users` representations (MySQL ×2 + Mongo profiles). Merge on canonical user_id; profiles become a 1:1 extension table.", severity: "high" },
    { target: "commerce_db", engine: "PostgreSQL", from: ["user_db", "billing_db"], conflict: "foreign keys", note: "billing already FKs into user_db across the network. Co-locating removes 21 cross-service joins-over-HTTP.", severity: "med" },
    { target: "messaging_db", engine: "MongoDB", from: ["notif_db", "sms_db"], conflict: "none", note: "Move OTP cache into a TTL collection; delivery_log unifies email + SMS + push.", severity: "low" },
  ];

  /* ---- migration strategy (Agent 5) ---- */
  const migration = {
    rationale: "Consolidate 11 services into 4 domain-aligned services plus a thin ingress. Sequencing is dictated by the dependency graph: break the two cycles first, then merge leaf services upward toward their domain owner, collapsing shared databases last to avoid dual-write windows.",
    phases: [
      { n: 1, title: "Break circular dependencies", risk: "high", weeks: "1–2", services: ["auth-service", "profile-service", "admin-service", "notification-service", "email-service"], steps: ["Extract role hydration from profile→admin into a shared identity contract", "Replace email-service synchronous callback with an event on the message bus", "Verify both cycles are eliminated via re-run of the dependency agent"] },
      { n: 2, title: "Merge identity domain", risk: "med", weeks: "2–3", services: ["auth-service", "admin-service", "profile-service"], steps: ["Stand up identity-service skeleton (Spring Boot)", "Move login + token issuance, fold admin RBAC, attach profiles as extension", "Consolidate auth_db + admin_db + profile_db → identity_db", "Cut over api-gateway routes /auth, /admin, /profiles"] },
      { n: 3, title: "Merge core-user domain", risk: "med", weeks: "2", services: ["user-service", "account-service"], steps: ["Fold account-service (FastAPI) endpoints into user-service", "Deduplicate /user/{id} and /accounts/{id} response schemas", "Single owner for the users table"] },
      { n: 4, title: "Merge commerce domain", risk: "med", weeks: "2–3", services: ["billing-service", "payment-service"], steps: ["Combine billing + payment behind one transactional boundary", "Move payment-service off in-memory session state (Risk R3)", "Co-locate billing_db with user_db → commerce_db"] },
      { n: 5, title: "Unify messaging", risk: "low", weeks: "1–2", services: ["notification-service", "email-service", "sms-service"], steps: ["Single messaging-service with channel adapters (email / SMS / push)", "Merge notif_db + sms_db → messaging_db", "Deprecate duplicate /notify entrypoints"] },
      { n: 6, title: "Thin the gateway & decommission", risk: "low", weeks: "1", services: ["api-gateway"], steps: ["Reduce gateway to routing + auth + rate-limit", "Remove retired service routes", "Archive the 7 decommissioned services"] },
    ],
    totalWeeks: "9–13",
  };

  /* ---- risk register (Agent 6) ---- */
  const risks = [
    { id: "R1", level: "high", title: "Shared `users` table across 3 services", signal: "shared database", impact: "auth-service, admin-service and user-service all read/write a `users` representation. A schema change requires a coordinated, atomic deploy of three services.", mitigation: "Establish a single owner (identity-service) and expose user reads via API + read replica during transition." },
    { id: "R2", level: "high", title: "Circular dependency: auth → profile → admin → auth", signal: "circular dependency", impact: "No service in the cycle can be deployed or rolled back independently; a failure cascades around the ring.", mitigation: "Extract the shared role contract; break the cycle before any merge (Phase 1)." },
    { id: "R3", level: "high", title: "payment-service holds in-memory session state", signal: "statefulness", impact: "Cannot scale horizontally or restart without dropping in-flight payment sessions — a correctness and availability risk.", mitigation: "Externalize session to commerce_db / Redis before merging into commerce-service." },
    { id: "R4", level: "med", title: "9 duplicate / semantically-equivalent endpoints", signal: "duplicate APIs", impact: "Behavioral drift between copies (e.g. two /login handlers) produces inconsistent tokens and hard-to-debug auth failures.", mitigation: "Converge on one owner per capability during the domain merges." },
    { id: "R5", level: "med", title: "Mongo ↔ Postgres schema divergence on identity merge", signal: "schema mismatch", impact: "profile_db (document) and auth_db (relational) model the user differently; a naive merge loses nested preference data.", mitigation: "Map profiles to a JSONB extension column keyed on canonical user_id." },
    { id: "R6", level: "med", title: "Hard-coded service URLs in config", signal: "no service discovery", impact: "Service endpoints are pinned in 14 config files; consolidation will silently break stale references.", mitigation: "Introduce env-driven discovery before cutover; lint for hard-coded hosts." },
    { id: "R7", level: "med", title: "Dual writers to audit_log", signal: "shared database", impact: "auth-service and admin-service both append to audit_log with different schemas, producing inconsistent audit trails.", mitigation: "Single audit emitter in identity-service." },
    { id: "R8", level: "med", title: "No API versioning across services", signal: "compatibility", impact: "Cutover route changes have no version fallback for in-flight clients.", mitigation: "Introduce /v1 prefixes at the gateway before merges." },
    { id: "R9", level: "low", title: "sms-service is stateless & isolated", signal: "stateless service", impact: "Low-risk merge candidate; only Redis OTP cache to migrate.", mitigation: "Fold into messaging-service last." },
    { id: "R10", level: "low", title: "Health endpoints duplicated everywhere", signal: "duplicate APIs", impact: "Cosmetic; /health exists on all 11 — no behavioral risk.", mitigation: "Standardize in the gateway." },
    { id: "R11", level: "low", title: "email-service has no retry backoff", signal: "resilience", impact: "Transient SMTP failures drop messages; isolated to one service.", mitigation: "Add exponential backoff during messaging unification." },
  ];

  /* ---- Jira backlog (simulated, real-shaped) (Agent 7) ---- */
  const jira = [
    { key: "MIG-1", title: "Extract shared identity role contract", epic: "Break cycles", priority: "Highest", points: 8, status: "To Do", deps: [], desc: "Introduce a versioned role/permission contract consumed by auth, profile and admin to eliminate the profile→admin→auth cycle." },
    { key: "MIG-2", title: "Replace email-service sync callback with event", epic: "Break cycles", priority: "Highest", points: 5, status: "To Do", deps: [], desc: "notification→email→notification becomes fire-and-forget over the message bus." },
    { key: "MIG-3", title: "Stand up identity-service skeleton", epic: "Identity merge", priority: "High", points: 5, status: "To Do", deps: ["MIG-1"], desc: "Spring Boot service scaffold with health, config and CI." },
    { key: "MIG-4", title: "Migrate login & token issuance to identity-service", epic: "Identity merge", priority: "High", points: 8, status: "To Do", deps: ["MIG-3"], desc: "Move POST /login, token refresh; deprecate admin-service duplicate." },
    { key: "MIG-5", title: "Consolidate auth_db + admin_db + profile_db → identity_db", epic: "Identity merge", priority: "High", points: 13, status: "To Do", deps: ["MIG-4"], desc: "Merge three users representations on canonical user_id; profiles → JSONB extension." },
    { key: "MIG-6", title: "Cut over gateway routes /auth /admin /profiles", epic: "Identity merge", priority: "Medium", points: 3, status: "To Do", deps: ["MIG-5"], desc: "Repoint ingress; remove retired routes." },
    { key: "MIG-7", title: "Fold account-service into user-service", epic: "Core-user merge", priority: "High", points: 8, status: "To Do", deps: [], desc: "Merge FastAPI endpoints; dedupe /user/{id} vs /accounts/{id}." },
    { key: "MIG-8", title: "Single owner for users table", epic: "Core-user merge", priority: "Medium", points: 5, status: "To Do", deps: ["MIG-7"], desc: "Resolve R1 — remove cross-service writes." },
    { key: "MIG-9", title: "Externalize payment-service session state", epic: "Commerce merge", priority: "Highest", points: 8, status: "To Do", deps: [], desc: "Resolve R3 before merge — move in-memory sessions to store." },
    { key: "MIG-10", title: "Merge billing + payment → commerce-service", epic: "Commerce merge", priority: "High", points: 13, status: "To Do", deps: ["MIG-9"], desc: "One transactional boundary for invoicing + capture + refunds." },
    { key: "MIG-11", title: "Co-locate billing_db + user_db → commerce_db", epic: "Commerce merge", priority: "Medium", points: 8, status: "To Do", deps: ["MIG-10", "MIG-8"], desc: "Remove 21 joins-over-HTTP." },
    { key: "MIG-12", title: "Unify messaging-service with channel adapters", epic: "Messaging", priority: "Medium", points: 8, status: "To Do", deps: ["MIG-2"], desc: "email / SMS / push behind one service; merge notif_db + sms_db." },
    { key: "MIG-13", title: "Introduce /v1 versioning at gateway", epic: "Platform", priority: "Medium", points: 3, status: "To Do", deps: [], desc: "Resolve R8 — version prefixes before cutovers." },
    { key: "MIG-14", title: "Decommission 7 retired services", epic: "Platform", priority: "Low", points: 3, status: "To Do", deps: ["MIG-6", "MIG-11", "MIG-12"], desc: "Archive repos, remove pipelines, update runbooks." },
  ];

  /* ---- the 7 agents (drives the streaming run + pipeline) ---- */
  const agents = [
    { n: 1, id: "discovery", name: "Service Discovery", role: "parse", run: "scanning build files & Dockerfiles…", done: "11 services · 4 languages", parse: "Detect each service, framework, language & port from pom.xml, package.json, requirements.txt, go.mod, Dockerfiles.", reason: "Label each service's likely domain; normalize edge cases the parser missed.", output: { service: "auth-service", framework: "Spring Boot", language: "Java", port: 8080, domain: "Authentication & token issuance" } },
    { n: 2, id: "deps", name: "Dependency Mapping", role: "reason", run: "tracing inter-service calls…", done: "28 edges · 2 cycles", parse: "Extract HTTP client calls, service URLs in config, queue topics & env refs into edges. Run cycle detection.", reason: "Resolve ambiguous references to services and summarize the graph.", output: { edges: 28, cycles: [["auth", "profile", "admin", "auth"]] } },
    { n: 3, id: "apis", name: "API Analysis", role: "reason", run: "normalizing endpoints…", done: "94 endpoints · 9 duplicates", parse: "Extract every endpoint from controllers/routes + OpenAPI specs into {service, method, path}.", reason: "Detect overlap / duplication / semantic equivalence across services.", output: { total: 94, duplicates: 9 } },
    { n: 4, id: "db", name: "Database Analysis", role: "reason", run: "inventorying datastores…", done: "7 stores · 3 mergeable", parse: "Detect datastores from configs/ORM/migrations; inventory tables & owning service.", reason: "Suggest consolidation opportunities with rationale.", output: { stores: 7, merges: 3 } },
    { n: 5, id: "strategy", name: "Migration Strategy", role: "reason", run: "planning target architecture…", done: "11 → 4 services", parse: "Assemble structured output of agents 1–4 into a compact facts bundle.", reason: "Produce Current → Target architecture with ordered, justified steps.", output: { before: 11, after: 4, phases: 6 } },
    { n: 6, id: "risk", name: "Risk Analysis", role: "reason", run: "classifying risks…", done: "3 high · 5 medium · 6 low", parse: "Derive risk signals — shared DBs, cycles, duplicate APIs, statefulness.", reason: "Classify High/Med/Low with impact + mitigation.", output: { high: 3, med: 5, low: 6 } },
    { n: 7, id: "docs", name: "Documentation", role: "parse", run: "writing report & backlog…", done: "report + 14 Jira tasks", parse: "Assemble all prior output; render report scaffold + diagram embeds.", reason: "Write migration plan, rollback strategy & executive summary prose.", output: { report: "ready", tasks: 14 } },
  ];

  /* ---- recent analyses (dashboard) ---- */
  const recent = [
    { repo: "acme/commerce-platform", source: "github", services: 11, after: 4, risksHigh: 3, when: "just now", status: "complete", active: true },
    { repo: "internal/payments-mono", source: "zip", services: 6, after: 3, risksHigh: 1, when: "2 days ago", status: "complete" },
    { repo: "acme/legacy-crm", source: "github", services: 9, after: 4, risksHigh: 2, when: "5 days ago", status: "complete" },
  ];

  const sampleRepos = [
    { name: "acme/commerce-platform", langs: "Java · TS · Python · Go", services: 11, blurb: "The flagship 11-service sprawl. Two cycles, shared user tables, duplicate auth." },
    { name: "internal/payments-mono", langs: "Go · Python", services: 6, blurb: "A payments mono-repo with overlapping ledger APIs." },
    { name: "acme/legacy-crm", langs: "Java · TS", services: 9, blurb: "A CRM with a tangled notification fan-out." },
  ];

  window.MERGENT_DATA = {
    repo, summary, services, targets, dependencies,
    apiOverlaps, apiStats, databases, dbMerges,
    migration, risks, jira, agents, recent, sampleRepos,
  };
})();
