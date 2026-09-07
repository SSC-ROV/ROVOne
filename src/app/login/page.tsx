"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const ERRORS: Record<string, string> = {
  google_not_configured: "Google 登入尚未設定完成，請先使用帳號密碼登入，聯絡隊長設定。",
  state_mismatch: "登入流程驗證失敗，請重試一次。",
  google_error: "Google 回傳發生錯誤，請重試；若持續出現請聯絡隊長。",
  email_unverified: "你的 Google 帳號電子郵件尚未驗證，請先在 Gmail 完成驗證。",
  domain_not_allowed: "這個 Google 帳號不屬於學校網域，無法登入（只允許學校的 @stu.ssc.edu.hk / @ssc.edu.hk 帳號）。",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(ERRORS[searchParams.get("error") ?? ""] ?? "");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(!!d.enabled))
      .catch(() => setGoogleEnabled(false));
  }, []);

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
        setError(body.error || "登入失敗");
        return;
      }
      router.replace("/");
    } catch {
      setError("連線失敗，請確認伺服器是否啟動");
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top,rgba(8,145,178,0.22),transparent_60%)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-base font-black text-slate-950 shadow-lg shadow-cyan-500/20">
            ROV
          </span>
          <h1 className="text-2xl font-bold">ROV 隊伍任務平台</h1>
          <p className="text-sm text-slate-400">任務看板 · 時間規劃 · 任務日曆</p>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-300">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {googleEnabled && (
            <>
              <button
                onClick={googleLogin}
                disabled={googleBusy}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <GoogleIcon />
                {googleBusy ? "前往 Google…" : "使用 Google 帳號登入"}
              </button>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <div className="h-px flex-1 bg-slate-800" />
                或使用帳號密碼
                <div className="h-px flex-1 bg-slate-800" />
              </div>
            </>
          )}
          <form
            onSubmit={submit}
            className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
          >
            <div>
              <label className="mb-1 block text-sm text-slate-400">帳號</label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">密碼</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !username || !password}
              className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "登入中…" : "登入"}
            </button>
          </form>
          {!googleEnabled && (
            <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs leading-5 text-slate-500">
              帳號由隊長在「管理」頁開立；忘記密碼請找隊長重置。
            </p>
          )}
        </div>
      </div>
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
