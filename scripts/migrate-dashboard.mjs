// Per-person dashboard layouts (the app also creates this table on first use).
// Run: node --env-file=.env.local scripts/migrate-dashboard.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });
await sql`CREATE TABLE IF NOT EXISTS dashboard_layouts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  layout JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
await sql`ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY`;
const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM dashboard_layouts`;
console.log(`dashboard_layouts ready, ${n} saved layouts.`);
await sql.end();
