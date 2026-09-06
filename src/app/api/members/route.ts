import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { Member } from "@/lib/types";

/** 所有登入者可讀（看板的負責人下拉選單需要） */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const members = db
    .prepare(
      "SELECT id, username, display_name, role, subteam FROM users ORDER BY CASE role WHEN 'leader' THEN 0 ELSE 1 END, username"
    )
    .all() as unknown as Member[];
  return NextResponse.json({ members });
}
