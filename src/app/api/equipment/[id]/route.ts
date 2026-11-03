import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const eqId = Number(id);
  const [eq] = await sql`
    SELECT status, borrower_id FROM equipment WHERE id = ${eqId}`;
  if (!eq) return NextResponse.json({ error: "設備不存在" }, { status: 404 });
  const e = eq as { status: string; borrower_id: number | null };

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    due_return?: string;
    borrower_id?: number | null;
    name?: string;
    category?: string;
    note?: string;
  } | null;

  if (body?.action) {
    if (body.action === "borrow") {
      if (e.status !== "available") {
        return NextResponse.json({ error: "設備目前無法借用" }, { status: 400 });
      }
      await sql`
        UPDATE equipment SET status = 'borrowed', borrower_id = ${user.id},
               borrowed_at = ${new Date().toISOString()}, due_return = ${body.due_return || null}
        WHERE id = ${eqId}`;
      return NextResponse.json({ ok: true });
    }
    if (body.action === "assign") {
      // Pick (or change, or clear) the borrower, like a task's assignee.
      const nextId = body.borrower_id == null ? null : Number(body.borrower_id);
      if (nextId !== null && !Number.isInteger(nextId)) {
        return NextResponse.json({ error: "借用人不正確" }, { status: 400 });
      }
      if (e.status === "maintenance") {
        return NextResponse.json({ error: "設備維修中，無法借用" }, { status: 400 });
      }
      const staff = isStaff(user.role);
      if (!staff) {
        // Members can only sign an available item out to themselves, or clear their own loan.
        const ownsLoan = e.status === "borrowed" && e.borrower_id === user.id;
        const selfBorrow = e.status === "available" && nextId === user.id;
        const selfReturn = ownsLoan && nextId === null;
        if (!selfBorrow && !selfReturn && !(ownsLoan && nextId === user.id)) {
          return NextResponse.json({ error: "只有隊長或老師可以指派借用人" }, { status: 403 });
        }
      }
      if (nextId === null) {
        await sql`
          UPDATE equipment SET status = 'available', borrower_id = NULL,
                 borrowed_at = NULL, due_return = NULL
          WHERE id = ${eqId}`;
        return NextResponse.json({ ok: true });
      }
      if (nextId === e.borrower_id) return NextResponse.json({ ok: true });
      const [person] = await sql`SELECT id FROM users WHERE id = ${nextId}`;
      if (!person) return NextResponse.json({ error: "找不到這位成員" }, { status: 400 });
      if (e.status === "borrowed") {
        // Hand the loan over to someone else; keep the due date.
        await sql`
          UPDATE equipment SET borrower_id = ${nextId}, borrowed_at = ${new Date().toISOString()}
          WHERE id = ${eqId}`;
      } else {
        await sql`
          UPDATE equipment SET status = 'borrowed', borrower_id = ${nextId},
                 borrowed_at = ${new Date().toISOString()}, due_return = ${body.due_return || null}
          WHERE id = ${eqId}`;
      }
      if (nextId !== user.id) {
        await logAudit(user.id, user.username, "equipment.assign", `equipment:${eqId}`).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }
    if (body.action === "return") {
      if (!isStaff(user.role) && e.borrower_id !== user.id) {
        return NextResponse.json({ error: "只有借用人本人或隊長可以歸還" }, { status: 403 });
      }
      await sql`
        UPDATE equipment SET status = 'available', borrower_id = NULL,
               borrowed_at = NULL, due_return = NULL
        WHERE id = ${eqId}`;
      return NextResponse.json({ ok: true });
    }
    if (body.action === "maintenance") {
      if (!isStaff(user.role)) {
        return NextResponse.json({ error: "只有隊長或老師可以調整維修狀態" }, { status: 403 });
      }
      if (e.status === "borrowed") {
        return NextResponse.json({ error: "先歸還再標記維修" }, { status: 400 });
      }
      const next = e.status === "maintenance" ? "available" : "maintenance";
      await sql`UPDATE equipment SET status = ${next} WHERE id = ${eqId}`;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "動作不正確" }, { status: 400 });
  }

  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以編輯設備資料" }, { status: 403 });
  }
  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "名稱不可空白" }, { status: 400 });
    await sql`UPDATE equipment SET name = ${name} WHERE id = ${eqId}`;
  }
  if (body?.category !== undefined) {
    await sql`UPDATE equipment SET category = ${String(body.category)} WHERE id = ${eqId}`;
  }
  if (body?.note !== undefined) {
    await sql`UPDATE equipment SET note = ${String(body.note)} WHERE id = ${eqId}`;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以刪除設備" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = await sql`DELETE FROM equipment WHERE id = ${Number(id)}`;
  if (info.count === 0) {
    return NextResponse.json({ error: "設備不存在" }, { status: 404 });
  }
  await logAudit(user.id, user.username, "equipment.delete", `equipment:${id}`);
  return NextResponse.json({ ok: true });
}
