import { sql } from "./pg";
import { sanitizeLayout, type DashboardLayout } from "./dashboard/catalog";

/**
 * One saved dashboard layout per person. The table is created on first use (CREATE IF NOT EXISTS),
 * so a deploy works without a manual migration; scripts/migrate-dashboard.mjs can create it ahead of time.
 */
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS dashboard_layouts (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        layout JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export async function getDashboardLayout(userId: number): Promise<DashboardLayout | null> {
  await ensureSchema();
  const [row] = await sql`SELECT layout FROM dashboard_layouts WHERE user_id = ${userId}`;
  if (!row) return null;
  const raw = typeof row.layout === "string" ? JSON.parse(row.layout) : row.layout;
  return sanitizeLayout(raw);
}

export async function saveDashboardLayout(userId: number, layout: DashboardLayout): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO dashboard_layouts (user_id, layout, updated_at)
    VALUES (${userId}, ${sql.json(layout as never)}, now())
    ON CONFLICT (user_id) DO UPDATE SET layout = EXCLUDED.layout, updated_at = now()`;
}

export async function deleteDashboardLayout(userId: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM dashboard_layouts WHERE user_id = ${userId}`;
}
