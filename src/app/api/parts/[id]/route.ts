import { isStaff } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json(
      { error: "採買進度由隊長更新；申請中的項目可直接請隊長處理" },
      { status: 403 }
    );
  }
  const { id } = await ctx.params;
  const partId = Number(id);
  const existing = db.prepare("SELECT status FROM parts WHERE id = ?").get(partId) as
    | { status: string }
    | undefined;
  if (!existing) return NextResponse.json({ error: "零件不存在" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of [
    "name",
    "spec",
    "link",
    "unit",
    "purpose",
    "subteam",
    "order_vendor",
    "order_ref",
  ] as const) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(String(body[key]));
    }
  }
  for (const key of ["qty", "est_price"] as const) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(Math.max(0, Number(body[key]) || 0));
    }
  }
  if (body.actual_price !== undefined) {
    fields.push("actual_price = ?");
    values.push(body.actual_price === null || body.actual_price === "" ? null : Number(body.actual_price));
  }
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!["pending", "approved", "rejected", "ordered", "arrived"].includes(status)) {
      return NextResponse.json({ error: "狀態不正確" }, { status: 400 });
    }
    fields.push("status = ?");
    values.push(status);
    if (status === "approved" || status === "rejected") {
      fields.push("decided_at = ?");
      values.push(new Date().toISOString());
    }
    if (status === "ordered") {
      fields.push("ordered_by = ?");
      values.push(user.id);
    }
    if (status === "arrived") {
      fields.push("arrived_at = ?");
      values.push(new Date().toISOString());
    }
  }
  if (fields.length === 0) {
    return NextResponse.json({ error: "沒有要更新的欄位" }, { status: 400 });
  }
  values.push(partId);
  db.prepare(`UPDATE parts SET ${fields.join(", ")} WHERE id = ?`).run(
    ...(values as never[])
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const partId = Number(id);
  const part = db
    .prepare("SELECT status, requested_by FROM parts WHERE id = ?")
    .get(partId) as
    | { status: string; requested_by: number | null }
    | undefined;
  if (!part) return NextResponse.json({ error: "零件不存在" }, { status: 404 });
  const isOwnerPending =
    part.status === "pending" && part.requested_by === user.id;
  if (!isStaff(user.role) && !isOwnerPending) {
    return NextResponse.json(
      { error: "只有隊長可以刪除；申請人只能刪除自己待審批的申請" },
      { status: 403 }
    );
  }
  db.prepare("DELETE FROM parts WHERE id = ?").run(partId);
  return NextResponse.json({ ok: true });
}
