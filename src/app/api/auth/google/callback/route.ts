import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/pg";
import { getSettingValue } from "@/lib/db";
import { exchangeCode, fetchGoogleUser } from "@/lib/google";
import { createSession, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { notifyDiscord } from "@/lib/notify";

function fail(origin: string, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, origin));
}

/** Google 登入第二步：Google 帶著 code 回來，驗證並登入／自動開帳號 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get("rov_oauth_state")?.value;

  if (!code || !state || !stateCookie) return fail(origin, "google_error");
  const [cookieState, cookieTime] = stateCookie.split(".");
  if (cookieState !== state || Date.now() - Number(cookieTime) > 10 * 60 * 1000) {
    return fail(origin, "state_mismatch");
  }

  const clientId = await getSettingValue("google_client_id");
  const clientSecret = await getSettingValue("google_client_secret");
  const domainsRaw = await getSettingValue("google_domains");
  if (!clientId || !clientSecret || !domainsRaw?.trim()) {
    return fail(origin, "google_not_configured");
  }

  let email: string | undefined;
  let name: string | undefined;
  let emailVerified: boolean | undefined;
  try {
    const accessToken = await exchangeCode(code, origin, clientId, clientSecret);
    const info = await fetchGoogleUser(accessToken);
    email = info.email?.toLowerCase();
    name = info.name;
    emailVerified = info.email_verified;
  } catch {
    return fail(origin, "google_error");
  }
  if (!email) return fail(origin, "google_error");
  if (emailVerified === false) return fail(origin, "email_unverified");

  // 只允許設定的學校網域（例如 stu.ssc.edu.hk / ssc.edu.hk）
  const domain = email.split("@")[1] ?? "";
  const allowed = domainsRaw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(domain)) return fail(origin, "domain_not_allowed");

  // 已有帳號（email 或帳號相同）→ 綁定登入；沒有 → 自動開帳號
  let [user] = await sql`
    SELECT id, role FROM users WHERE email = ${email}`;
  const localPart = email.split("@")[0];

  if (!user) {
    // 角色：依管理設定的幹部 email 清單決定
    const leaderEmails = ((await getSettingValue("google_leader_emails")) ?? "")
      .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    const teacherEmails = ((await getSettingValue("google_teacher_emails")) ?? "")
      .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    const role = leaderEmails.includes(email)
      ? "leader"
      : teacherEmails.includes(email)
        ? "teacher"
        : "member";

    let username = localPart.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) || "member";
    while ((await sql`SELECT 1 FROM users WHERE username = ${username}`).length) {
      username = `${username.slice(0, 15)}_${crypto.randomBytes(2).toString("hex")}`;
    }

    const [created] = await sql`
      INSERT INTO users (username, display_name, password_hash, role, subteam, email, login_method)
      VALUES (${username}, ${name || localPart}, ${crypto.randomBytes(32).toString("hex")},
              ${role}, 'general', ${email}, 'google')
      RETURNING id, role`;
    user = created;
    await notifyDiscord(
      `🆕 新成員「${name || localPart}」（${email}）透過 Google 登入自動加入！`
    );
  } else {
    // 已存在的密碼帳號，用 Google 登入 → 補綁 email 與登入方式
    await sql`
      UPDATE users SET login_method = 'google' WHERE id = ${user.id}`;
  }

  const token = await createSession(Number(user.id));
  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  res.cookies.delete("rov_oauth_state");
  return res;
}
