import http2 from "node:http2";
import crypto from "node:crypto";
import { sql } from "./pg";

/* ── APNs 認證：以 .p8 金鑰簽 ES256 provider token（無金鑰設定時整組功能靜默停用） ── */

let cachedJwt: { token: string; exp: number } | null = null;

function apnsJwt(): string | null {
  const keyB64 = process.env.APNS_KEY_B64;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!keyB64 || !keyId || !teamId) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp > now + 600) return cachedJwt.token;

  const pem = Buffer.from(keyB64, "base64").toString("utf8");
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: now })).toString("base64url");
  const sig = crypto
    .createSign("SHA256")
    .update(`${header}.${payload}`)
    .sign({ key: pem, dsaEncoding: "ieee-p1363" }, "base64url");
  cachedJwt = { token: `${header}.${payload}.${sig}`, exp: now + 1800 };
  return cachedJwt.token;
}

/** APNs 要求 HTTP/2；成功 200、令牌失效 410 */
function h2Post(path: string, headers: Record<string, string>, body: string, timeoutMs = 5000): Promise<number> {
  return new Promise((resolve, reject) => {
    const client = http2.connect("https://api.push.apple.com");
    const done = (fn: () => void) => { try { client.close(); } catch { /* ignore */ } fn(); };
    client.setTimeout(timeoutMs, () => done(() => reject(new Error("apns timeout"))));
    client.on("error", (e) => done(() => reject(e)));
    const req = client.request({ ...headers, ":method": "POST", ":path": path });
    req.on("response", (h) => resolve(Number(h[":status"])));
    req.on("data", () => {});
    req.on("end", () => done(() => resolve(0)));
    req.on("error", (e) => done(() => reject(e)));
    req.end(body);
  });
}

/** 對單一設備令牌發送；410（用戶解除安裝等）時清除令牌 */
export async function sendApns(
  token: string,
  title: string,
  body: string,
  url?: string
): Promise<boolean> {
  const jwt = apnsJwt();
  if (!jwt) return false;
  try {
    const status = await h2Post(
      "/3/device/" + token,
      {
        ":authority": "api.push.apple.com",
        authorization: `bearer ${jwt}`,
        "apns-topic": process.env.APNS_TOPIC || "com.sscrov.rovteamhub",
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      JSON.stringify({
        aps: { alert: { title, body }, sound: "default" },
        ...(url ? { url } : {}),
      })
    );
    if (status === 410) await sql`DELETE FROM push_tokens WHERE token = ${token}`;
    return status === 200;
  } catch {
    return false;
  }
}

/** 把通知推給指定用戶們（依其註冊的設備）；fire-and-forget，絕不影響主流程 */
export async function pushToUsers(
  userIds: Array<number | null | undefined>,
  title: string,
  body: string,
  url?: string,
  excludeUserId?: number
): Promise<void> {
  try {
    const ids = [...new Set(userIds.filter((id): id is number => !!id && id !== excludeUserId))];
    if (!ids.length) return;
    const rows = await sql`SELECT token FROM push_tokens WHERE user_id IN ${ids}`;
    for (const r of rows) await sendApns(r.token, title, body, url);
  } catch {
    /* 通知失敗不影響主流程 */
  }
}

/** 某角色全部用戶 id（role: teacher / leader / member） */
export async function roleUserIds(role: string): Promise<number[]> {
  const rows = await sql`SELECT id FROM users WHERE role = ${role}`;
  return rows.map((r) => Number(r.id));
}
