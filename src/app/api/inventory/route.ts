import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isInventoryStatus } from "@/lib/inventory";
import {
  cleanLocations,
  cleanPhoto,
  ensureInventorySchema,
  listInventory,
  recordStatus,
  replaceLocations,
} from "@/lib/inventory-db";

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

  await ensureInventorySchema();
  const [row] = await sql`
    INSERT INTO inventory_items (name, spec, category, note, photo, created_by)
    VALUES (${name}, ${String(body?.spec ?? "").trim()}, ${String(body?.category ?? "").trim()},
            ${String(body?.note ?? "").trim()}, ${photo ?? null}, ${user.id})
    RETURNING id`;
  const id = Number(row.id);
  await replaceLocations(id, locs.locations);
  await recordStatus(id, status, "", user.id);
  await logAudit(user.id, user.username, "inventory.create", `inventory:${id}`, name);
  return NextResponse.json({ ok: true, id });
}
