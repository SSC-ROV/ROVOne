import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { getSettingValue, setSetting } from "@/lib/db";
import { testWebhook } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

/** 測試 Webhook：優先用請求帶來的網址（輸入框當前值），成功自動保存 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以測試通知" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { webhook?: string } | null;
  const url = (body?.webhook ?? "").trim() || (await getSettingValue("teams_webhook_teacher_cycle")) || "";
  if (!url) {
    return NextResponse.json({ sent: false, reason: "empty" });
  }
  // 支援 Teams（*.webhook.office.com）與 Power Automate（*.powerplatform.com）等任意 https 網址
  if (!/^https?:\/\/[^\s"']+$/i.test(url)) {
    return NextResponse.json({ sent: false, reason: "invalid" });
  }
  const r = await testWebhook(url);
  if (r.ok) {
    await setSetting("teams_webhook_teacher_cycle", url);
    await logAudit(user.id, user.username, "teams.test", "", url.slice(0, 60) + "…");
    return NextResponse.json({ sent: true });
  }
  return NextResponse.json({ sent: false, reason: r.message, status: r.status });
}
