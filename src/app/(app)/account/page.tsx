"use client";
import { useI18n } from "@/lib/i18n";
import { isStaff, roleLabelCn } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { BTN, INPUT_CLS, subteamLabel } from "@/lib/ui";
import type { Me } from "@/lib/types";

export default function AccountPage() {
  const { t } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ user: Me | null }>("/api/auth/me")
      .then((r) => setMe(r.user))
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {error}
      </p>
    );
  }
  if (!me) {
    return <p className="py-20 text-center text-sm text-slate-500">{t("載入中…")}</p>;
  }
  const forceChange = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("force") === "1" || !me.password_changed_at;

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (next !== confirmPw) {
      setError(t("兩次輸入的新密碼不一致"));
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ current, next }),
      });
      setMsg(t("密碼已更新"));
      setCurrent("");
      setNext("");
      setConfirmPw("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-lg font-bold">{t("帳號")}</h1>
      {forceChange && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {t("請先設定新密碼再開始使用（首次登入或密碼已被重設）")}
        </div>
      )}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm">
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-slate-400">{t("顯示名稱")}</dt>
            <dd>{me.display_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">{t("帳號")}</dt>
            <dd className="text-slate-300">{me.username}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">{t("組別")}</dt>
            <dd>{subteamLabel(me.subteam)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">{t("角色")}</dt>
            <dd>{roleLabelCn(me.role)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          {t("名稱與組別請請隊長在「管理」頁調整。")}
        </p>
      </section>

      {me.login_method === "google" ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm">
          <h2 className="mb-2 font-bold">{t("登入方式")}</h2>
          <p className="text-slate-300">
            {t("此帳號使用學校 Google 帳號登入，無需設定密碼。")}
          </p>
        </section>
      ) : (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-3 font-bold">{t("修改密碼")}</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <input
            type="password"
            className={INPUT_CLS}
            placeholder={t("目前密碼")}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
          <input
            type="password"
            className={INPUT_CLS}
            placeholder={t("新密碼（至少 6 字）")}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
          <input
            type="password"
            className={INPUT_CLS}
            placeholder={t("再輸入一次新密碼")}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          {msg && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {msg}
            </p>
          )}
          <button className={BTN} disabled={busy || !current || next.length < 6}>
            {busy ? t("處理中…") : t("更新密碼")}
          </button>
        </form>
      </section>
      )}
    </div>
  );
}
