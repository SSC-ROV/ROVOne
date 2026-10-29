"use client";
import { useI18n } from "@/lib/i18n";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ERRORS: Record<string, string> = {
  google_not_configured: "Google 登入尚未設定完成，請先使用帳號密碼登入，聯絡隊長設定。",
  state_mismatch: "登入流程驗證失敗，請重試一次。",
  google_error: "Google 回傳發生錯誤，請重試；若持續出現請聯絡隊長。",
  email_unverified: "你的 Google 帳號電子郵件尚未驗證，請先在 Gmail 完成驗證。",
  domain_not_allowed: "這個 Google 帳號不屬於學校網域，無法登入（只允許學校的 @stu.ssc.edu.hk / @ssc.edu.hk 帳號）。",
};

export default function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(ERRORS[searchParams.get("error") ?? ""] ?? "");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(t(body.error || "登入失敗"));
        return;
      }
      if (body.redirect) {
        window.location.href = body.redirect;
        return;
      }
      router.replace("/");
    } catch {
      setError(t("連線失敗，請確認伺服器是否啟動"));
    } finally {
      setBusy(false);
    }
  }

  function googleLogin() {
    setGoogleBusy(true);
    setError("");
    window.location.href = "/api/auth/google/start";
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm rounded-[16px]">
        <CardHeader>
          <CardTitle className="board-title">{t("ROV 隊伍任務平台")}</CardTitle>
          <CardDescription>{t("任務看板 · 時間規劃 · 任務日曆")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t(error)}
            </p>
          )}
          <Button variant="outline" className="w-full" onClick={googleLogin} disabled={googleBusy}>
            <GoogleIcon />
            {googleBusy ? t("前往 Google…") : t("使用 Google 帳號登入")}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t("或使用帳號密碼")}
            <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">{t("使用者名稱")}</span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">{t("密碼")}</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <Button type="submit" disabled={busy || !username || !password}>
              {busy ? t("登入中…") : t("登入")}
            </Button>
          </form>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("帳號由隊長在「管理」頁開立；忘記密碼請找隊長重置。")}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.37-2.29V6.6H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.44-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.6l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}
