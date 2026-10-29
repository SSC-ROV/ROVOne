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

/** 依序嘗試多種 payload：Power Automate 觸發器可能限制 schema，任一 2xx 即成功 */
async function postAny(
  url: string,
  payloads: Record<string, unknown>[],
  timeoutMs = 2500
): Promise<{ ok: boolean; status: number | null; message: string }> {
  let last: number | null = null;
  for (const payload of payloads) {
    try {
      last = await postJson(url, payload, timeoutMs);
      if (last === 200 || last === 202 || last === 204) return { ok: true, status: last, message: "sent" };
    } catch {
      return { ok: false, status: null, message: "unreachable" };
    }
  }
  return { ok: false, status: last, message: `http_${last}` };
}

/** Teams Workflows「傳送 Webhook 警示至頻道」模板的承載：
 * 只會把調適型卡片（Adaptive Card）貼到頻道——MessageCard／純文字雖會被收下（202），
 * 但流程運行會在「發布卡片」步驟失敗。 */
function adaptiveCardMessage(title: string, text: string, link?: string) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.4",
          body: [
            { type: "TextBlock", text: title, weight: "Bolder", size: "Medium", wrap: true, color: "Dark" },
            { type: "TextBlock", text, wrap: true, isSubtle: true },
          ],
          ...(link ? { actions: [{ type: "Action.OpenUrl", title: "開啟", url: link }] } : {}),
        },
      },
    ],
  };
}

/** 發送 Teams 頻道通知 */
export async function notifyTeams(
  hook: TeamsHook,
  title: string,
  text: string,
  link?: string
): Promise<boolean> {
  const url = await getSettingValue(SETTING_KEY[hook]);
  if (!url) return false;

  const message = adaptiveCardMessage(title, text, link);

  // 30 秒預算：Power Automate 冷啟動 5~15 秒，冷流程首次觸發可能超過 8 秒
  // （after() 背景執行不阻塞回應；路由需 export const maxDuration = 60 才有足夠函數壽命）
  const r = await postAny(url, [message], 30000);
  return r.ok;
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

/** 測試指定網址：回傳狀態（Teams Workflows 回 202 也算成功） */
export async function testWebhook(
  url: string
): Promise<{ ok: boolean; status: number | null; message: string }> {
  try {
    // Power Automate 冷啟動可能需 5~15 秒，測試按鈕放寬等待（平時通知 30 秒預算、背景執行）
    const r = await postAny(
      url,
      [
        adaptiveCardMessage(
          "🔔 ROV 任務平台測試通知",
          "設定成功，之後審批事件會以卡片形式推到這裡。",
          "https://iengineer.cc.cd"
        ),
      ],
      15000
    );
    if (r.ok) return r;
    if (r.status === 404 || r.status === 401 || r.status === 403)
      return { ok: false, status: r.status, message: "invalid" };
    return r;
  } catch {
    return { ok: false, status: null, message: "unreachable" };
  }
}

export function fmtDue(due: string | null): string {
  return due ? `（截止 ${due}）` : "";
}
