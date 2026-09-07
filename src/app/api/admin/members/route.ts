import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import type { Member } from "@/lib/types";

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(me.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以新增成員" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    username?: string;
    display_name?: string;
    password?: string;
    subteam?: string;
    role?: string;
  } | null;
  const username = String(body?.username ?? "").trim();
  const displayName = String(body?.display_name ?? "").trim();
  const password = String(body?.password ?? "");
  if (!/^[a-zA-Z0-9_]{2,20}$/.test(username)) {
    return NextResponse.json({ error: "帳號限 2–20 個英數字或底線" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "請填寫顯示名稱" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密碼至少 6 個字" }, { status: 400 });
  }
  const role = ["leader", "teacher", "member"].includes(String(body?.role))
    ? String(body?.role)
    : "member";
  try {
    const [member] = await sql`
      INSERT INTO users (username, display_name, password_hash, role, subteam)
      VALUES (${username}, ${displayName}, ${hashPassword(password)}, ${role}, ${String(body?.subteam ?? "general")})
      RETURNING id, username, display_name, role, subteam`;
    await logAudit(me.id, me.username, "member.create", `user:${username}`).catch(() => {});
    return NextResponse.json({ member });
  } catch {
    return NextResponse.json({ error: "帳號已存在" }, { status: 400 });
  }
}
