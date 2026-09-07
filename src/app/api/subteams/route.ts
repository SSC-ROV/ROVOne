import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { getSubteams, setSubteams } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Def = { key: string; zh: string; en: string };

/** 所有登入者可讀（篩選/下拉需要） */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  return NextResponse.json({ subteams: await getSubteams() });
}

/** 隊長/老師自訂組別清單（全量提交）；被刪除的組別自動把成員與任務改派到第一個剩餘組別 */
export async function PUT(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(me.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以自訂組別" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { subteams?: Def[] } | null;
  const list = (body?.subteams ?? [])
    .map((d) => ({ key: String(d.key ?? "").trim(), zh: String(d.zh ?? "").trim(), en: String(d.en ?? "").trim() }))
    .filter((d) => d.zh);
  if (list.length === 0) {
    return NextResponse.json({ error: "至少需要一個組別" }, { status: 400 });
  }
  const keys = new Set(list.map((d) => d.key).filter(Boolean));
  if (keys.size !== list.filter((d) => d.key).length) {
    return NextResponse.json({ error: "組別 key 重複" }, { status: 400 });
  }
  // 為沒有 key 的新組別產生
  for (const d of list) {
    if (!d.key) d.key = "st" + crypto.randomBytes(3).toString("hex");
  }

  const old = await getSubteams();
  const removed = old.filter((o) => !list.some((d) => d.key === o.key));
  const fallback = list[0].key;
  for (const r of removed) {
    await sql`UPDATE users SET subteam = ${fallback} WHERE subteam = ${r.key}`;
    await sql`UPDATE tasks SET subteam = ${fallback} WHERE subteam = ${r.key}`;
    await sql`UPDATE events SET subteam = ${fallback} WHERE subteam = ${r.key}`;
  }

  await setSubteams(list);
  await logAudit(
    me.id, me.username, "subteams.update", "",
    removed.length ? `removed: ${removed.map((r) => r.zh).join(",")}` : list.map((d) => d.zh).join(",")
  );
  return NextResponse.json({ subteams: list });
}
