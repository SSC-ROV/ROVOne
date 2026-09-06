import { NextRequest, NextResponse } from "next/server";
import db, { getTaskWithItems } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { fmtDue, notifyDiscord } from "@/lib/notify";
import type { Task } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function canEdit(
  user: { id: number; role: string },
  task: { assignee_id: number | null; created_by: number | null }
): boolean {
  return (
    user.role === "leader" ||
    user.id === task.assignee_id ||
    user.id === task.created_by
  );
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const taskId = Number(id);
  const existing = db
    .prepare("SELECT id, title, status, assignee_id, created_by FROM tasks WHERE id = ?")
    .get(taskId) as
    | (Pick<Task, "assignee_id" | "created_by" | "status" | "title"> & { id: number })
    | undefined;
  if (!existing) return NextResponse.json({ error: "任務不存在" }, { status: 404 });
  if (!canEdit(user, existing)) {
    return NextResponse.json(
      { error: "只有隊長、負責人或建立者可以修改這個任務" },
      { status: 403 }
    );
  }
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });

  const fields: string[] = [];
  const values: unknown[] = [];
  const allow = [
    "title",
    "description",
    "status",
    "priority",
    "subteam",
  ] as const;
  for (const key of allow) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(String(body[key]));
    }
  }
  if (body.due_date !== undefined) {
    fields.push("due_date = ?");
    values.push((body.due_date as string) || null);
  }
  if (body.assignee_id !== undefined) {
    fields.push("assignee_id = ?");
    values.push((body.assignee_id as number) || null);
  }
  if (body.mission_id !== undefined) {
    fields.push("mission_id = ?");
    values.push((body.mission_id as number) || null);
  }
  if (body.status !== undefined) {
    fields.push("completed_at = ?");
    values.push(body.status === "done" ? new Date().toISOString() : null);
  }
  if (fields.length === 0) {
    return NextResponse.json({ error: "沒有要更新的欄位" }, { status: 400 });
  }
  values.push(taskId);
  db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(
    ...(values as never[])
  );
  const updated = getTaskWithItems(taskId)!;
  if (
    body.assignee_id !== undefined &&
    updated.assignee_id &&
    updated.assignee_id !== existing.assignee_id
  ) {
    notifyDiscord(
      `📋 任務「${updated.title}」改指派給 ${updated.assignee_name ?? "隊員"}${fmtDue(updated.due_date)}`
    ).catch(() => {});
  }
  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (user.role !== "leader") {
    return NextResponse.json({ error: "只有隊長可以刪除任務" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(Number(id));
  if (info.changes === 0) {
    return NextResponse.json({ error: "任務不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
