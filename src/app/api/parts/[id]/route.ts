import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { getPartByToken } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { pushToUsers } from "@/lib/push";
import { after } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json(
      { error: "採買進度由隊長或老師更新；申請中的項目可直接請隊長處理" },
      { status: 403 }
    );
  }
  const { id } = await ctx.params;
  const partId = Number(id);
  const [existing] = await sql`SELECT status FROM parts WHERE id = ${partId}`;
  if (!existing) return NextResponse.json({ error: "零件不存在" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });

  const [cur] = await sql`SELECT * FROM parts WHERE id = ${partId}`;
  const c = cur as unknown as {
    name: string; spec: string; link: string; qty: number; unit: string;
    est_price: number; actual_price: number | null; purpose: string;
    subteam: string; status: string; decided_at: string | null; decided_note: string | null;
    order_vendor: string; order_ref: string; ordered_by: number | null; arrived_at: string | null;
    requested_by: number;
  };
  const status = body.status !== undefined ? String(body.status) : c.status;
  if (!["pending", "approved", "rejected", "ordered", "arrived"].includes(status)) {
    return NextResponse.json({ error: "狀態不正確" }, { status: 400 });
  }
  const actual =
    body.actual_price !== undefined
      ? body.actual_price === null || body.actual_price === ""
        ? null
        : Number(body.actual_price)
      : (c.actual_price as number | null);
  const decidedNote =
    body.decided_note !== undefined ? String(body.decided_note) : (c.decided_note as string | null);
  await sql`
    UPDATE parts SET
      name = ${body.name !== undefined ? String(body.name).trim() || String(c.name) : String(c.name)},
      spec = ${body.spec !== undefined ? String(body.spec) : String(c.spec)},
      link = ${body.link !== undefined ? String(body.link) : String(c.link)},
      qty = ${body.qty !== undefined ? Math.max(1, Number(body.qty) || 1) : Number(c.qty)},
      unit = ${body.unit !== undefined ? String(body.unit) : String(c.unit)},
      est_price = ${body.est_price !== undefined ? Math.max(0, Number(body.est_price) || 0) : Number(c.est_price)},
      actual_price = ${actual},
      purpose = ${body.purpose !== undefined ? String(body.purpose) : String(c.purpose)},
      subteam = ${body.subteam !== undefined ? String(body.subteam) : String(c.subteam)},
      status = ${status},
      decided_at = ${["approved", "rejected"].includes(status) ? (c.decided_at ? String(c.decided_at) : new Date().toISOString()) : c.decided_at},
      decided_note = ${decidedNote},
      order_vendor = ${body.order_vendor !== undefined ? String(body.order_vendor) : String(c.order_vendor)},
      order_ref = ${body.order_ref !== undefined ? String(body.order_ref) : String(c.order_ref)},
      ordered_by = ${status === "ordered" ? user.id : c.ordered_by},
      arrived_at = ${status === "arrived" ? new Date().toISOString() : c.arrived_at}
    WHERE id = ${partId}`;
  await logAudit(user.id, user.username, "part.status", `part:${partId} → ${status}`);
  if (
    ["approved", "rejected"].includes(status) &&
    String(existing.status) !== status
  ) {
    const approved = status === "approved";
    after(() => pushToUsers([c.requested_by],
      approved ? "✅ 你的零件申請已被批准" : "❌ 你的零件申請被駁回",
      `「${c.name}」× ${c.qty}${approved ? "，可以開始採買了" : ""}`,
      "/parts", user.id));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const partId = Number(id);
  const [part] = await sql`
    SELECT status, requested_by FROM parts WHERE id = ${partId}`;
  if (!part) return NextResponse.json({ error: "零件不存在" }, { status: 404 });
  const p = part as { status: string; requested_by: number | null };
  const isOwnerPending = p.status === "pending" && p.requested_by === user.id;
  if (!isStaff(user.role) && !isOwnerPending) {
    return NextResponse.json(
      { error: "只有隊長可以刪除；申請人只能刪除自己待審批的申請" },
      { status: 403 }
    );
  }
  await sql`DELETE FROM parts WHERE id = ${partId}`;
  await logAudit(user.id, user.username, "part.delete", `part:${partId}`);
  return NextResponse.json({ ok: true });
}
