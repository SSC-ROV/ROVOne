"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import {
  daysBetween,
  fmtMD,
  todayStr,
  weekdayCn,
} from "@/lib/date";
import {
  CHIP,
  SUBTEAM_CLS,
  priorityDot,
  subteamLabel,
} from "@/lib/ui";
import type { Me, Settings, Task, TeamEvent } from "@/lib/types";

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [u, s, t, e] = await Promise.all([
        api<{ user: Me | null }>("/api/auth/me"),
        api<Settings>("/api/settings"),
        api<{ tasks: Task[] }>("/api/tasks"),
        api<{ events: TeamEvent[] }>("/api/events"),
      ]);
      setMe(u.user);
      setSettings(s);
      setTasks(t.tasks);
      setEvents(e.events);
    })().catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {error}
      </p>
    );
  }
  if (!tasks || !me || !settings) {
    return <p className="py-20 text-center text-sm text-slate-500">載入中…</p>;
  }

  const today = todayStr();
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const weekDue = open
    .filter((t) => t.due_date && t.due_date >= today && t.due_date <= addDays7(today))
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const myTasks = open
    .filter((t) => t.assignee_id === me.id)
    .sort((a, b) => rank(a) - rank(b));
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 4);

  let countdown: { label: string; days: number } | null = null;
  if (settings.competition_date) {
    const diff = daysBetween(today, settings.competition_date);
    countdown = {
      label:
        diff > 0 ? "距離比賽還有" : diff === 0 ? "比賽就是今天！" : "比賽已結束",
      days: Math.abs(diff),
    };
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/15 to-blue-600/5 p-5 md:col-span-1">
          {countdown ? (
            <>
              <p className="text-sm text-cyan-300/90">{countdown.label}</p>
              <p className="mt-1 text-5xl font-black tabular-nums">
                {countdown.days}
                <span className="ml-1 text-base font-medium text-slate-400">天</span>
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {fmtMD(settings.competition_date!)}（{weekdayCn(settings.competition_date!)}）
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400">尚未設定比賽日期</p>
              {me.role === "leader" ? (
                <Link
                  href="/admin"
                  className="mt-2 inline-block text-sm text-cyan-300 hover:underline"
                >
                  前往「管理」設定 →
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-500">請隊長於「管理」頁設定</p>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 md:col-span-2">
          <StatCard label="進行中任務" value={open.filter((t) => t.status === "doing").length} accent="text-cyan-300" />
          <StatCard label="已逾期" value={overdue.length} accent={overdue.length ? "text-rose-400" : "text-slate-400"} />
          <StatCard label="本週截止" value={weekDue.length} accent="text-amber-300" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">我的任務</h2>
            <Link href="/board" className="text-sm text-cyan-300 hover:underline">
              到看板 →
            </Link>
          </div>
          {myTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              目前沒有指派給你的任務，去泡茶吧 ☕
            </p>
          ) : (
            <ul className="space-y-2">
              {myTasks.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link
                    href="/board"
                    className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm transition hover:border-slate-600"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${priorityDot(t.priority)}`} />
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.due_date && (
                      <span
                        className={`shrink-0 text-xs ${
                          t.due_date < today ? "text-rose-400" : "text-slate-400"
                        }`}
                      >
                        {t.due_date < today ? "逾期 " : ""}
                        {fmtMD(t.due_date)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-3 font-bold">本週即將截止</h2>
            {weekDue.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">本週沒有任務截止</p>
            ) : (
              <ul className="space-y-2">
                {weekDue.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} today={today} />
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">近期活動</h2>
              <Link href="/calendar" className="text-sm text-cyan-300 hover:underline">
                日曆 →
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">沒有排定的活動</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm"
                  >
                    <span className="w-20 shrink-0 text-slate-400">
                      {fmtMD(e.date)}
                      {e.time && <span className="ml-1">{e.time}</span>}
                    </span>
                    <span className="flex-1 truncate">{e.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function addDays7(base: string): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function rank(t: Task): number {
  if (t.status === "doing") return 0;
  if (t.status === "todo") return 1;
  return 2;
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center">
      <p className={`text-3xl font-black tabular-nums ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function TaskRow({ task, today }: { task: Task; today: string }) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm">
      <span className={`h-2 w-2 shrink-0 rounded-full ${priorityDot(task.priority)}`} />
      <span className="flex-1 truncate">{task.title}</span>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${SUBTEAM_CLS[task.subteam] ?? ""}`}>
        {subteamLabel(task.subteam)}
      </span>
      {task.assignee_name && (
        <span className={`shrink-0 ${CHIP} border-slate-700 text-slate-300`}>
          {task.assignee_name}
        </span>
      )}
      <span className="shrink-0 text-xs text-slate-400">{fmtMD(task.due_date!)}</span>
      {task.due_date === today && <span className="shrink-0 text-xs text-amber-300">今天！</span>}
    </li>
  );
}
