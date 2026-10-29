"use client";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { addDaysStr, daysBetween, fmtMD, todayStr, weekdayCn } from "@/lib/date";
import { STATUSES, cycleStatus, groupColor } from "@/lib/ui";
import { useI18n } from "@/lib/i18n";
import CycleTimeline from "@/components/CycleTimeline";
import { PageEmpty, PageError, PageLoading } from "@/components/PageState";
import { BoardGroup } from "@/components/board/BoardGroup";
import { BoardHeader } from "@/components/board/BoardHeader";
import { StatusCell } from "@/components/board/ColorCell";
import { PersonCell } from "@/components/board/PersonCell";
import { Button } from "@/components/ui/button";
import type { Cycle, Me, Part, Settings, Task, TeamEvent } from "@/lib/types";

export default function DashboardPage() {
  const { t } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [u, s, c, e, taskRes, partRes] = await Promise.all([
        api<{ user: Me | null }>("/api/auth/me"),
        api<Settings>("/api/settings"),
        api<{ cycles: Cycle[] }>("/api/cycles"),
        api<{ events: TeamEvent[] }>("/api/events"),
        api<{ tasks: Task[] }>("/api/tasks"),
        api<{ parts: Part[] }>("/api/parts"),
      ]);
      if (!u.user) {
        window.location.href = "/login";
        return;
      }
      setMe(u.user);
      setSettings(s);
      setCycles(c.cycles);
      setEvents(e.events);
      setTasks(taskRes.tasks);
      setParts(partRes.parts);
    })().catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <PageError message={t(error)} />;
  if (!cycles || !me || !settings) return <PageLoading label={t("載入中…")} />;

  const today = todayStr();
  const isTeacher = me.role === "teacher";
  // 老師看全隊；其他成員看自己參與的週期
  const mine = isTeacher
    ? cycles
    : cycles.filter(
        (c) => c.proposer_id === me.id || c.members.some((m) => m.id === me.id)
      );
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 4);
  const weekEnd = addDaysStr(today, 6);
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdue = openTasks.filter((task) => task.due_date && task.due_date < today);
  const dueWeek = openTasks.filter(
    (task) => task.due_date && task.due_date >= today && task.due_date <= weekEnd
  );
  const later = openTasks.filter((task) => !overdue.includes(task) && !dueWeek.includes(task));
  const statusOptions = STATUSES.map((item) => ({ value: item.key, label: item.label, color: item.color }));
  const pendingCycles = cycles.filter((c) => {
    if (me.role === "teacher") return c.status === "pending_leader" || c.status === "pending_teacher";
    if (me.role === "leader") return c.status === "pending_leader";
    return false;
  });
  const pendingParts = isStaff(me.role) ? parts.filter((p) => p.status === "pending") : [];

  let countdown: { label: string; days: number } | null = null;
  if (settings.competition_date) {
    const diff = daysBetween(today, settings.competition_date);
    countdown = {
      label:
        diff > 0 ? t("距離比賽還有") : diff === 0 ? t("比賽就是今天！") : t("比賽已結束"),
      days: Math.abs(diff),
    };
  }

  const buckets = [
    { title: t("逾期"), tasks: overdue, color: "#df2f4a" },
    { title: t("本週"), tasks: dueWeek, color: "#fdab3d" },
    { title: t("之後"), tasks: later, color: groupColor(0) },
  ];

  return (
    <div className="flex w-full flex-col">
      <BoardHeader title={t("首頁")} subtitle={settings.team_name} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NumberWidget
          label={countdown ? countdown.label : t("尚未設定比賽日期")}
          value={countdown ? String(countdown.days) : "—"}
          hint={
            countdown ? (
              <p className="text-xs text-muted-foreground">{fmtMD(settings.competition_date!)}（{weekdayCn(settings.competition_date!)}）</p>
            ) : isStaff(me.role) ? (
              <Button variant="link" className="h-auto px-0" nativeButton={false} render={<Link href="/admin" />}>{t("前往「管理」設定 →")}</Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("請隊長或老師於「管理」頁設定")}</p>
            )
          }
        />
        <NumberWidget label={t("逾期任務")} value={String(overdue.length)} />
        <NumberWidget label={t("本週到期")} value={String(dueWeek.length)} />
        <NumberWidget label={t("待你處理")} value={String(pendingCycles.length + pendingParts.length)} />
      </div>

      {isStaff(me.role) && (pendingCycles.length > 0 || pendingParts.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pendingCycles.map((c) => (
            <Link key={c.id} href="/cycles" className="rounded-[4px] bg-[#fdab3d] px-2 py-1 text-sm text-white">
              {t("待審週期")}：{c.title}
            </Link>
          ))}
          {pendingParts.map((p) => (
            <Link key={p.id} href="/parts" className="rounded-[4px] bg-[#fdab3d] px-2 py-1 text-sm text-white">
              {t("待審零件")}：{p.name}
            </Link>
          ))}
        </div>
      )}

      {buckets.map((bucket) => (
        <BoardGroup key={bucket.title} title={bucket.title} color={bucket.color} count={bucket.tasks.length}>
          {bucket.tasks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">{t("沒有任務")}</p>
          ) : (
            <table className="board-table">
              <thead>
                <tr>
                  <th>{t("任務")}</th>
                  <th>{t("負責人")}</th>
                  <th className="color-cell">{t("狀態")}</th>
                  <th>{t("截止日")}</th>
                </tr>
              </thead>
              <tbody>
                {bucket.tasks.slice(0, 8).map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link href="/work" className="hover:underline">{task.title}</Link>
                    </td>
                    <td><PersonCell name={task.assignee_name} /></td>
                    <td className="color-cell"><StatusCell value={task.status} options={statusOptions} /></td>
                    <td className="tabular-nums">{task.due_date ? fmtMD(task.due_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </BoardGroup>
      ))}

      <CycleTimeline cycles={cycles} today={today} />

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="group-title text-foreground">{isTeacher ? t("全隊週期進度") : t("我的開發週期進度")}</h2>
          <Button variant="link" nativeButton={false} render={<Link href="/cycles" />}>{t("開發週期")} →</Button>
        </div>
        <div className="flex flex-col gap-2">
          {mine.filter((c) => c.status === "active" || c.status === "approved" || c.status === "late").length === 0 ? (
            <PageEmpty>{t("目前沒有參與中的週期，到「開發週期」提案一個吧")}</PageEmpty>
          ) : (
            mine
              .filter((c) => c.status === "active" || c.status === "approved" || c.status === "late")
              .map((c) => {
                const pct = c.task_total > 0 ? Math.round((c.task_done / c.task_total) * 100) : 0;
                const left = daysBetween(today, c.end_date);
                return (
                  <Link key={c.id} href="/cycles" className="rounded-[8px] border border-border p-3 transition-colors hover:bg-muted">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex h-6 items-center px-2 text-xs ${cycleStatus(c.status).chip}`}>{cycleStatus(c.status).label}</span>
                      <span className="font-medium">{c.title}</span>
                      {isTeacher && c.proposer_name && <PersonCell name={c.proposer_name} />}
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {fmtMD(c.start_date)} – {fmtMD(c.end_date)}
                        {c.status === "active" && (
                          <span className="ml-2">
                            {left < 0 ? `${t("已超過結束日")} ${-left} ${t("天")}` : `${t("剩")} ${left} ${t("天")}`}
                          </span>
                        )}
                      </span>
                    </div>
                    {c.task_total > 0 && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="tabular-nums">{c.task_done}/{c.task_total}</span>
                      </div>
                    )}
                  </Link>
                );
              })
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="group-title text-foreground">{t("近期活動")}</h2>
          <Button variant="link" nativeButton={false} render={<Link href="/calendar" />}>{t("日曆 →")}</Button>
        </div>
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("沒有排定的活動")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-muted-foreground tabular-nums">
                    {fmtMD(e.date)}
                    {e.time && <span className="ml-1">{e.time}</span>}
                  </span>
                  <span className="truncate">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

function NumberWidget({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-medium tabular-nums text-foreground">{value}</p>
      {hint}
    </div>
  );
}
