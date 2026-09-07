import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以刪除日誌" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = await sql`DELETE FROM dive_logs WHERE id = ${Number(id)}`;
  if (info.count === 0) {
    return NextResponse.json({ error: "日誌不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
