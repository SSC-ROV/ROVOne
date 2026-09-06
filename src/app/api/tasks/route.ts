import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { fmtDue, notifyDiscord } from "@/lib/notify";
import type { ChecklistItem, Task } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const rows = db
    .prepare(
      `SELECT t.*, u.display_name AS assignee_name
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       ORDER BY t.id`
    )
    .all() as unknown as (Omit<Task, "items">)[];
  const items = db
    .prepare("SELECT * FROM checklist_items ORDER BY sort_order, id")
    .all() as unknown as ChecklistItem[];
  const byTask = new Map<number, ChecklistItem[]>();
  for (const it of items) {
    const arr = byTask.get(it.task_id) ?? [];
    arr.push(it);
    byTask.set(it.task_id, arr);
  }
  const tasks: Task[] = rows.map((r) => ({
    ...r,
    items: byTask.get(r.id) ?? [],
  }));
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "請填寫任務標題" }, { status: 400 });
  }
  const info = db
    .prepare(
      `INSERT INTO tasks (title, description, status, priority, subteam, due_date, assignee_id, created_by, mission_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      String(body?.description ?? ""),
      String(body?.status ?? "todo"),
      String(body?.priority ?? "medium"),
      String(body?.subteam ?? "general"),
      (body?.due_date as string) || null,
      (body?.assignee_id as number) || null,
      user.id,
      (body?.mission_id as number) || null
    );
  const task = db
    .prepare(
      `SELECT t.*, u.display_name AS assignee_name
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.id = ?`
    )
    .get(info.lastInsertRowid) as unknown as Omit<Task, "items">;
  if (task.assignee_id && task.assignee_id !== user.id) {
    notifyDiscord(
      `📋 新任務指派給 ${task.assignee_name ?? "隊員"}：「${task.title}」${fmtDue(task.due_date)}`
    ).catch(() => {});
  }
  return NextResponse.json({ task: { ...task, items: [] } satisfies Task });
}
