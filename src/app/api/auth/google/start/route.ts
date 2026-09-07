import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSettingValue } from "@/lib/db";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

/** Google 登入第一步：把使用者帶去 Google 的授權頁 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const clientId = await getSettingValue("google_client_id");
  const clientSecret = await getSettingValue("google_client_secret");
  const domains = await getSettingValue("google_domains");

  if (!googleConfigured(clientId, clientSecret, domains)) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", origin));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(googleAuthUrl(origin, clientId!, state));
  // state 同時放 cookie 驗證，避免偽造的登入回呼（CSRF）
  res.cookies.set("rov_oauth_state", `${state}.${Date.now()}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
