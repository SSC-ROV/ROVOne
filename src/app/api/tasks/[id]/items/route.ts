import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const taskId = Number(id);
  const [task] = await sql`
    SELECT assignee_id, created_by FROM tasks WHERE id = ${taskId}`;
  if (!task) return NextResponse.json({ error: "任務不存在" }, { status: 404 });
  const t = task as { assignee_id: number | null; created_by: number | null };
  if (!isStaff(user.role) && user.id !== t.assignee_id && user.id !== t.created_by) {
    return NextResponse.json({ error: "沒有權限" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = String(body?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "請填寫內容" }, { status: 400 });
  const [item] = await sql`
    INSERT INTO checklist_items (task_id, text, done, sort_order)
    VALUES (${taskId}, ${text}, 0, ${Date.now()})
    RETURNING id, task_id, text, done, sort_order`;
  return NextResponse.json({ item });
}
