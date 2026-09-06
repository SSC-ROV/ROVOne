import { getSettingValue } from "./db";

/** 有設定 Discord Webhook 就發通知；失敗靜默（不影響主流程） */
export async function notifyDiscord(content: string): Promise<boolean> {
  const url = getSettingValue("discord_webhook");
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function fmtDue(due: string | null): string {
  return due ? `（截止 ${due}）` : "";
}
