import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isInventoryStatus } from "@/lib/inventory";
import { getInventoryItem, recordStatus } from "@/lib/inventory-db";

type Ctx = { params: Promise<{ id: string }> };

/** 回報庫存狀態（有庫存 / 快用完 / 沒有了）。任何隊員都可以回報。 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  const item = Number.isInteger(id) && id > 0 ? await getInventoryItem(id) : null;
  if (!item) return NextResponse.json({ error: "找不到這個物品" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isInventoryStatus(body?.status)) return NextResponse.json({ error: "狀態不正確" }, { status: 400 });
  const note = String(body?.note ?? "").trim().slice(0, 300);
  await recordStatus(id, body.status, note, user.id);
  await logAudit(user.id, user.username, "inventory.report", `inventory:${id}`, `${body.status} ${note}`.trim());
  return NextResponse.json({ ok: true });
}
