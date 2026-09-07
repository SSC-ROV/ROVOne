"use client";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { daysBetween, fmtMD, todayStr, weekdayCn } from "@/lib/date";
import { CHIP, SUBTEAM_CLS, priorityDot, subteamLabel } from "@/lib/ui";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import type { Me, Settings, Task, TeamEvent } from "@/lib/types";

export default function DashboardPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [u, s, ts, e] = await Promise.all([
        api<{ user: Me | null }>("/api/auth/me"),
        api<Settings>("/api/settings"),
        api<{ tasks: Task[] }>("/api/tasks"),
        api<{ events: TeamEvent[] }>("/api/events"),
      ]);
      if (!u.user) {
        router.replace("/login");
        return;
      }
      setMe(u.user);
      setSettings(s);
      setTasks(ts.tasks);
      setEvents(e.events);
    })().catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {t(error)}
      </p>
    );
  }
  if (!tasks || !me || !settings) {
    return <p className="py-20 text-center text-sm text-slate-500">{t("載入中…")}</p>;
  }

  const today = todayStr();
  const open = tasks.filter((x) => x.status !== "done");
  const overdue = open.filter((x) => x.due_date && x.due_date < today);
  const weekDue = open
    .filter((x) => x.due_date && x.due_date >= today && x.due_date <= addDays7(today))
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const myTasks = open
    .filter((x) => x.assignee_id === me.id)
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
        diff > 0
          ? t("距離比賽還有")
          : diff === 0
            ? t("比賽就是今天！")
            : t("比賽已結束"),
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
                <span className="ml-1 text-base font-medium text-slate-400">{t("天")}</span>
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {fmtMD(settings.competition_date!)}（{weekdayCn(settings.competition_date!)}）
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400">{t("尚未設定比賽日期")}</p>
              {isStaff(me.role) ? (
                <Link
                  href="/admin"
                  className="mt-2 inline-block text-sm text-cyan-300 hover:underline"
                >
                  {t("前往「管理」設定 →")}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-500">{t("請隊長或老師於「管理」頁設定")}</p>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 md:col-span-2">
          <StatCard label={t("進行中任務")} value={open.filter((x) => x.status === "doing").length} accent="text-cyan-300" />
          <StatCard label={t("已逾期")} value={overdue.length} accent={overdue.length ? "text-rose-400" : "text-slate-400"} />
          <StatCard label={t("本週截止")} value={weekDue.length} accent="text-amber-300" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{t("我的任務")}</h2>
            <Link href="/board" className="text-sm text-cyan-300 hover:underline">
              {t("到看板 →")}
            </Link>
          </div>
          {myTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t("目前沒有指派給你的任務，去泡茶吧 ☕")}</p>
          ) : (
            <ul className="space-y-2">
              {myTasks.slice(0, 6).map((x) => (
                <li key={x.id}>
                  <Link
                    href="/board"
                    className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm transition hover:border-slate-600"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${priorityDot(x.priority)}`} />
                    <span className="flex-1 truncate">{x.title}</span>
                    {x.due_date && (
                      <span
                        className={`shrink-0 text-xs ${
                          x.due_date < today ? "text-rose-400" : "text-slate-400"
                        }`}
                      >
                        {x.due_date < today ? t("逾期 ") : ""}
                        {fmtMD(x.due_date)}
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
            <h2 className="mb-3 font-bold">{t("本週即將截止")}</h2>
            {weekDue.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">{t("本週沒有任務截止")}</p>
            ) : (
              <ul className="space-y-2">
                {weekDue.slice(0, 5).map((x) => (
                  <TaskRow key={x.id} task={x} today={today} t={t} />
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">{t("近期活動")}</h2>
              <Link href="/calendar" className="text-sm text-cyan-300 hover:underline">
                {t("日曆 →")}
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">{t("沒有排定的活動")}</p>
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

function rank(x: Task): number {
  if (x.status === "doing") return 0;
  if (x.status === "todo") return 1;
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

function TaskRow({ task, today, t }: { task: Task; today: string; t: (s: string) => string }) {
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
      {task.due_date === today && <span className="shrink-0 text-xs text-amber-300">{t("今天！")}</span>}
    </li>
  );
}
