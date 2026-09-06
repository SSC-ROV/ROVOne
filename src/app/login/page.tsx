"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "登入中…" : "登入"}
          </button>
          <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs leading-5 text-slate-400">
            預設帳號：<span className="text-cyan-300">leader</span> / 密碼{" "}
            <span className="text-cyan-300">rov2026</span>（隊長）
            <br />
            登入後請到「帳號」頁修改密碼，並在「管理」頁替隊員開帳號。
          </p>
        </form>
      </div>
    </main>
  );
}
