import type { Metadata } from "next";
import { getSettingValue } from "@/lib/db";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "登入 · ROV 隊伍任務平台",
};

// 伺服器端直接查 Google 設定，登入頁一載入就有按鈕（不必再等客戶端查詢）
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [clientId, clientSecret, domains] = await Promise.all([
    getSettingValue("google_client_id"),
    getSettingValue("google_client_secret"),
    getSettingValue("google_domains"),
  ]);
  const googleEnabled = Boolean(clientId && clientSecret && domains && domains.trim());
  return <LoginForm googleEnabled={googleEnabled} />;
}
