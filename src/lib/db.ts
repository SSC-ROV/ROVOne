import { randomBytes } from "crypto";
import { sql } from "./pg";
import type { ChecklistItem, Part, Settings, Task, TeamEvent } from "./types";

export async function getSettings(): Promise<Settings> {
  const rows = await sql`SELECT key, value FROM settings`;
  const s: Settings = { team_name: "ROV 隊", competition_date: null };
  for (const r of rows) {
    if (r.key === "team_name") s.team_name = String(r.value);
    if (r.key === "competition_date") s.competition_date = r.value || null;
  }
  return s;
}

export async function setSetting(key: string, value: string) {
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

export async function getSettingValue(key: string): Promise<string | null> {
  const [row] = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return row ? String(row.value) : null;
}

/** iCal 訂閱 token：沒有就現場產生 */
export async function getOrCreateIcalToken(): Promise<string> {
  let token = await getSettingValue("ical_token");
  if (!token) {
    token = randomBytes(16).toString("hex");
    await setSetting("ical_token", token);
  }
  return token;
}

export type TaskRow = Omit<Task, "items">;

export async function getTaskWithItems(id: number): Promise<Task | undefined> {
  const [task] = await sql`
    SELECT t.*, u.display_name AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = ${id}`;
  if (!task) return undefined;
  const items = await sql`
    SELECT * FROM checklist_items WHERE task_id = ${id} ORDER BY sort_order, id`;
  return { ...(task as TaskRow), items: items as unknown as ChecklistItem[] };
}

export async function getEvents(): Promise<TeamEvent[]> {
  return (await sql`
    SELECT * FROM events
    ORDER BY date, (time IS NOT NULL), time, id`) as unknown as TeamEvent[];
}

export async function getPartByToken(token: string): Promise<Part | undefined> {
  const [part] = await sql`SELECT * FROM parts WHERE approve_token = ${token}`;
  return part as Part | undefined;
}
