"use client";
import { useI18n } from "@/lib/i18n";
import { isStaff, roleLabelCn } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PageLoading } from "@/components/PageState";
import { subteamLabel } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      <p className="rounded-xl border border-rose-500/30 bg-red-50 p-4 text-sm text-[#eb5757]">
        {error}
      </p>
    );
  }
  if (!me) {
    return <PageLoading label={t("載入中…")} />;
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
      <h1 className="board-title">{t("帳號")}</h1>
      {forceChange && (
        <div className="rounded-xl border border-amber-200 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
          {t("請先設定新密碼再開始使用（首次登入或密碼已被重設）")}
        </div>
      )}
      <Card size="sm">
        <CardContent className="text-sm">
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-ink-subtle">{t("顯示名稱")}</dt>
            <dd>{me.display_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-subtle">{t("使用者名稱")}</dt>
            <dd className="text-ink-muted">{me.username}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-subtle">{t("組別")}</dt>
            <dd>{subteamLabel(me.subteam)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-subtle">{t("角色")}</dt>
            <dd>{roleLabelCn(me.role)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-tertiary">
          {t("名稱與組別請請隊長在「管理」頁調整。")}
        </p>
        </CardContent>
      </Card>

      {me.login_method === "google" ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("登入方式")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
          <p className="text-ink-muted">
            {t("此帳號使用學校 Google 帳號登入，無需設定密碼。")}
          </p>
          </CardContent>
        </Card>
      ) : (
      <Card size="sm">
        <CardHeader>
          <CardTitle>{t("修改密碼")}</CardTitle>
        </CardHeader>
        <CardContent>
        <form onSubmit={changePassword} className="space-y-3">
          <Input
            type="password"
            placeholder={t("目前密碼")}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            type="password"
            placeholder={t("新密碼（至少 6 字）")}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder={t("再輸入一次新密碼")}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-red-50 px-3 py-2 text-sm text-[#eb5757]">
              {error}
            </p>
          )}
          {msg && (
            <p className="rounded-lg border border-emerald-500/30 bg-green-50 px-3 py-2 text-sm text-emerald-600">
              {msg}
            </p>
          )}
          <Button type="submit" disabled={busy || !current || next.length < 6}>
            {busy ? t("處理中…") : t("更新密碼")}
          </Button>
        </form>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
