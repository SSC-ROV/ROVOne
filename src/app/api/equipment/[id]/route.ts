import { isStaff } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const eqId = Number(id);
  const eq = db
    .prepare("SELECT status, borrower_id FROM equipment WHERE id = ?")
    .get(eqId) as
    | { status: string; borrower_id: number | null }
    | undefined;
  if (!eq) return NextResponse.json({ error: "設備不存在" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    due_return?: string;
    name?: string;
    category?: string;
    note?: string;
  } | null;

  if (body?.action) {
    if (body.action === "borrow") {
      if (eq.status !== "available") {
        return NextResponse.json({ error: "設備目前無法借用" }, { status: 400 });
      }
      db.prepare(
        "UPDATE equipment SET status = 'borrowed', borrower_id = ?, borrowed_at = ?, due_return = ? WHERE id = ?"
      ).run(
        user.id,
        new Date().toISOString(),
        body.due_return || null,
        eqId
      );
      return NextResponse.json({ ok: true });
    }
    if (body.action === "return") {
      if (!isStaff(user.role) && eq.borrower_id !== user.id) {
        return NextResponse.json(
          { error: "只有借用人本人或隊長可以歸還" },
          { status: 403 }
        );
      }
      db.prepare(
        "UPDATE equipment SET status = 'available', borrower_id = NULL, borrowed_at = NULL, due_return = NULL WHERE id = ?"
      ).run(eqId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "maintenance") {
      if (!isStaff(user.role)) {
        return NextResponse.json({ error: "只有隊長可以調整維修狀態" }, { status: 403 });
      }
      if (eq.status === "borrowed") {
        return NextResponse.json({ error: "先歸還再標記維修" }, { status: 400 });
      }
      const next = eq.status === "maintenance" ? "available" : "maintenance";
      db.prepare("UPDATE equipment SET status = ? WHERE id = ?").run(next, eqId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "動作不正確" }, { status: 400 });
  }

  // 名稱 / 分類 / 備註：隊長
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長可以編輯設備資料" }, { status: 403 });
  }
  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "名稱不可空白" }, { status: 400 });
    db.prepare("UPDATE equipment SET name = ? WHERE id = ?").run(name, eqId);
  }
  if (body?.category !== undefined) {
    db.prepare("UPDATE equipment SET category = ? WHERE id = ?").run(
      String(body.category),
      eqId
    );
  }
  if (body?.note !== undefined) {
    db.prepare("UPDATE equipment SET note = ? WHERE id = ?").run(
      String(body.note),
      eqId
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長可以刪除設備" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = db.prepare("DELETE FROM equipment WHERE id = ?").run(Number(id));
  if (info.changes === 0) {
    return NextResponse.json({ error: "設備不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
