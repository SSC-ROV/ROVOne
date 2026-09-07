import { NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

/** 審計日誌（僅隊長/老師，最近 100 筆） */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以查看" }, { status: 403 });
  }
  const logs = await sql`
    SELECT id, at, user_name, action, target, detail
    FROM audit_log ORDER BY at DESC, id DESC LIMIT 100`;
  return NextResponse.json({ logs });
}
