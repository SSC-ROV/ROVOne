import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getPartByToken } from "@/lib/db";
import { notifyChannel } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ token: string }> };

/** 老師審批頁讀取零件資訊（免登入，用一次性連結 token） */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const part = await getPartByToken(token);
  if (!part) return NextResponse.json({ error: "找不到這個審批連結" }, { status: 404 });
  return NextResponse.json({
    part: {
      name: part.name,
      spec: part.spec,
      link: part.link,
      qty: part.qty,
      unit: part.unit,
      est_price: part.est_price,
      purpose: part.purpose,
      subteam: part.subteam,
      status: part.status,
      decided_note: part.decided_note,
    },
  });
}

/** 老師按核准 / 駁回 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const part = await getPartByToken(token);
  if (!part) return NextResponse.json({ error: "找不到這個審批連結" }, { status: 404 });
  if (part.status !== "pending") {
    return NextResponse.json({ error: "這筆申請已經審核過了" }, { status: 400 });
  }
  if (part.approve_expires_at && new Date(part.approve_expires_at) < new Date()) {
    return NextResponse.json({ error: "這個審批連結已過期（72 小時），請請隊長重新複製新的連結" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as {
    decision?: string;
    note?: string;
  } | null;
  const decision = body?.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "參數不正確" }, { status: 400 });
  }
  await sql`
    UPDATE parts SET status = ${decision}, decided_at = ${new Date().toISOString()},
                     decided_note = ${String(body?.note ?? "").trim()}
    WHERE id = ${part.id}`;

  await logAudit(null, "teacher-link", "part.approve", `part:${part.id}`, `${decision}${body?.note ? "；備註：" + body.note : ""}`);
  await notifyChannel("parts",
    decision === "approved"
      ? `✅ 老師已核准零件申請：「${part.name}」× ${part.qty}${part.unit}（預估 $${part.est_price}）`
      : `❌ 老師駁回零件申請：「${part.name}」${body?.note ? `— 備註：${body.note}` : ""}`
  );
  return NextResponse.json({ ok: true });
}
