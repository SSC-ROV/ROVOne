import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { ChecklistItem } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function canEditTask(
  user: { id: number; role: string },
  taskId: number
): boolean {
  const task = db
    .prepare("SELECT assignee_id, created_by FROM tasks WHERE id = ?")
    .get(taskId) as
    | { assignee_id: number | null; created_by: number | null }
    | undefined;
  if (!task) return false;
  return (
    user.role === "leader" ||
    user.id === task.assignee_id ||
    user.id === task.created_by
  );
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!canEditTask(user, taskId)) {
    return NextResponse.json({ error: "沒有權限" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = String(body?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "請填寫內容" }, { status: 400 });
  const info = db
    .prepare(
      "INSERT INTO checklist_items (task_id, text, done, sort_order) VALUES (?, ?, 0, ?)"
    )
    .run(taskId, text, Date.now());
  const item = db
    .prepare("SELECT * FROM checklist_items WHERE id = ?")
    .get(info.lastInsertRowid) as unknown as ChecklistItem;
  return NextResponse.json({ item });
}
