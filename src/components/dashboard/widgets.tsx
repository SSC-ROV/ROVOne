"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { tt } from "@/lib/i18n-core";
import { isStaff } from "@/lib/roles";
import { addDaysStr, daysBetween, fmtMD, parseDate, weekdayCn } from "@/lib/date";
import { STATUSES, cycleStatus, statusLabel } from "@/lib/ui";
import { Label, StatusIcon } from "@/components/board/ColorCell";
import { PeopleCell, PersonCell } from "@/components/board/PersonCell";
import type { Cycle, Me, Part, Settings, Task, TeamEvent } from "@/lib/types";
import type { WidgetConfig, WidgetSize } from "@/lib/dashboard/catalog";
import {
  burnUp,
  byDue,
  deadlinesByDay,
  deadlinesPerWeek,
  filterTasks,
  groupTasks,
  health,
  membersNeedingHelp,
  startDate,
  summary,
  thisWeek,
  weekStart,
  type Health,
} from "@/lib/dashboard/metrics";
import CycleTimeline from "@/components/CycleTimeline";
import { Donut, Lines, StackedBars, type Series } from "./charts";

export interface DashData {
  me: Me;
  settings: Settings;
  cycles: Cycle[];
  events: TeamEvent[];
  tasks: Task[];
  parts: Part[];
  today: string;
  subteamLabel: (key: string) => string;
}

export const HEALTH_META: Record<Health, { zh: string; en: string; color: string }> = {
  overdue: { zh: "逾期", en: "Overdue", color: "var(--c-red)" },
  blocked: { zh: "卡住", en: "Blocked", color: "var(--c-orange)" },
  behind: { zh: "落後", en: "Behind", color: "var(--c-orange)" },
  soon: { zh: "即將到期", en: "Due soon", color: "var(--c-yellow)" },
  ontrack: { zh: "正常", en: "On track", color: "var(--c-green)" },
  done: { zh: "已完成", en: "Done", color: "var(--c-purple)" },
  nodate: { zh: "無截止日", en: "No date", color: "var(--c-gray)" },
};

/** Categorical series colours (validated for colour-blind separation); the rest fold into "Other". */
const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const OTHER_COLOR = "var(--c-gray)";

function HealthLabel({ value }: { value: Health }) {
  const m = HEALTH_META[value];
  return <Label color={m.color}>{tt(m.zh, m.en)}</Label>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="flex h-full items-center justify-center px-2 text-center text-sm text-muted-foreground">{children}</p>;
}

// ---------- Number tiles ----------

