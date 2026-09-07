/** Google OAuth（開放授權）伺服器端流程：不引入任何套件 */

export function googleConfigured(
  clientId: string | null,
  clientSecret: string | null,
  domains: string | null
): boolean {
  return !!(clientId && clientSecret && domains && domains.trim());
}

export function googleAuthUrl(origin: string, clientId: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(
  code: string,
  origin: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("token_exchange_failed");
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("token_exchange_failed");
  return data.access_token;
}

export type GoogleUser = {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("userinfo_failed");
  return (await res.json()) as GoogleUser;
}
