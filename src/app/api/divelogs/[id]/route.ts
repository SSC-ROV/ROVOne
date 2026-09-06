import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (user.role !== "leader") {
    return NextResponse.json({ error: "只有隊長可以刪除日誌" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = db.prepare("DELETE FROM dive_logs WHERE id = ?").run(Number(id));
  if (info.changes === 0) {
    return NextResponse.json({ error: "日誌不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
