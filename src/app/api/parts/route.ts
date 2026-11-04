import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { createPartRequest } from "@/lib/parts-db";
import { isValidBuyLink } from "@/lib/inventory";

// after() 背景通知要等 Power Automate 冷啟動，需要更長的函數壽命
export const maxDuration = 60;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const parts = await sql`
    SELECT p.*, u.display_name AS requested_by_name
    FROM parts p LEFT JOIN users u ON u.id = p.requested_by
    ORDER BY p.created_at DESC, p.id DESC`;
  return NextResponse.json({ parts });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "請填寫零件名稱" }, { status: 400 });
  const link = String(body?.link ?? "").trim();
  if (!link) return NextResponse.json({ error: "請填寫購買連結" }, { status: 400 });
  if (!isValidBuyLink(link)) return NextResponse.json({ error: "購買連結需以 http:// 或 https:// 開頭" }, { status: 400 });
  await createPartRequest(
    {
      name,
      spec: String(body?.spec ?? ""),
      link,
      qty: Number(body?.qty),
      unit: String(body?.unit ?? "個"),
      est_price: Number(body?.est_price),
      purpose: String(body?.purpose ?? ""),
      subteam: String(body?.subteam ?? "general"),
    },
    user,
    req.nextUrl.origin
  );
  return NextResponse.json({ ok: true });
}
