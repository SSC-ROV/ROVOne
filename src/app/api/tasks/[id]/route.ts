import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { getTaskWithItems, isTaskAssignee, parseAssigneeIds, saveAssignees } from "@/lib/db";
import { fmtDue, notifyDiscord } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import { logActivity } from "@/lib/activity";
import type { Task } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function isStaffRole(role: string) {
  return role === "leader" || role === "teacher";
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const taskId = Number(id);
  const [cur] = await sql`
    SELECT * FROM tasks WHERE id = ${taskId}`;
  if (!cur) return NextResponse.json({ error: "任務不存在" }, { status: 404 });
  const current = cur as unknown as {
    id: number; title: string; description: string; status: string;
    priority: string; subteam: string; due_date: string | null;
    assignee_id: number | null; assignee_ids?: number[] | null; created_by: number | null;
    cycle_id: number | null; completed_at: string | null; version: number;
  };
  const allowed =
    isStaffRole(user.role) ||
    isTaskAssignee(current, user.id) ||
    user.id === current.created_by;
  if (!allowed) {
    return NextResponse.json(
      { error: "只有隊長、負責人或建立者可以修改這個任務" },
      { status: 403 }
    );
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });

  // 樂觀鎖：用戶端帶上讀取時的 version，不一致代表已被他人修改
  if (body.version !== undefined && Number(body.version) !== current.version) {
    return NextResponse.json(
      { error: "這項資料已被其他人修改，請重新整理後再試" },
      { status: 409 }
    );
  }

  if (body.reorder === "up" || body.reorder === "down") {
    if (!current.cycle_id) {
      return NextResponse.json({ error: "任務必須歸屬一個專案" }, { status: 400 });
    }
    const siblings = await sql`
      SELECT id, sort_order FROM tasks
      WHERE cycle_id = ${current.cycle_id}
      ORDER BY sort_order, id`;
    const list = (siblings as unknown as { id: number; sort_order: number }[]).map((row, i) => ({
      id: Number(row.id),
      sort_order: i,
    }));
    const idx = list.findIndex((row) => row.id === taskId);
    const swapWith = body.reorder === "up" ? idx - 1 : idx + 1;
    if (idx >= 0 && swapWith >= 0 && swapWith < list.length) {
      const tmp = list[idx].sort_order;
      list[idx].sort_order = list[swapWith].sort_order;
      list[swapWith].sort_order = tmp;
      for (const row of list) {
        await sql`UPDATE tasks SET sort_order = ${row.sort_order} WHERE id = ${row.id}`;
      }
      await sql`UPDATE tasks SET version = version + 1 WHERE id = ${taskId}`;
    }
    return NextResponse.json({ task: await getTaskWithItems(taskId) });
  }

  const title = body.title !== undefined ? String(body.title).trim() : current.title;
  if (!title) return NextResponse.json({ error: "標題不可空白" }, { status: 400 });
  const status = body.status !== undefined ? String(body.status) : current.status;
  // `assignee_ids` sets the whole list; the older `assignee_id` replaces it with one person (or nobody).
  const nextAssignees =
    body.assignee_ids !== undefined
      ? parseAssigneeIds(body.assignee_ids)
      : body.assignee_id !== undefined
        ? parseAssigneeIds([body.assignee_id])
        : null;
  const prevAssignees = nextAssignees ? ((await getTaskWithItems(taskId))?.assignees ?? []) : [];

  await sql`
    UPDATE tasks SET
      title = ${title},
      description = ${body.description !== undefined ? String(body.description) : current.description},
      status = ${status},
      priority = ${body.priority !== undefined ? String(body.priority) : current.priority},
      subteam = ${body.subteam !== undefined ? String(body.subteam) : current.subteam},
      due_date = ${body.due_date !== undefined ? (body.due_date as string) || null : current.due_date},
      cycle_id = ${body.cycle_id !== undefined ? (body.cycle_id as number) || null : current.cycle_id},
      completed_at = ${body.status !== undefined ? (status === "done" ? new Date().toISOString() : null) : current.completed_at},
      version = version + 1
    WHERE id = ${taskId}`;

  if (nextAssignees) await saveAssignees(taskId, nextAssignees);

  // Kept separate so the rest of the update still works before the start_date migration has run.
  const startDate = body.start_date !== undefined ? (body.start_date as string) || null : undefined;
  if (startDate !== undefined) await sql`UPDATE tasks SET start_date = ${startDate} WHERE id = ${taskId}`;

  const updated = (await getTaskWithItems(taskId))!;
  const prevStart = (current as unknown as { start_date?: string | null }).start_date ?? null;
  if (startDate !== undefined && startDate !== prevStart) {
    await logActivity(taskId, user.id, "start_date", { from: prevStart, to: startDate });
  }

  // Timeline entries for meaningful changes
  if (updated.status !== current.status) await logActivity(taskId, user.id, "status", { from: current.status, to: updated.status });
  if (updated.priority !== current.priority) await logActivity(taskId, user.id, "priority", { from: current.priority, to: updated.priority });
  if ((updated.due_date ?? null) !== (current.due_date ?? null)) await logActivity(taskId, user.id, "due_date", { from: current.due_date, to: updated.due_date });
  if ((updated.cycle_id ?? null) !== (current.cycle_id ?? null)) await logActivity(taskId, user.id, "project", { from: current.cycle_id, to: updated.cycle_id });
  if (updated.title !== current.title) await logActivity(taskId, user.id, "title", { from: current.title, to: updated.title });
  if (nextAssignees) {
    const prevIds = new Set(prevAssignees.map((person) => person.id));
    const nextIds = new Set(updated.assignees.map((person) => person.id));
    const added = updated.assignees.filter((person) => !prevIds.has(person.id));
    const removed = prevAssignees.filter((person) => !nextIds.has(person.id));
    if (added.length || removed.length) {
      await logActivity(taskId, user.id, "assignee", {
        added: added.map((person) => ({ id: person.id, name: person.display_name })),
        removed: removed.map((person) => ({ id: person.id, name: person.display_name })),
        // Older timeline readers look at `to` / `to_name`.
        to: updated.assignee_id,
        to_name: updated.assignee_name,
      });
    }
    const notify = added.filter((person) => person.id !== user.id);
    if (notify.length) {
      notifyDiscord(
        `📋 任務「${updated.title}」指派給 ${notify.map((person) => person.display_name).join("、")}${fmtDue(updated.due_date)}`
      ).catch(() => {});
    }
  }
  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaffRole(user.role)) {
    return NextResponse.json({ error: "只有隊長可以刪除任務" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = await sql`DELETE FROM tasks WHERE id = ${Number(id)}`;
  if (info.count === 0) {
    return NextResponse.json({ error: "任務不存在" }, { status: 404 });
  }
  await logAudit(user.id, user.username, "task.delete", `task:${id}`);
  return NextResponse.json({ ok: true });
}
