import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDisplayToken } from "@/lib/db";
import { getBoardData } from "@/lib/board";

export const dynamic = "force-dynamic";

/** 看板輪詢介面：以看板 token 授權，回傳全部顯示資料（JSON） */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const displayToken = await getOrCreateDisplayToken();
  if (token !== displayToken) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const data = await getBoardData();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
