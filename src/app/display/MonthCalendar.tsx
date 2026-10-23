"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type CalEvent = {
  id: number; title: string; type: string; date: string;
  time: string | null; location: string | null;
};
export type CalTask = { title: string; cycle_title: string; due_date: string };

const EV: Record<string, { color: string; label: string }> = {
  meeting: { color: "var(--b-accent)", label: "Meeting" },
  watertest: { color: "var(--b-green)", label: "Water test" },
  competition: { color: "var(--b-red)", label: "Competition" },
  other: { color: "var(--b-violet)", label: "Event" },
};

/** 週日開頭的月曆格（UTC 運算，不受裝置時區影響） */
function buildGrid(y: number, m: number): (string | null)[] {
  const lead = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function MonthCalendar({
  events,
  tasks,
  today,
}: {
  events: CalEvent[];
  tasks: CalTask[];
  today: string;
}) {
  const { lang } = useI18n();
  const [offset, setOffset] = useState(0);

  const base = useMemo(() => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7)) - 1;
    const d = new Date(Date.UTC(y, m + offset, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  }, [offset, today]);

  const cells = useMemo(() => buildGrid(base.y, base.m), [base]);
  const rows = Math.ceil(cells.length / 7);
  const monthKey = `${base.y}-${String(base.m + 1).padStart(2, "0")}`;
  const monthTitle = new Date(Date.UTC(base.y, base.m, 1)).toLocaleString("en-US", {
    month: "long", timeZone: "UTC",
  });

  const byDate = useMemo(() => {
    const map = new Map<string, { color: string; title: string }[]>();
    for (const e of events) {
      if (!e.date.startsWith(monthKey)) continue;
      (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push({
        color: (EV[e.type] ?? EV.other).color, title: e.title,
      });
    }
    for (const t of tasks) {
      if (!t.due_date.startsWith(monthKey)) continue;
      (map.get(t.due_date) ?? map.set(t.due_date, []).get(t.due_date)!).push({
        color: "var(--b-amber)", title: t.title,
      });
    }
    return map;
  }, [events, tasks, monthKey]);

  return (
    <section className="flex h-full flex-col rounded-lg p-5" style={{ background: "var(--b-surface)", border: "1px solid var(--b-line)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-[26px] leading-tight text-[var(--b-text)]">
          {monthTitle}{" "}
          <span className="text-[var(--b-text-3)]">{base.y}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--b-text-2)] transition-colors duration-150 hover:bg-[var(--b-surface-2)]"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--b-text-2)] transition-colors duration-150 hover:bg-[var(--b-surface-2)]"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {/* 星期表頭：獨立矮行，不佔資料列高 */}
      <div className="grid grid-cols-7">
        {(lang === "en"
          ? ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
          : ["週日", "週一", "週二", "週三", "週四", "週五", "週六"]
        ).map((w) => (
          <div key={w} className="b-eyebrow pb-1 text-center">{w}</div>
        ))}
      </div>

      {/* 滿版格線月曆：gap-px + 底色 = 髮絲格線，列高自動撐滿可用高度 */}
      <div
        className="grid flex-1 grid-cols-7 gap-px"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(64px, 1fr))`, background: "var(--b-line)" }}
      >
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="bg-[var(--b-surface)]" />;
          const items = byDate.get(date) ?? [];
          const isToday = date === today;
          const dow = i % 7;
          const weekend = dow >= 5;
          return (
            <div
              key={i}
              className={`min-h-16 p-1.5 ${
                isToday
                  ? "b-today"
                  : weekend
                    ? "bg-[color-mix(in_srgb,var(--b-accent)_4%,var(--b-surface))]"
                    : "bg-[var(--b-surface)]"
              }`}
            >
              <div
                className={`text-[15px] leading-tight ${
                  isToday ? "font-medium text-[var(--b-accent)]" : weekend ? "text-[var(--b-text-3)]" : "text-[var(--b-text)]"
                }`}
              >
                {Number(date.slice(8, 10))}
              </div>
              <div className="mt-0.5 space-y-0.5">
                {items.slice(0, 2).map((it, k) => (
                  <div key={k} className="flex items-center gap-1 text-[12.5px] leading-tight text-[var(--b-text)]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.color }} />
                    <span className="truncate" title={it.title}>{it.title}</span>
                  </div>
                ))}
                {items.length > 2 && (
                  <div className="text-[12.5px] text-[var(--b-text-3)]">+{items.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[13px] text-[var(--b-text-3)]">
        <span className="mr-3"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#2eaadc] align-middle" />Meeting</span>
        <span className="mr-3"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 align-middle" />Water test</span>
        <span className="mr-3"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#a14545] align-middle" />Competition</span>
        <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />Deadline</span>
      </p>
    </section>
  );
}
