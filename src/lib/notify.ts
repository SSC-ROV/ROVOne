import { sql } from "./pg";
import { getSettingValue } from "./db";

async function postToDiscord(url: string, content: string): Promise<number | null> {
  // 逾時上限 2.5 秒：通知絕不拖慢使用者操作（網路被擋時快速放棄）
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 2500);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal: ac.signal,
    });
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}

/** 有設定 Discord Webhook 就發通知；失敗靜默（不影響主流程，最多等 2.5 秒） */
export async function notifyDiscord(content: string): Promise<boolean> {
  const url = await getSettingValue("discord_webhook");
  if (!url) return false;
  try {
    return (await postToDiscord(url, content)) === 204;
  } catch {
    return false;
  }
}

/** 測試指定網址：回傳 Discord 的具體回應狀態，讓管理頁能顯示確切原因 */
export async function testWebhook(
  url: string
): Promise<{ ok: boolean; status: number | null; message: string }> {
  try {
    const status = await postToDiscord(
      url,
      "🔔 ROV 任務平台測試通知：設定成功，之後任務指派、零件審核結果會推到這裡。"
    );
    if (status === 204) return { ok: true, status, message: "sent" };
    if (status === 404 || status === 401 || status === 403)
      return { ok: false, status, message: "invalid" };
    return { ok: false, status, message: "unexpected" };
  } catch {
    return { ok: false, status: null, message: "unreachable" };
  }
}

export function fmtDue(due: string | null): string {
  return due ? `（截止 ${due}）` : "";
}