function NumberTile({
  value,
  hint,
  tone,
  size,
  bar,
}: {
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
  size: WidgetSize;
  /** 0–100, shown as a thin bar under the number. */
  bar?: number;
}) {
  return (
    <div className="flex h-full flex-col justify-between">
      <p className={`font-medium tabular-nums leading-none ${size === "s" ? "text-4xl" : "text-5xl"}`} style={{ color: tone ?? "var(--foreground)" }}>
        {value}
      </p>
      <div className="flex flex-col gap-1.5">
        {bar != null && (
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={bar} aria-valuemin={0} aria-valuemax={100}>
            <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${bar}%`, background: "var(--c-purple)" }} />
          </span>
        )}
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );
}

// ---------- Task tables ----------

type Col = "due" | "task" | "subteam" | "lead" | "status" | "health" | "late";

function TaskTable({ tasks, cols, today, data, limit = 50 }: { tasks: Task[]; cols: Col[]; today: string; data: DashData; limit?: number }) {
  const head: Record<Col, string> = {
    due: tt("截止", "Due"),
    task: tt("任務", "Task"),
    subteam: tt("組別", "Subteam"),
    lead: tt("負責人", "Lead"),
    status: tt("狀態", "Status"),
    health: tt("健康度", "Health"),
    late: tt("逾期", "Days late"),
  };
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead className="sticky top-0 z-[1] bg-card">
        <tr className="text-left text-xs text-muted-foreground">
          {cols.map((c) => (
            <th key={c} className={`border-b border-border px-2 py-1.5 font-semibold ${c === "task" ? "" : "whitespace-nowrap"}`}>{head[c]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tasks.slice(0, limit).map((t) => (
          <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-muted/60">
            {cols.map((c) => (
              <td key={c} className={`px-2 py-1.5 align-middle ${c === "task" ? "min-w-40" : "whitespace-nowrap"}`}>
                {c === "due" && <span className="tabular-nums">{t.due_date ? `${weekdayCn(t.due_date)} ${fmtMD(t.due_date)}` : "—"}</span>}
                {c === "task" && (
                  <Link href={`/tasks?task=${t.id}`} className="inline-flex items-start gap-1.5 hover:underline">
                    <StatusIcon status={t.status} size={14} className="mt-0.5" />
                    <span className="line-clamp-2">{t.title}</span>
                  </Link>
                )}
                {c === "subteam" && <span className="text-muted-foreground">{data.subteamLabel(t.subteam)}</span>}
                {c === "lead" && <PeopleCell names={(t.assignees ?? []).map((p) => p.display_name)} value={t.assignee_ids ?? []} />}
                {c === "status" && <Label color={STATUSES.find((s) => s.key === t.status)?.color ?? "var(--c-gray)"}>{statusLabel(t.status)}</Label>}
                {c === "health" && <HealthLabel value={health(t, today)} />}
                {c === "late" && t.due_date && (
                  <span className="font-medium tabular-nums" style={{ color: "var(--c-red)" }}>{daysBetween(t.due_date, today)}{tt("天", "d")}</span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Columns that fit each widget size. */
function colsFor(size: WidgetSize, wide: Col[], medium: Col[]): Col[] {
  return size === "xl" ? wide : medium;
}

// ---------- Breakdown tables ----------

function Bar({ pct, color = "var(--c-purple)" }: { pct: number; color?: string }) {
  return (
    <span className="block h-1.5 w-full min-w-12 overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </span>
  );
}

function BreakdownTable({ rows, cols, size }: { rows: { label: string; cells: ReactNode[]; bar: number }[]; cols: string[]; size: WidgetSize }) {
  const showBar = size !== "m";
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead className="sticky top-0 z-[1] bg-card">
        <tr className="text-left text-xs text-muted-foreground">
          <th className="border-b border-border px-2 py-1.5 font-semibold">{tt("名稱", "Name")}</th>
          {showBar && <th className="w-1/4 border-b border-border px-2 py-1.5 font-semibold">{tt("進度", "Progress")}</th>}
          {cols.map((c) => (
            <th key={c} className="whitespace-nowrap border-b border-border px-2 py-1.5 text-right font-semibold">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.label + i} className={`border-b border-border/60 last:border-0 ${i === rows.length - 1 ? "bg-muted/50 font-medium" : ""}`}>
            <td className="max-w-40 truncate px-2 py-1.5" title={r.label}>{r.label}</td>
            {showBar && <td className="px-2 py-1.5"><Bar pct={r.bar} /></td>}
            {r.cells.map((c, k) => (
              <td key={k} className="px-2 py-1.5 text-right tabular-nums">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const redIf = (n: number) => (n > 0 ? <span style={{ color: "var(--c-red)" }} className="font-medium">{n}</span> : n);

// ---------- Widget body ----------

export function WidgetBody({ widget, data }: { widget: WidgetConfig; data: DashData }) {
  const { me, today } = data;
  const s = widget.settings;
  const size = widget.size;
  const tasks = filterTasks(data.tasks, s, me.id);
  const sum = summary(tasks, today);
  const week = thisWeek(today);
  const groupBy = s.groupBy ?? "subteam";
  const groups = () => groupTasks(tasks, groupBy, data.subteamLabel, tt("未指派", "Unassigned"));

  switch (widget.type) {
    case "week-banner": {
      const locale = tt("zh-TW", "en-GB");
      const long = (d: string) => parseDate(d).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      const short = (d: string) => parseDate(d).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
      // Week 1 is the week the season's first task starts in.
      const firsts = tasks.flatMap((t) => [startDate(t), t.due_date]).filter((d): d is string => !!d);
      const seasonStart = firsts.length ? weekStart(firsts.reduce((a, b) => (a < b ? a : b))) : week.start;
      const wk = Math.floor(daysBetween(seasonStart, week.start) / 7) + 1;
      const items = [
        { k: tt("今天", "Today"), v: long(today) },
        { k: tt("本週", "This week"), v: `${tt(`第 ${wk} 週`, `Wk ${wk}`)}: ${short(week.start)} – ${short(week.end)}` },
        { k: tt("每週開始", "Week starts"), v: long(week.start) },
      ];
      return (
        <div className="flex h-full flex-col justify-between gap-3">
          <dl className={`grid gap-x-8 gap-y-2 ${size === "s" ? "grid-cols-1" : "sm:grid-cols-3"}`}>
            {(size === "s" ? items.slice(0, 2) : items).map((it) => (
              <div key={it.k} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{it.k}</dt>
                <dd className={`truncate font-medium tabular-nums ${size === "s" ? "text-sm" : "text-lg"}`}>{it.v}</dd>
              </div>
            ))}
          </dl>
          {size !== "s" && (
            <p className="text-xs italic text-muted-foreground">
              {tt("本週即時概況；所有數字都來自任務頁。", "Live view of this week. Everything here updates from the Tasks page.")}
            </p>
          )}
        </div>
      );
    }

    case "overall-progress":
      return <NumberTile size={size} value={`${sum.pct}%`} bar={sum.pct} hint={tt(`${sum.total} 個任務完成 ${sum.done} 個`, `${sum.done} of ${sum.total} tasks done`)} />;

    case "week-deadlines": {
      const pct = sum.dueWeek ? Math.round((sum.dueWeekDone / sum.dueWeek) * 100) : 0;
      return (
        <NumberTile
          size={size}
          value={`${sum.dueWeekDone} / ${sum.dueWeek}`}
          tone={sum.dueWeek && sum.dueWeekDone < sum.dueWeek ? "var(--c-yellow)" : undefined}
          hint={sum.dueWeek ? tt(`完成 ${pct}%，本週完成 ${sum.finishedThisWeek} 個`, `${pct}% done, ${sum.finishedThisWeek} finished this week`) : tt("本週沒有截止", "No deadlines this week")}
        />
      );
    }

    case "overdue-count":
      return <NumberTile size={size} value={sum.overdue} tone={sum.overdue ? "var(--c-red)" : undefined} hint={tt("已過截止日但未完成", "Past the due date, not done")} />;

    case "due-week-count":
      return <NumberTile size={size} value={sum.dueNext7} tone={sum.dueNext7 ? "var(--c-yellow)" : undefined} hint={tt("今天起七天內", "In the next 7 days")} />;

    case "behind-count":
      return <NumberTile size={size} value={sum.behind} tone={sum.behind ? "var(--c-orange)" : undefined} hint={tt("未開始，時間已過一半", "Not started, over half the time used")} />;

    case "ahead-behind": {
      const v = sum.aheadBehind;
      return (
        <NumberTile
          size={size}
          value={v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0"}
          tone={v > 0 ? "var(--c-green)" : v < 0 ? "var(--c-red)" : undefined}
          hint={tt("已完成數減去至今應完成數", "Tasks done minus tasks due so far")}
        />
      );
    }

    case "blocked-count":
      return <NumberTile size={size} value={sum.blocked} tone={sum.blocked ? "var(--c-orange)" : undefined} hint={tt("在等其他事情", "Waiting on something")} />;

    case "countdown": {
      const date = data.settings.competition_date;
      if (!date) {
        return (
          <NumberTile
            size={size}
            value="—"
            hint={isStaff(me.role) ? <Link href="/admin" className="text-[var(--c-blue)] hover:underline">{tt("到「團隊設定」設定比賽日期 →", "Set the date in Team settings →")}</Link> : tt("尚未設定比賽日期", "No competition date yet")}
          />
        );
      }
      const diff = daysBetween(today, date);
      return (
        <NumberTile
          size={size}
          value={Math.abs(diff)}
          hint={`${diff > 0 ? tt("天後比賽", "days to go") : diff === 0 ? tt("比賽就是今天！", "It's today!") : tt("天前已結束", "days since")} · ${fmtMD(date)}（${weekdayCn(date)}）`}
        />
      );
    }

    case "waiting-for-you": {
      const pendingCycles = data.cycles.filter((c) =>
        me.role === "teacher" ? c.status === "pending_leader" || c.status === "pending_teacher" : me.role === "leader" ? c.status === "pending_leader" : false
      );
      const pendingParts = isStaff(me.role) ? data.parts.filter((p) => p.status === "pending") : [];
      const n = pendingCycles.length + pendingParts.length;
      if (size === "l") {
        return n === 0 ? (
          <Empty>{tt("沒有需要你處理的事", "Nothing waiting for you")}</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {pendingCycles.map((c) => (
              <li key={`c${c.id}`}><Link href="/cycles" className="flex gap-2 hover:underline"><Label color="var(--c-yellow)">{tt("專案", "Project")}</Label><span className="truncate">{c.title}</span></Link></li>
            ))}
            {pendingParts.map((p) => (
              <li key={`p${p.id}`}><Link href="/parts" className="flex gap-2 hover:underline"><Label color="var(--c-yellow)">{tt("零件", "Part")}</Label><span className="truncate">{p.name}</span></Link></li>
            ))}
          </ul>
        );
      }
      return <NumberTile size={size} value={n} tone={n ? "var(--c-yellow)" : undefined} hint={n ? <Link href={pendingParts.length ? "/parts" : "/cycles"} className="text-[var(--c-blue)] hover:underline">{tt("前往審批 →", "Review →")}</Link> : tt("沒有待審項目", "Nothing to approve")} />;
    }

    case "task-buckets": {
      const open = tasks.filter((t) => t.status !== "done").sort(byDue);
      const weekEnd = addDaysStr(today, 6);
      const overdue = open.filter((t) => t.due_date && t.due_date < today);
      const dueWeek = open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd);
      const later = open.filter((t) => !overdue.includes(t) && !dueWeek.includes(t));
      const buckets = [
        { title: tt("逾期", "Overdue"), tasks: overdue, color: "var(--c-red)" },
        { title: tt("本週", "This week"), tasks: dueWeek, color: "var(--c-yellow)" },
        { title: tt("之後", "Later"), tasks: later, color: "var(--c-blue)" },
      ];
      return (
        <div className="flex flex-col gap-3">
          {buckets.map((b) => (
            <section key={b.title}>
              <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: b.color }} />
                {b.title}
                <span className="rounded-full bg-muted px-1.5 tabular-nums">{b.tasks.length}</span>
              </h3>
              {b.tasks.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">{tt("沒有任務", "No tasks")}</p>
              ) : (
                <TaskTable tasks={b.tasks} cols={colsFor(size, ["task", "lead", "status", "due"], ["task", "lead", "due"])} today={today} data={data} limit={8} />
              )}
            </section>
          ))}
        </div>
      );
    }

    case "week-deadlines-table": {
      const list = tasks.filter((t) => t.due_date && t.due_date >= week.start && t.due_date <= week.end).sort(byDue);
      if (list.length === 0) return <Empty>{tt("本週沒有截止的任務", "No deadlines this week")}</Empty>;
      return <TaskTable tasks={list} cols={colsFor(size, ["due", "task", "subteam", "lead", "status", "health"], ["due", "task", "health"])} today={today} data={data} />;
    }

    case "overdue-table": {
      const list = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).sort(byDue);
      if (list.length === 0) return <Empty>{tt("沒有逾期任務", "Nothing overdue")}</Empty>;
      return <TaskTable tasks={list} cols={colsFor(size, ["due", "late", "task", "subteam", "lead"], ["late", "task", "lead"])} today={today} data={data} />;
    }

    case "next-two-weeks": {
      const from = addDaysStr(week.end, 1);
      const to = addDaysStr(week.end, 14);
      const list = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date >= from && t.due_date <= to).sort(byDue);
      if (list.length === 0) return <Empty>{tt("未來兩週沒有截止", "No deadlines in the next two weeks")}</Empty>;
      return <TaskTable tasks={list} cols={colsFor(size, ["due", "task", "subteam", "lead", "status", "health"], ["due", "task", "health"])} today={today} data={data} />;
    }

    case "season-progress": {
      const gs = groups();
      if (tasks.length === 0) return <Empty>{tt("沒有任務", "No tasks")}</Empty>;
      const row = (label: string, ts: Task[]) => {
        const m = summary(ts, today);
        return { label, bar: m.pct, cells: [m.done, m.total, `${m.pct}%`, redIf(m.overdue)] };
      };
      return (
        <BreakdownTable
          size={size}
          cols={[tt("完成", "Done"), tt("任務", "Tasks"), tt("完成率", "% done"), tt("逾期", "Overdue")]}
          rows={[...gs.map((g) => row(g.label, g.tasks)), row(tt("合計", "Total"), tasks)]}
        />
      );
    }

    case "week-progress": {
      const gs = groups();
      if (tasks.length === 0) return <Empty>{tt("沒有任務", "No tasks")}</Empty>;
      const row = (label: string, ts: Task[]) => {
        const m = summary(ts, today);
        return {
          label,
          bar: m.dueWeek ? (m.dueWeekDone / m.dueWeek) * 100 : 0,
          cells: [m.dueWeek, m.dueWeekDone, m.finishedThisWeek],
        };
      };
      return (
        <BreakdownTable
          size={size}
          cols={[tt("本週到期", "Due"), tt("完成", "Done"), tt("本週完成", "Finished")]}
          rows={[...gs.map((g) => row(g.label, g.tasks)), row(tt("合計", "Total"), tasks)]}
        />
      );
    }

    case "members-need-help": {
      const people = membersNeedingHelp(tasks, today, data.subteamLabel);
      if (people.length === 0) return <Empty>{tt("大家都跟上進度了", "Everyone is on track")}</Empty>;
      return (
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-[1] bg-card">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="border-b border-border px-2 py-1.5 font-semibold">{tt("成員", "Name")}</th>
              <th className="border-b border-border px-2 py-1.5 text-right font-semibold">{tt("逾期", "Overdue")}</th>
              <th className="border-b border-border px-2 py-1.5 text-right font-semibold">{tt("落後", "Behind")}</th>
              {size !== "m" && <th className="border-b border-border px-2 py-1.5 font-semibold">{tt("組別", "Subteam")}</th>}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-2 py-1.5"><PersonCell name={p.name} /></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{redIf(p.overdue)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{p.behind > 0 ? <span className="font-medium" style={{ color: "var(--c-orange)" }}>{p.behind}</span> : 0}</td>
                {size !== "m" && <td className="px-2 py-1.5 text-muted-foreground">{p.subteams}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    case "project-timeline":
      return <CycleTimeline cycles={data.cycles} today={today} bare />;

    case "project-progress": {
      const isTeacher = me.role === "teacher";
      const mine = (isTeacher ? data.cycles : data.cycles.filter((c) => c.proposer_id === me.id || c.members.some((m) => m.id === me.id))).filter(
        (c) => c.status === "active" || c.status === "approved" || c.status === "late"
      );
      if (mine.length === 0) return <Empty>{tt("目前沒有參與中的專案", "You're not in any active project")}</Empty>;
      return (
        <ul className="flex flex-col gap-2">
          {mine.map((c) => {
            const pct = c.task_total > 0 ? Math.round((c.task_done / c.task_total) * 100) : 0;
            const left = daysBetween(today, c.end_date);
            return (
              <li key={c.id}>
                <Link href="/cycles" className="block rounded-[6px] border border-border px-2.5 py-2 transition-colors hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <Label color={cycleStatus(c.status).color}>{cycleStatus(c.status).label}</Label>
                    <span className="truncate text-sm font-medium">{c.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                      {left < 0 ? tt(`超過 ${-left} 天`, `${-left}d over`) : tt(`剩 ${left} 天`, `${left}d left`)}
                    </span>
                  </div>
                  {c.task_total > 0 && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Bar pct={pct} />
                      <span className="tabular-nums">{c.task_done}/{c.task_total}</span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      );
    }

    case "upcoming-events": {
      const list = data.events
        .filter((e) => e.date >= today && (!s.subteam || e.subteam == null || e.subteam === s.subteam))
        .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))
        .slice(0, size === "l" ? 8 : 3);
      if (list.length === 0) return <Empty>{tt("沒有排定的活動", "No upcoming events")}</Empty>;
      return (
        <ul className="flex flex-col gap-1.5">
          {list.map((e) => (
            <li key={e.id}>
              <Link href="/calendar" className="flex items-center gap-3 rounded-[6px] border border-border px-2.5 py-1.5 text-sm hover:bg-muted">
                <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {weekdayCn(e.date)} {fmtMD(e.date)}
                  {e.time && <span className="ml-1">{e.time}</span>}
                </span>
                <span className="truncate">{e.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
    }

    case "task-health": {
      const counts: Record<string, number> = {};
      for (const t of tasks) {
        const h = health(t, today);
        const k = h === "blocked" ? "behind" : h;
        counts[k] = (counts[k] ?? 0) + 1;
      }
      const keys: Health[] = ["overdue", "behind", "soon", "ontrack", "done", "nodate"];
      return (
        <Donut
          centerLabel={tt("任務", "tasks")}
          slices={keys.map((k) => ({
            key: k,
            label: k === "behind" ? tt("落後或卡住", "Behind or blocked") : tt(HEALTH_META[k].zh, HEALTH_META[k].en),
            color: HEALTH_META[k].color,
            value: counts[k] ?? 0,
          }))}
        />
      );
    }

    case "deadlines-by-day": {
      const days = deadlinesByDay(tasks, today);
      const series: Series[] = [
        { key: "missed", label: tt("錯過", "Missed"), color: "var(--c-red)" },
        { key: "open", label: tt("未完成", "Still open"), color: "var(--c-blue)" },
        { key: "done", label: tt("完成", "Done"), color: "var(--c-purple)" },
      ];
      return (
        <StackedBars
          categories={days.map((d) => (size === "m" ? weekdayCn(d.day) : `${weekdayCn(d.day)} ${fmtMD(d.day)}`))}
          tooltipTitle={(i) => `${weekdayCn(days[i].day)} ${fmtMD(days[i].day)}`}
          series={series}
          values={days.map((d) => ({ missed: d.missed, open: d.open, done: d.done }))}
        />
      );
    }

    case "burn-up": {
      const pts = burnUp(tasks, today);
      if (pts.length === 0) return <Empty>{tt("沒有有截止日的任務", "No tasks with a due date")}</Empty>;
      const ticks = pts
        .map((p, i) => ({ index: i, day: p.day }))
        .filter((p) => p.day.endsWith("-01") || p.index === 0)
        .map((p) => ({ index: p.index, text: fmtMD(p.day) }));
      return (
        <Lines
          labels={pts.map((p) => `${weekdayCn(p.day)} ${fmtMD(p.day)}`)}
          tickLabels={ticks}
          series={[
            { key: "planned", label: tt("應完成（截止日）", "Planned (due by then)"), color: "var(--c-gray)", dashed: true },
            { key: "done", label: tt("實際完成", "Done"), color: "var(--c-purple)" },
          ]}
          values={{ planned: pts.map((p) => p.planned), done: pts.map((p) => p.done) }}
        />
      );
    }

    case "deadlines-per-week": {
      const gs = groups();
      const top = gs.slice(0, gs.length > SERIES_COLORS.length ? SERIES_COLORS.length - 1 : SERIES_COLORS.length);
      const rest = gs.slice(top.length);
      const series: Series[] = top.map((g, i) => ({ key: g.key, label: g.label, color: SERIES_COLORS[i] }));
      if (rest.length) series.push({ key: "__other", label: tt("其他", "Other"), color: OTHER_COLOR });
      const weeks = deadlinesPerWeek(gs);
      if (weeks.length === 0) return <Empty>{tt("沒有有截止日的任務", "No tasks with a due date")}</Empty>;
      const thisMon = weekStart(today);
      return (
        <StackedBars
          categories={weeks.map((w) => fmtMD(w.week))}
          tooltipTitle={(i) => `${tt("週一", "Week of")} ${fmtMD(weeks[i].week)}${weeks[i].week === thisMon ? tt("（本週）", " (this week)") : ""}`}
          series={series}
          values={weeks.map((w) => {
            const v: Record<string, number> = {};
            for (const g of top) v[g.key] = w.counts.get(g.key) ?? 0;
            if (rest.length) v.__other = rest.reduce((a, g) => a + (w.counts.get(g.key) ?? 0), 0);
            return v;
          })}
        />
      );
    }
  }
  return <Empty>{tt("未知的元件", "Unknown widget")}</Empty>;
}
