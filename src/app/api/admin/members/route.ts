import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import type { Member } from "@/lib/types";

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (me.role !== "leader") {
    return NextResponse.json({ error: "只有隊長可以新增成員" }, { status: 403 });
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
    return NextResponse.json(
      { error: "帳號限 2–20 個英數字或底線" },
      { status: 400 }
    );
  }
  if (!displayName) {
    return NextResponse.json({ error: "請填寫顯示名稱" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密碼至少 6 個字" }, { status: 400 });
  }
  try {
    const info = db
      .prepare(
        "INSERT INTO users (username, display_name, password_hash, role, subteam) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        username,
        displayName,
        hashPassword(password),
        body?.role === "leader" ? "leader" : "member",
        String(body?.subteam ?? "general")
      );
    const member = db
      .prepare(
        "SELECT id, username, display_name, role, subteam FROM users WHERE id = ?"
      )
      .get(info.lastInsertRowid) as unknown as Member;
    return NextResponse.json({ member });
  } catch {
    return NextResponse.json({ error: "帳號已存在" }, { status: 400 });
  }
}
