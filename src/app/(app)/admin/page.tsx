"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { BTN, BTN_GHOST, INPUT_CLS, SUBTEAMS, subteamLabel } from "@/lib/ui";
import { useDialogs } from "@/components/ui/Dialogs";
import type { Me, Member, Settings } from "@/lib/types";

type AdminSettings = Settings & { discord_webhook: string; ical_token: string };

export default function AdminPage() {
  const { confirm, prompt, toast } = useDialogs();
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [teamName, setTeamName] = useState("");
  const [compDate, setCompDate] = useState("");
  const [webhook, setWebhook] = useState("");

  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newSubteam, setNewSubteam] = useState("general");
  const [newRole, setNewRole] = useState("member");

  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState("");

  async function load() {
    const [u, s, m] = await Promise.all([
      api<{ user: Me | null }>("/api/auth/me"),
      api<AdminSettings>("/api/admin/settings"),
      api<{ members: Member[] }>("/api/members"),
    ]);
    setMe(u.user);
    setSettings(s);
    setTeamName(s.team_name);
    setCompDate(s.competition_date ?? "");
    setWebhook(s.discord_webhook ?? "");
    setMembers(m.members);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {error}
      </p>
    );
  }
  if (!me || !settings) {
    return <p className="py-20 text-center text-sm text-slate-500">載入中…</p>;
  }
  if (me.role !== "leader") {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center">
        <p className="text-lg font-bold">此頁面僅限隊長使用</p>
        <p className="mt-2 text-sm text-slate-400">
          需要調整隊伍設定或成員時，請聯絡隊長。
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
        }),
      });
      setSettings(s);
      setMsg("設定已儲存（重新整理後隊名生效於導覽列）");
      toast("設定已儲存");
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  async function testNotify() {
    try {
      const r = await api<{ sent: boolean }>("/api/admin/settings/test-notify", { method: "POST" });
      if (r.sent) {
        toast("測試通知已發送到 Discord，去頻道看看！", "ok");
      } else {
        toast("沒有發送成功：請先按「儲存設定」，並確認 Discord Webhook 網址正確", "err");
      }
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  async function copyIcalUrl() {
    if (!settings) return;
    const url = `${location.origin}/api/ical?token=${settings.ical_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("訂閱連結已複製！在日曆 App 選「訂閱日曆」貼上即可同步");
    } catch {
      await prompt({ title: "複製這個 iCal 訂閱連結", initial: url });
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
      setMsg(`已新增成員「${newName}」`);
      toast(`已新增成員「${newName}」，把帳號密碼告訴他吧`);
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  async function removeMember(m: Member) {
    const ok = await confirm({
      title: `刪除成員「${m.display_name}」（${m.username}）？`,
      message: "他負責的任務會變成未指派。",
      confirmText: "刪除",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/members/${m.id}`, { method: "DELETE" });
      toast("已刪除成員");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  async function resetPassword(m: Member) {
    if (resetPw.length < 6) {
      toast("密碼至少 6 個字", "err");
      return;
    }
    try {
      await api(`/api/admin/members/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPw }),
      });
      setResetId(null);
      setResetPw("");
      toast(`已重設「${m.display_name}」的密碼`);
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">管理（僅隊長）</h1>
      {msg && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {msg}
        </p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-3 font-bold">隊伍設定</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-400">隊伍名稱</label>
            <input
              className={INPUT_CLS}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">
              比賽日期（首頁倒數用）
            </label>
            <input
              type="date"
              className={INPUT_CLS}
              value={compDate}
              onChange={(e) => setCompDate(e.target.value)}
            />
          </div>
        </div>
        <button className={`${BTN} mt-3`} onClick={saveSettings}>
          儲存設定
        </button>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-1 font-bold">通知與整合</h2>
        <p className="mb-3 text-xs text-slate-500">
          設定 Discord Webhook 後，任務指派、零件審核結果會自動推到你的頻道
          （Discord 頻道設定 → 整合 → Webhook → 建立並複製網址）
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${INPUT_CLS} flex-1 sm:min-w-96`}
            placeholder="https://discord.com/api/webhooks/…"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
          />
          <button className={BTN_GHOST} onClick={testNotify}>
            發送測試通知
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-400">日曆訂閱（iCal）：</span>
          <button className={BTN_GHOST} onClick={copyIcalUrl}>
            複製訂閱連結
          </button>
          <span className="text-xs text-slate-500">
            隊員在手機日曆 App「訂閱日曆」貼上，例會、水測、任務截止自動同步
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-3 font-bold">成員（{members.length}）</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="px-2 py-2 font-medium">名稱</th>
                <th className="px-2 py-2 font-medium">帳號</th>
                <th className="px-2 py-2 font-medium">組別</th>
                <th className="px-2 py-2 font-medium">角色</th>
                <th className="px-2 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-slate-800/60">
                  <td className="px-2 py-2.5">{m.display_name}</td>
                  <td className="px-2 py-2.5 text-slate-400">{m.username}</td>
                  <td className="px-2 py-2.5 text-slate-300">
                    {subteamLabel(m.subteam)}
                  </td>
                  <td className="px-2 py-2.5">
                    {m.role === "leader" ? (
                      <span className="text-cyan-300">隊長</span>
                    ) : (
                      <span className="text-slate-400">隊員</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {resetId === m.id ? (
                      <span className="inline-flex gap-1">
                        <input
                          className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                          placeholder="新密碼"
                          value={resetPw}
                          onChange={(e) => setResetPw(e.target.value)}
                        />
                        <button className={BTN_GHOST} onClick={() => resetPassword(m)}>
                          確定
                        </button>
                        <button
                          className={BTN_GHOST}
                          onClick={() => {
                            setResetId(null);
                            setResetPw("");
                          }}
                        >
                          取消
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-3">
                        <button
                          className="text-slate-400 transition hover:text-cyan-300"
                          onClick={() => setResetId(m.id)}
                        >
                          重設密碼
                        </button>
                        {m.id !== me.id && (
                          <button
                            className="text-slate-400 transition hover:text-rose-400"
                            onClick={() => removeMember(m)}
                          >
                            刪除
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-3 font-bold">新增成員</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className={INPUT_CLS}
            placeholder="顯示名稱，例如：王小明"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className={INPUT_CLS}
            placeholder="帳號（英數字）"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
          <input
            className={INPUT_CLS}
            placeholder="初始密碼（至少 6 字）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <select
            className={INPUT_CLS}
            value={newSubteam}
            onChange={(e) => setNewSubteam(e.target.value)}
          >
            {SUBTEAMS.map((s) => (
              <option key={s.key} value={s.key}>
                組別：{s.label}
              </option>
            ))}
          </select>
          <select
            className={INPUT_CLS}
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          >
            <option value="member">角色：隊員</option>
            <option value="leader">角色：隊長</option>
          </select>
          <button
            className={BTN}
            disabled={!newName || !newUsername || newPassword.length < 6}
            onClick={addMember}
          >
            新增
          </button>
        </div>
      </section>
    </div>
  );
}
