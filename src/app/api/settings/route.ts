import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** 所有登入者可讀（首頁倒數與導覽列隊名需要） */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  return NextResponse.json(await getSettings());
}
