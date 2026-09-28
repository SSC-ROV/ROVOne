"use client";

import { useMemo, useState } from "react";

export type CalEvent = {
  id: number; title: string; type: string; date: string;
  time: string | null; location: string | null;
};
export type CalTask = { title: string; cycle_title: string; due_date: string };

const TYPE_DOT: Record<string, string> = {
  meeting: "bg-primary-hover",
  watertest: "bg-sky-400",
  competition: "bg-rose-400",
  other: "bg-ink-subtle",
};

/** 香港時區今天 YYYY-MM-DD */
function hkToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

/** 月曆：圖像化顯示這個月每天的活動與任務截止；可切換上／下月 */
export default function MonthCalendar({
  events,
  tasks,
  today: todayProp,
}: {
  events: CalEvent[];
  tasks: CalTask[];
  today?: string;
}) {
  const [offset, setOffset] = useState(0);
  const today = todayProp ?? hkToday();

  const view = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + offset, 1);
  }, [offset]);

  const grid = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7; // 週一開頭
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: { date: string | null; day: number | null }[] = [];
    for (let i = 0; i < lead; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date, day: d });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
    return cells;
  }, [view]);

  const byDate = useMemo(() => {
    const map = new Map<string, { kind: "event" | "task"; dot: string; text: string; sub?: string }[]>();
    for (const e of events) {
      (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push({
        kind: "event", dot: TYPE_DOT[e.type] ?? TYPE_DOT.other, text: e.title,
        sub: e.time ? e.time.slice(0, 5) : undefined,
      });
    }
    for (const t of tasks) {
      (map.get(t.due_date) ?? map.set(t.due_date, []).get(t.due_date)!).push({
        kind: "task", dot: "bg-amber-400", text: t.title, sub: t.cycle_title,
      });
    }
    return map;
  }, [events, tasks]);

  const monthLabel = `${view.getFullYear()} 年 ${view.getMonth() + 1} 月`;
  const todayParts = today.split("-").map(Number);
  const isCurrentMonth =
    view.getFullYear() === todayParts[0] && view.getMonth() + 1 === todayParts[1];

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-3xl font-bold text-ink">本月日曆</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="h-10 w-10 rounded-lg border border-hairline-strong text-lg text-ink-muted transition hover:border-hairline-strong hover:text-ink"
            aria-label="上個月"
          >
            ‹
          </button>
          <span className="min-w-44 text-center text-2xl font-bold text-ink">{monthLabel}</span>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="h-10 w-10 rounded-lg border border-hairline-strong text-lg text-ink-muted transition hover:border-hairline-strong hover:text-ink"
            aria-label="下個月"
          >
            ›
          </button>
          {offset !== 0 && (
            <button
              onClick={() => setOffset(0)}
              className="h-10 rounded-lg border border-hairline-strong px-3 text-sm text-ink-muted transition hover:border-hairline-strong hover:text-ink"
            >
              本月
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
          <div key={w} className="pb-1 text-center text-base font-bold text-ink-subtle">
            週{w}
          </div>
        ))}
        {grid.map((cell, i) => {
          if (!cell.date) return <div key={i} className="min-h-20 rounded-lg bg-surface-1/40" />;
          const items = byDate.get(cell.date) ?? [];
          const isToday = cell.date === today;
          const dow = i % 7;
          const weekend = dow >= 5;
          return (
            <div
              key={i}
              className={`min-h-20 rounded-lg border p-1.5 ${
                isToday
                  ? "border-primary bg-primary/10"
                  : weekend
                    ? "border-hairline bg-surface-1"
                    : "border-hairline bg-surface-1/40"
              }`}
            >
              <div
                className={`mb-1 text-xl font-bold ${
                  isToday ? "text-[#2383a5]" : weekend ? "text-ink-tertiary" : "text-ink"
                }`}
              >
                {cell.day}
              </div>
              <div className="space-y-1">
                {items.slice(0, 2).map((it, k) => (
                  <div key={k} className="flex items-center gap-1.5 text-base font-semibold leading-tight text-ink">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${it.dot}`} />
                    <span className="truncate">{it.text}</span>
                  </div>
                ))}
                {items.length > 2 && (
                  <div className="text-sm text-ink-tertiary">+{items.length - 2} 更多</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-tertiary">
        <span className="mr-3"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary-hover align-middle" />例會</span>
        <span className="mr-3"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 align-middle" />水測</span>
        <span className="mr-3"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-400 align-middle" />比賽</span>
        <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />任務截止</span>
      </p>
    </section>
  );
}
