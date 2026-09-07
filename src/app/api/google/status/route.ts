import { NextResponse } from "next/server";
import { getSettingValue } from "@/lib/db";
import { googleConfigured } from "@/lib/google";

/** 公開狀態：登入頁用來決定是否顯示「使用 Google 登入」按鈕（不洩漏密鑰） */
export async function GET() {
  const clientId = await getSettingValue("google_client_id");
  const clientSecret = await getSettingValue("google_client_secret");
  const domains = await getSettingValue("google_domains");
  return NextResponse.json({ enabled: googleConfigured(clientId, clientSecret, domains) });
}
