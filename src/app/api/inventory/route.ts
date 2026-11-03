import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { cleanTags, isInventoryStatus, purchaseInfoError } from "@/lib/inventory";
import {
  autoRestockRequest,
  cleanLocations,
  cleanPhoto,
  ensureInventorySchema,
  getInventoryItem,
  listInventory,
  recordStatus,
  replaceLocations,
} from "@/lib/inventory-db";

// 新增時就是「沒有了」會自動開採購申請，背景通知需要較長的函數壽命
export const maxDuration = 60;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const items = await listInventory();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "請填寫物品名稱" }, { status: 400 });
  const locs = cleanLocations(body?.locations);
  if ("error" in locs) return NextResponse.json({ error: locs.error }, { status: 400 });
  const photo = cleanPhoto(body?.photo);
  if (photo && typeof photo === "object") return NextResponse.json({ error: photo.error }, { status: 400 });
  const status = isInventoryStatus(body?.status) ? body.status : "in_stock";
  const spec = String(body?.spec ?? "").trim();
  const buyLink = String(body?.buy_link ?? "").trim();
  const unitPrice = Number(body?.unit_price);
  const missing = purchaseInfoError({ spec, buy_link: buyLink, unit_price: unitPrice });
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });

  await ensureInventorySchema();
  const [row] = await sql`
    INSERT INTO inventory_items (name, spec, tags, note, buy_link, unit_price, photo, created_by)
    VALUES (${name}, ${spec}, ${cleanTags(body?.tags)},
            ${String(body?.note ?? "").trim()}, ${buyLink}, ${unitPrice}, ${photo ?? null}, ${user.id})
    RETURNING id`;
  const id = Number(row.id);
  await replaceLocations(id, locs.locations);
  await recordStatus(id, status, "", user.id);
  await logAudit(user.id, user.username, "inventory.create", `inventory:${id}`, name);
  // 新增時就標成「沒有了」→ 跟回報沒有了一樣，自動送出採購申請
  let restock: { created: boolean; partId: number | null } | null = null;
  if (status === "empty") {
    const item = await getInventoryItem(id);
    if (item) {
      restock = await autoRestockRequest(item, user, req.nextUrl.origin);
      if (restock.created) {
        await logAudit(user.id, user.username, "parts.auto_restock", `parts:${restock.partId}`, name);
      }
    }
  }
  return NextResponse.json({ ok: true, id, restock });
}
