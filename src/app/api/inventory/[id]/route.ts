import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { cleanLocations, cleanPhoto, getInventoryItem, replaceLocations } from "@/lib/inventory-db";
import { cleanTags, purchaseInfoError } from "@/lib/inventory";

type Ctx = { params: Promise<{ id: string }> };

async function itemId(ctx: Ctx) {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const id = await itemId(ctx);
  const item = id ? await getInventoryItem(id) : null;
  if (!item) return NextResponse.json({ error: "找不到這個物品" }, { status: 404 });
  return NextResponse.json({ item });
}

/** 任何隊員都能修改名稱、規格、分類、位置與照片 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const id = await itemId(ctx);
  const cur = id ? await getInventoryItem(id) : null;
  if (!id || !cur) return NextResponse.json({ error: "找不到這個物品" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });

  const name = body.name !== undefined ? String(body.name).trim() : cur.name;
  if (!name) return NextResponse.json({ error: "請填寫物品名稱" }, { status: 400 });
  const photo = cleanPhoto(body.photo);
  if (photo && typeof photo === "object") return NextResponse.json({ error: photo.error }, { status: 400 });

  // 規格、購買連結、單價：有送來就必須完整（舊物品補資料時也一樣）
  const editsPurchase = body.spec !== undefined || body.buy_link !== undefined || body.unit_price !== undefined;
  const spec = body.spec !== undefined ? String(body.spec).trim() : cur.spec;
  const buyLink = body.buy_link !== undefined ? String(body.buy_link).trim() : cur.buy_link;
  const unitPrice = body.unit_price !== undefined ? Number(body.unit_price) : cur.unit_price;
  if (editsPurchase) {
    const missing = purchaseInfoError({ spec, buy_link: buyLink, unit_price: unitPrice });
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });
  }

  if (body.locations !== undefined) {
    const locs = cleanLocations(body.locations);
    if ("error" in locs) return NextResponse.json({ error: locs.error }, { status: 400 });
    await replaceLocations(id, locs.locations);
  }
  const nextPhoto = photo === undefined ? cur.photo : photo;
  await sql`
    UPDATE inventory_items SET
      name = ${name},
      spec = ${spec},
      buy_link = ${buyLink},
      unit_price = ${unitPrice},
      tags = ${body.tags !== undefined ? cleanTags(body.tags) : cur.tags},
      note = ${body.note !== undefined ? String(body.note).trim() : cur.note},
      photo = ${nextPhoto},
      updated_at = now()
    WHERE id = ${id}`;
  await logAudit(user.id, user.username, "inventory.update", `inventory:${id}`, name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const id = await itemId(ctx);
  const cur = id ? await getInventoryItem(id) : null;
  if (!id || !cur) return NextResponse.json({ error: "找不到這個物品" }, { status: 404 });
  await sql`DELETE FROM inventory_items WHERE id = ${id}`;
  await logAudit(user.id, user.username, "inventory.delete", `inventory:${id}`, cur.name);
  return NextResponse.json({ ok: true });
}
