"use client";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageEmpty, PageError, PageLoading } from "@/components/PageState";
import type { Me, Member, Settings } from "@/lib/types";

type AuditRow = {
  id: number;
  at: string;
  user_name: string | null;
  action: string;
  target: string | null;
  detail: string | null;
};

type AdminSettings = Settings & {
  discord_webhook: string;
  teams_webhook_teacher_cycle: string;
  teams_webhook_leader_cycle: string;
  teams_webhook_teacher_parts: string;
  ical_token: string;
  display_token: string;
  subteams: { key: string; zh: string; en: string }[];
  google_client_id: string;
  google_client_secret: string;
  google_domains: string;
  google_leader_emails: string;
  google_teacher_emails: string;
};

export default function AdminPage() {
  const { t } = useI18n();
  const { subteams } = useSubteams();
  const { confirm, prompt, toast } = useDialogs();
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [teamName, setTeamName] = useState("");
  const [compDate, setCompDate] = useState("");
  const [webhook, setWebhook] = useState("");

  const [wcTeacherCycle, setWcTeacherCycle] = useState("");
  const [wcLeaderCycle, setWcLeaderCycle] = useState("");
  const [wcTeacherParts, setWcTeacherParts] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleDomains, setGoogleDomains] = useState("");
  const [googleLeaderEmails, setGoogleLeaderEmails] = useState("");
  const [googleTeacherEmails, setGoogleTeacherEmails] = useState("");
  const [stList, setStList] = useState<{ key: string; zh: string; en: string }[]>([]);

  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newSubteam, setNewSubteam] = useState("general");
  const [newRole, setNewRole] = useState("member");

  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [logs, setLogs] = useState<AuditRow[]>([]);

  async function load() {
    const [u, s, m, a] = await Promise.all([
      api<{ user: Me | null }>("/api/auth/me"),
      api<AdminSettings>("/api/admin/settings"),
      api<{ members: Member[] }>("/api/members"),
      api<{ logs: AuditRow[] }>("/api/admin/audit-log").catch(() => ({ logs: [] as AuditRow[] })),
    ]);
    setMe(u.user);
    setSettings(s);
    setTeamName(s.team_name);
    setCompDate(s.competition_date ?? "");
    setWebhook(s.discord_webhook ?? "");

    setWcTeacherCycle(s.teams_webhook_teacher_cycle ?? "");
    setWcLeaderCycle(s.teams_webhook_leader_cycle ?? "");
    setWcTeacherParts(s.teams_webhook_teacher_parts ?? "");
    setGoogleClientId(s.google_client_id ?? "");
    setGoogleClientSecret(s.google_client_secret ?? "");
    setGoogleDomains(s.google_domains ?? "");
    setGoogleLeaderEmails(s.google_leader_emails ?? "");
    setGoogleTeacherEmails(s.google_teacher_emails ?? "");
    setMembers(m.members);
    setLogs(a.logs ?? []);
    setStList(JSON.parse(JSON.stringify(s.subteams ?? [])));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <PageError message={error} />;
  if (!me || !settings) return <PageLoading label={t("載入中…")} />;
  if (!isStaff(me.role)) {
    return (
      <div className="rounded-[16px] border border-border bg-card p-10 text-center">
        <p className="text-lg font-bold">{t("此頁面僅限隊長與老師使用")}</p>
        <p className="mt-2 text-sm text-ink-subtle">
          {t("需要調整隊伍設定或成員時，請聯絡隊長。")}
        </p>
      </div>
    );
  }

  async function saveSettings() {
    setMsg("");
    try {
      const s = await api<AdminSettings>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          team_name: teamName,
          competition_date: compDate || null,
          discord_webhook: webhook,
          teams_webhook_teacher_cycle: wcTeacherCycle,
          teams_webhook_leader_cycle: wcLeaderCycle,
          teams_webhook_teacher_parts: wcTeacherParts,
          google_client_id: googleClientId,
          google_client_secret: googleClientSecret,
          google_domains: googleDomains,
          google_leader_emails: googleLeaderEmails,
          google_teacher_emails: googleTeacherEmails,
        }),
      });
      setSettings(s);
      setMsg(t("設定已儲存") + "（" + t("重新整理後隊名生效於導覽列") + "）");
      toast(t("設定已儲存"));
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function saveSubteams() {
    try {
      await api<{ subteams: unknown[] }>("/api/subteams", {
        method: "PUT",
        body: JSON.stringify({ subteams: stList.filter((x) => x.zh.trim()) }),
      });
      toast(t("組別已更新"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function testNotify() {
    try {
      const r = await api<{ sent: boolean; reason?: string; status?: number | null }>("/api/admin/settings/test-notify", {
        method: "POST",
        body: JSON.stringify({ webhook: wcTeacherCycle }),
      });
      if (r.sent) {
        toast(t("✔ 測試成功！查看 Teams 頻道是否有訊息（Power Automate 可能需等 5–15 秒）"), "ok");
      } else if (r.reason === "invalid") {
        toast(t("網址無效（Discord/Teams 回 404/401），請重新複製完整網址"), "err");
      } else if (r.reason === "unreachable") {
        toast(t("連不上該網址（網路被擋或網址不可達）"), "err");
      } else if (r.reason === "empty") {
        toast(t("請先貼上 Webhook 網址"), "err");
      } else if (r.reason?.startsWith("http_")) {
        toast(t("對方回傳 HTTP ") + (r.status ?? "") + t("（202=已接收但流程仍在跑也算成功；其他碼請檢查 Power Automate 流程的「回應」步驟）"), "err");
      } else {
        toast(t("測試失敗，請確認網址"), "err");
      }
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function copyIcalUrl() {
    if (!settings) return;
    const url = `${location.origin}/api/ical?token=${settings.ical_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("訂閱連結已複製！在日曆 App 選「訂閱日曆」貼上即可同步"));
    } catch {
      await prompt({ title: "複製這個 iCal 訂閱連結", initial: url });
    }
  }

  function displayUrl() {
    if (!settings) return "";
    return `${location.origin}/display?token=${settings.display_token}`;
  }

  async function copyDisplayUrl() {
    const url = displayUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast(t("看板連結已複製！貼到 Raspberry Pi 的瀏覽器即可長期顯示"));
    } catch {
      await prompt({ title: "複製這個看板連結", initial: url });
    }
  }

  async function rotateIcal() {
    const ok = await confirm({
      title: t("重新產生訂閱連結"),
      message: t("舊的訂閱連結會立刻失效。"),
      confirmText: t("確定"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ rotate_ical: true }),
      });
      toast(t("已重新產生"));
      load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function rotateDisplay() {
    const ok = await confirm({
      title: t("重新產生看板連結？"),
      message: t("舊連結立即失效，Raspberry Pi 要改用新連結。"),
      confirmText: t("確定"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ rotate_display: true }),
      });
      toast(t("已重新產生"));
      load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function copyGoogleCallback() {
    const url = `${location.origin}/api/auth/google/callback`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("回呼網址已複製！在 Google Cloud 的 OAuth 設定裡貼上即可"));
    } catch {
      await prompt({ title: "複製這個回呼網址", initial: url });
    }
  }

  async function addMember() {
    setMsg("");
    try {
      await api("/api/admin/members", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername,
          display_name: newName,
          password: newPassword,
          subteam: newSubteam,
          role: newRole,
        }),
      });
      setNewName("");
      setNewUsername("");
      setNewPassword("");
      await load();
      setMsg(t("已新增成員") + `「${newName}」`);
      toast(t("已新增成員") + `「${newName}」` + t("，把帳號密碼告訴他吧"));
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function updateMember(m: Member, patch: { subteam?: string; role?: string }) {
    try {
      await api(`/api/admin/members/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (patch.role) toast(`${t("已更新")}「${m.display_name}」${t("的角色")}`);
      if (patch.subteam) toast(`${t("已更新")}「${m.display_name}」${t("的組別")}`);
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
      await load();
    }
  }

  async function removeMember(m: Member) {
    const ok = await confirm({
      title: `${t("刪除成員")}「${m.display_name}」（${m.username}）？`,
      message: t("他負責的任務會變成未指派。"),
      confirmText: t("刪除"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/members/${m.id}`, { method: "DELETE" });
      toast(t("已刪除成員"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function resetPassword(m: Member) {
    if (resetPw.length < 6) {
      toast(t("密碼至少 6 個字"), "err");
      return;
    }
    try {
      await api(`/api/admin/members/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPw }),
      });
      setResetId(null);
      setResetPw("");
      toast(t("已重設") + `「${m.display_name}」` + t("的密碼"));
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="board-title">{t("管理")}（{t("隊長與老師")}）</h1>
      {msg && (
        <p className="rounded-lg border border-emerald-500/30 bg-green-50 px-3 py-2 text-sm text-emerald-600">
          {msg}
        </p>
      )}

      <Card><CardContent>
        <h2 className="mb-3 font-bold">{t("隊伍設定")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-ink-subtle">{t("隊伍名稱")}</label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-subtle">
              {t("比賽日期（首頁倒數用）")}
            </label>
            <Input
              type="date"
              value={compDate}
              onChange={(e) => setCompDate(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" className="mt-3" onClick={saveSettings}>{t("儲存設定")}</Button>
      </CardContent></Card>

      <Card><CardContent>
        <h2 className="mb-1 font-bold">{t("通知與整合")}</h2>
        <p className="mb-3 text-xs text-ink-tertiary">
          {t("設定 Discord Webhook 後，各類事件會自動推到對應的頻道")}（{t("Discord 頻道設定 → 整合 → Webhook → 建立並複製網址）")}）。
          
        </p>
        <div className="space-y-2">
          <WebhookRow
            label={t("Discord Webhook（任務指派）")}
            value={webhook}
            onChange={setWebhook}
            placeholder="https://discord.com/api/webhooks/…"
          />
          <WebhookRow
            label={t("週期審批頻道（老師收到）")}
            value={wcTeacherCycle}
            onChange={setWcTeacherCycle}
          />
          <WebhookRow
            label={t("週期審批頻道（隊長收到）")}
            value={wcLeaderCycle}
            onChange={setWcLeaderCycle}
          />
          <WebhookRow
            label={t("零件審批頻道（老師收到）")}
            value={wcTeacherParts}
            onChange={setWcTeacherParts}
          />
        </div>
        <div className="mt-3">
          <Button type="button" variant="ghost" onClick={testNotify}>{t("發送測試通知（測試第一個頻道）")}</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-subtle">{t("日曆訂閱（iCal）")}：</span>
          <Button type="button" variant="ghost" onClick={copyIcalUrl}>{t("複製訂閱連結")}</Button>
          <Button type="button" variant="ghost" onClick={rotateIcal}>{t("重新產生訂閱連結")}</Button>
          <span className="text-xs text-ink-tertiary">
            {t("隊員在手機日曆 App「訂閱日曆」貼上，例會、水測自動同步")}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-subtle">{t("團隊看板（Raspberry Pi）")}：</span>
          <Button type="button" variant="ghost" onClick={copyDisplayUrl}>{t("複製看板連結")}</Button>
          <Button type="button" variant="ghost" onClick={rotateDisplay}>{t("重新產生")}</Button>
          <span className="text-xs text-ink-tertiary">
            {t("全屏顯示進行中週期與近兩週日程，每分鐘自動更新，免登入")}
          </span>
        </div>
      </CardContent></Card>

      <Card><CardContent>
        <h2 className="mb-1 font-bold">{t("組別管理")}</h2>
        <p className="mb-3 text-xs text-ink-tertiary">{t("自訂全站使用的組別（任務、成員、活動都會跟著）；刪除組別時，原屬成員與任務會自動改到第一個剩餘組別")}</p>
        <div className="space-y-2">
          {stList.map((row, i) => (
            <div key={row.key || "new" + i} className="flex flex-wrap items-center gap-2">
              <Input
                className="w-40 rounded-lg border border-hairline-strong bg-surface-1 px-3 py-2 text-sm text-ink"
                placeholder={t("中文名稱")}
                value={row.zh}
                onChange={(e) => {
                  const next = [...stList];
                  next[i] = { ...row, zh: e.target.value };
                  setStList(next);
                }}
              />
              <Input
                className="w-40 rounded-lg border border-hairline-strong bg-surface-1 px-3 py-2 text-sm text-ink"
                placeholder={t("英文名稱")}
                value={row.en}
                onChange={(e) => {
                  const next = [...stList];
                  next[i] = { ...row, en: e.target.value };
                  setStList(next);
                }}
              />
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-muted-foreground hover:text-destructive"
                onClick={() => setStList(stList.filter((_, j) => j !== i))}
                disabled={stList.length <= 1}
              >
                {t("刪除")}
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setStList([...stList, { key: "", zh: "", en: "" }])}>
            ＋ {t("新增組別")}
          </Button>
          <Button type="button" onClick={saveSubteams}>
            {t("儲存組別")}
          </Button>
        </div>
      </CardContent></Card>

      <Card><CardContent>
        <h2 className="mb-1 font-bold">{t("Google 登入")}</h2>
        <p className="mb-3 text-xs text-ink-tertiary">
          {t("設定後隊員可在登入頁用學校 Google 帳號登入（首次自動建立帳號）。")} {t("回呼網址（複製到 Google Cloud OAuth 設定）")}：
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-[#2383a5]">
            {typeof window !== "undefined" ? `${location.origin}/api/auth/google/callback` : "/api/auth/google/callback"}
          </code>
          <Button type="button" variant="ghost" onClick={copyGoogleCallback}>{t("複製")}</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-ink-subtle">{t("Google 用戶端 ID（Client ID）")}</label>
            <Input
              placeholder="xxx.apps.googleusercontent.com"
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-ink-subtle">{t("Google 用戶端密鑰（Client Secret）")}</label>
            <Input
              type="password"
              placeholder={t("（從 Google Cloud 複製的 Client Secret）")}
              value={googleClientSecret}
              onChange={(e) => setGoogleClientSecret(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-ink-subtle">
              {t("允許登入的網域（以逗號分隔，只限這些網域的 email）")}
            </label>
            <Input
              placeholder="stu.ssc.edu.hk, ssc.edu.hk"
              value={googleDomains}
              onChange={(e) => setGoogleDomains(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-subtle">
              {t("隊長 email（這些 Google 帳號登入＝隊長）")}
            </label>
            <Input
              placeholder="leader@ssc.edu.hk"
              value={googleLeaderEmails}
              onChange={(e) => setGoogleLeaderEmails(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-subtle">
              {t("老師 email（這些 Google 帳號登入＝老師）")}
            </label>
            <Input
              placeholder="teacher@ssc.edu.hk"
              value={googleTeacherEmails}
              onChange={(e) => setGoogleTeacherEmails(e.target.value)}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-tertiary">
          {t("組別一律為「全隊」，日後可在「帳號」由老師／隊長調整。密碼登入不受影響，仍可作為後備。")}
        </p>
      </CardContent></Card>

      <Card><CardContent>
        <h2 className="mb-3 font-bold">{t("成員")}（{members.length}）</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-tertiary">
                <th className="px-2 py-2 font-medium">{t("名稱")}</th>
                <th className="px-2 py-2 font-medium">{t("使用者名稱")}</th>
                <th className="px-2 py-2 font-medium">{t("組別")}</th>
                <th className="px-2 py-2 font-medium">{t("角色")}</th>
                <th className="px-2 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-hairline/60">
                  <td className="px-2 py-2.5">{m.display_name}</td>
                  <td className="px-2 py-2.5 text-ink-subtle">{m.username}</td>
                  <td className="px-2 py-2.5">
                    <Select value={m.subteam} onValueChange={(value) => value && updateMember(m, { subteam: value })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {subteams.map((x) => (
                          <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2.5">
                    <Select value={m.role} onValueChange={(value) => value && updateMember(m, { role: value })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">{t("隊員")}</SelectItem>
                        <SelectItem value="teacher">{t("老師")}</SelectItem>
                        <SelectItem value="leader">{t("隊長")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {resetId === m.id ? (
                      <span className="inline-flex gap-1">
                        <Input
                          className="w-28 rounded-lg border border-hairline-strong bg-surface-2 px-2 py-1 text-xs"
                          placeholder={t("新密碼")}
                          value={resetPw}
                          onChange={(e) => setResetPw(e.target.value)}
                        />
                        <Button type="button" variant="ghost" onClick={() => resetPassword(m)}>{t("確定")}</Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setResetId(null);
                            setResetPw("");
                          }}
                        >{t("取消")}</Button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-3">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto px-0 text-muted-foreground"
                          onClick={() => setResetId(m.id)}
                        >{t("重設密碼")}</Button>
                        {m.id !== me.id && (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto px-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeMember(m)}
                          >{t("刪除")}</Button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      <Card><CardContent>
        <h2 className="mb-3 font-bold">{t("新增成員")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            placeholder={t("顯示名稱，例如：王小明")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder={t("帳號（英數字）")}
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
          <Input
            placeholder={t("初始密碼（至少 6 字）")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Select value={newSubteam} onValueChange={(value) => value && setNewSubteam(value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subteams.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {t("組別")}：{s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newRole} onValueChange={(value) => value && setNewRole(value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{t("角色")}：{t("隊員")}</SelectItem>
              <SelectItem value="teacher">{t("角色")}：{t("老師")}</SelectItem>
              <SelectItem value="leader">{t("角色")}：{t("隊長")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={!newName || !newUsername || newPassword.length < 6}
            onClick={addMember}
          >{t("新增")}</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent>
        <h2 className="mb-3 font-bold">{t("審計紀錄")}</h2>
        {logs.length === 0 ? (
          <PageEmpty>{t("沒有審計紀錄")}</PageEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-tertiary">
                  <th className="px-2 py-2 font-medium">{t("時間")}</th>
                  <th className="px-2 py-2 font-medium">{t("操作者")}</th>
                  <th className="px-2 py-2 font-medium">{t("動作")}</th>
                  <th className="px-2 py-2 font-medium">{t("對象")}</th>
                  <th className="px-2 py-2 font-medium">{t("內容")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id} className="border-t border-hairline/60">
                    <td className="px-2 py-2 whitespace-nowrap text-ink-subtle">{fmtAt(row.at)}</td>
                    <td className="px-2 py-2">{row.user_name ?? "—"}</td>
                    <td className="px-2 py-2">{row.action}</td>
                    <td className="px-2 py-2 text-ink-subtle">{row.target ?? "—"}</td>
                    <td className="px-2 py-2 text-ink-subtle">{row.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

function fmtAt(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return String(at);
  return d.toLocaleString();
}


function WebhookRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-64 shrink-0 text-sm text-ink-subtle">{label}</span>
      <Input
        className="min-w-64 flex-1 rounded-lg border border-hairline-strong bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-primary focus:outline-none"
        placeholder={placeholder ?? `https://…（${t("Teams 或 Power Automate 的 Webhook 網址")}）`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
