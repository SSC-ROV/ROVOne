import { getSettingValue } from "./db";

export type TeamsHook = "teacher_cycle" | "leader_cycle" | "teacher_parts";

const SETTING_KEY: Record<TeamsHook, string> = {
  teacher_cycle: "teams_webhook_teacher_cycle",
  leader_cycle: "teams_webhook_leader_cycle",
  teacher_parts: "teams_webhook_teacher_parts",
};

async function postJson(url: string, payload: unknown, timeoutMs = 2500): Promise<number | null> {
  // 預設逾時 2.5 秒：通知絕不拖慢使用者操作（網路被擋時快速放棄）
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}

/** 發送 Teams 頻道通知（MessageCard 格式，可附「開啟」按鈕連結） */
export async function notifyTeams(
  hook: TeamsHook,
  title: string,
  text: string,
  link?: string
): Promise<boolean> {
  const url = await getSettingValue(SETTING_KEY[hook]);
  if (!url) return false;

  const payload: Record<string, unknown> = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: title,
    themeColor: hook === "teacher_parts" ? "C239B3" : "0076D7",
    sections: [{ activityTitle: title, text }],
  };
  if (link) {
    payload.potentialAction = [
      {
        "@type": "OpenUri",
        name: "開啟",
        targets: [{ os: "default", uri: link }],
      },
    ];
    payload.text = `${text}\n\n${link}`;
  }

  try {
    const status = await postJson(url, payload);
    return status === 200 || status === 202;
  } catch {
    return false;
  }
}

/** 相容舊呼叫（任務指派等）：有設定 Discord Webhook 才會發，否則靜默不做 */
export async function notifyDiscord(content: string): Promise<boolean> {
  const url = await getSettingValue("discord_webhook");
  if (!url) return false;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 2500);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/** 測試指定網址：回傳 Discord 的具體回應狀態，讓管理頁能顯示確切原因 */
export async function testWebhook(
  url: string
): Promise<{ ok: boolean; status: number | null; message: string }> {
  try {
    // Power Automate 冷啟動可能需 5~15 秒，測試按鈕放寬等待（平時通知仍 2.5 秒）
    const status = await postJson(
      url,
      { text: "🔔 ROV 任務平台測試通知：設定成功，之後相關事件會推到這裡。" },
      15000
    );
    if (status === 204 || status === 200) return { ok: true, status, message: "sent" };
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
