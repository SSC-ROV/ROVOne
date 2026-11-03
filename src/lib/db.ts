import { randomBytes } from "crypto";
import { sql } from "./pg";
import type { ChecklistItem, Part, Settings, Task, TaskAssignee, TeamEvent } from "./types";

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
export const DEFAULT_SUBTEAMS: { key: string; zh: string; en: string }[] = [
  { key: "mech", zh: "機械", en: "Mechanical" },
  { key: "elec", zh: "電控", en: "Electronics" },
  { key: "sw", zh: "軟體", en: "Software" },
  { key: "pilot", zh: "操控", en: "Pilot" },
  { key: "general", zh: "全隊", en: "Team" },
];

export async function getSubteams(): Promise<{ key: string; zh: string; en: string }[]> {
  const raw = await getSettingValue("subteams");
  if (!raw) return DEFAULT_SUBTEAMS;
  try {
    const list = JSON.parse(raw) as { key: string; zh: string; en: string }[];
    if (Array.isArray(list) && list.length > 0) return list;
  } catch {}
  return DEFAULT_SUBTEAMS;
}

export async function setSubteams(list: { key: string; zh: string; en: string }[]) {
  await setSetting("subteams", JSON.stringify(list));
}

export async function getOrCreateIcalToken(): Promise<string> {
  let token = await getSettingValue("ical_token");
  if (!token) {
    token = randomBytes(16).toString("hex");
    await setSetting("ical_token", token);
  }
  return token;
}

/** 團隊看板（Raspberry Pi 長期顯示）專用連結令牌 */
export async function getOrCreateDisplayToken(): Promise<string> {
  let token = await getSettingValue("display_token");
  if (!token) {
    token = randomBytes(16).toString("hex");
    await setSetting("display_token", token);
  }
  return token;
}

export type TaskRow = Omit<Task, "items">;

/**
 * Fills in `assignees` (and `assignee_ids`) for task rows. Reads the `assignee_ids` column when the
 * multi-assignee migration has run; before that, falls back to the single `assignee_id`.
 */
export async function withAssignees<T extends Record<string, unknown>>(rows: T[]): Promise<(T & Pick<Task, "assignees" | "assignee_ids">)[]> {
  const byTask = new Map<number, TaskAssignee[]>();
  const ids = rows.map((row) => Number(row.id));
  if (ids.length && rows.some((row) => Array.isArray(row.assignee_ids))) {
    try {
      const found = await sql`
        SELECT t.id AS task_id, a.id, a.display_name
        FROM tasks t JOIN users a ON a.id = ANY(t.assignee_ids)
        WHERE t.id = ANY(${ids})
        ORDER BY t.id, array_position(t.assignee_ids, a.id)`;
      for (const r of found) {
        const list = byTask.get(Number(r.task_id)) ?? [];
        list.push({ id: Number(r.id), display_name: String(r.display_name) });
        byTask.set(Number(r.task_id), list);
      }
    } catch {
      /* column missing: use assignee_id below */
    }
  }
  return rows.map((row) => {
    let assignees = byTask.get(Number(row.id));
    if (!assignees) {
      assignees = row.assignee_id ? [{ id: Number(row.assignee_id), display_name: String(row.assignee_name ?? "") }] : [];
    }
    return { ...row, assignees, assignee_ids: assignees.map((person) => person.id) };
  });
}

/** Normalises an `assignee_ids` request value into unique positive ids, keeping the order. */
export function parseAssigneeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

/** Saves the assignee list (first one also goes in `assignee_id`). Tolerates a missing `assignee_ids` column. */
export async function saveAssignees(taskId: number, ids: number[]) {
  await sql`UPDATE tasks SET assignee_id = ${ids[0] ?? null} WHERE id = ${taskId}`;
  try {
    await sql`UPDATE tasks SET assignee_ids = ${"{" + ids.join(",") + "}"}::int[] WHERE id = ${taskId}`;
  } catch {
    /* multi-assignee migration not run yet */
  }
}

/** True when the user is one of the task's assignees (works before and after the migration). */
export function isTaskAssignee(row: { assignee_id?: number | null; assignee_ids?: number[] | null }, userId: number) {
  return row.assignee_id === userId || (Array.isArray(row.assignee_ids) && row.assignee_ids.map(Number).includes(userId));
}

export async function getTaskWithItems(id: number): Promise<Task | undefined> {
  const [task] = await sql`
    SELECT t.*, u.display_name AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = ${id}`;
  if (!task) return undefined;
  const [withPeople] = await withAssignees([task as Record<string, unknown>]);
  const items = await sql`
    SELECT * FROM checklist_items WHERE task_id = ${id} ORDER BY sort_order, id`;
  return { ...(withPeople as unknown as TaskRow), items: items as unknown as ChecklistItem[] };
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
