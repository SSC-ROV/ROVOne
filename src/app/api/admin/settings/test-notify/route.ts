import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { notifyDiscord } from "@/lib/notify";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以測試通知" }, { status: 403 });
  }
  const sent = await notifyDiscord(
    "🔔 ROV 任務平台測試通知：設定成功，之後任務指派、零件審核結果會推到這裡。"
  );
  return NextResponse.json({ sent });
}
