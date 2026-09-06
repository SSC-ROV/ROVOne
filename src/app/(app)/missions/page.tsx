"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { BTN, INPUT_CLS } from "@/lib/ui";
import { useDialogs } from "@/components/ui/Dialogs";
import type { Me, MissionTask } from "@/lib/types";

export default function MissionsPage() {
  const { confirm, toast } = useDialogs();
  const [missions, setMissions] = useState<MissionTask[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [m, u] = await Promise.all([
      api<{ missions: MissionTask[] }>("/api/missions"),
      api<{ user: Me | null }>("/api/auth/me"),
    ]);
    setMissions(m.missions);
    setMe(u.user);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p>
    );
  }
  if (!missions || !me) {
    return <p className="py-20 text-center text-sm text-slate-500">載入中…</p>;
  }

  const withTasks = missions.filter((m) => m.task_total > 0);
  const overall =
    withTasks.length > 0
      ? Math.round(
          (withTasks.reduce((a, m) => a + m.task_done, 0) /
            withTasks.reduce((a, m) => a + m.task_total, 0)) *
            100
        )
      : 0;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api("/api/missions", {
        method: "POST",
        body: JSON.stringify({ title, description, points: Number(points) || null }),
      });
      setTitle("");
      setPoints("");
      setDescription("");
      toast("比賽任務已新增");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  async function remove(m: MissionTask) {
    const ok = await confirm({
      title: `刪除比賽任務「${m.title}」？`,
      message: "關聯的工程任務會變成未關聯。",
      confirmText: "刪除",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/missions/${m.id}`, { method: "DELETE" });
      toast("已刪除");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">比賽任務對照表</h1>
        <span className="text-sm text-slate-500">
          規則書的每個任務拆成工程任務，完成度一目了然（在看板編輯任務時可關聯）
        </span>
      </div>

      <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/15 to-blue-600/5 p-5">
        <p className="text-sm text-cyan-300/90">整體備賽完成度（有拆解的任務）</p>
        <div className="mt-2 flex items-center gap-4">
          <p className="text-4xl font-black tabular-nums">{overall}%</p>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
              style={{ width: `${overall}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {missions.length === 0 && (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/40 py-12 text-center text-sm text-slate-500">
            還沒有比賽任務，請隊長依規則書新增
          </p>
        )}
        {missions.map((m) => {
          const pct = m.task_total > 0 ? Math.round((m.task_done / m.task_total) * 100) : null;
          return (
            <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{m.title}</span>
                {m.points != null && (
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                    {m.points} 分
                  </span>
                )}
                <span className="ml-auto text-sm tabular-nums text-slate-300">
                  {pct === null ? (
                    <span className="text-amber-300">尚未拆解工程任務</span>
                  ) : (
                    `${m.task_done}/${m.task_total} · ${pct}%`
                  )}
                </span>
              </div>
              {m.description && <p className="mt-1 text-sm text-slate-400">{m.description}</p>}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct === 100 ? "bg-emerald-500" : pct === null ? "" : "bg-cyan-500"
                  }`}
                  style={{ width: `${pct ?? 0}%` }}
                />
              </div>
              {me.role === "leader" && (
                <button
                  onClick={() => remove(m)}
                  className="mt-2 text-xs text-slate-500 transition hover:text-rose-400"
                >
                  刪除
                </button>
              )}
            </div>
          );
        })}
      </div>

      {me.role === "leader" && (
        <form onSubmit={add} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="font-bold">新增比賽任務（照規則書一條一條加）</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem_2fr_auto]">
            <input className={INPUT_CLS} placeholder="任務名稱，例如：穿越閘門" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className={INPUT_CLS} type="number" min="0" placeholder="配分" value={points} onChange={(e) => setPoints(e.target.value)} />
            <input className={INPUT_CLS} placeholder="說明（選填）" value={description} onChange={(e) => setDescription(e.target.value)} />
            <button className={BTN} disabled={!title.trim()}>新增</button>
          </div>
        </form>
      )}
    </div>
  );
}
