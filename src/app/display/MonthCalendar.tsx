"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** 香港時間今天（YYYY-MM-DD）；客戶端元件不可引入 DB 層 */
function hkToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

export type CalEvent = {
  id: number; title: string; type: string; date: string;
  time: string | null; location: string | null;
};
export type CalTask = { title: string; cycle_title: string; due_date: string };

const TYPE_DOT: Record<string, string> = {
  meeting: "bg-[#2eaadc]",
  watertest: "bg-sky-400",
  competition: "bg-[#a14545]",
  other: "bg-gray-400",
};

/** 月曆：圖像化顯示這個月每天的活動與任務截止；可切換上／下月（HUD 風格） */
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
  const { t, lang } = useI18n();
  const today = todayProp ?? hkToday();

  // 以北京時間的今天為基準（today 由伺服器提供，YYYY-MM-DD）
  const view = useMemo(() => {
    const base = todayProp ?? hkToday();
    const y = Number(base.slice(0, 4));
    const m = Number(base.slice(5, 7)) - 1;
    const d = new Date(Date.UTC(y, m + offset, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  }, [offset, todayProp]);

  const grid = useMemo(() => {
    const y = view.y;
    const m = view.m;
    const first = new Date(Date.UTC(y, m, 1));
    const lead = first.getUTCDay(); // 週日開頭
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
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
    const map = new Map<string, { kind: "event" | "task"; dot: string; text: string }[]>();
    for (const e of events) {
      (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push({
        kind: "event", dot: TYPE_DOT[e.type] ?? TYPE_DOT.other, text: e.title,
      });
    }
    for (const t of tasks) {
      (map.get(t.due_date) ?? map.set(t.due_date, []).get(t.due_date)!).push({
        kind: "task", dot: "bg-amber-400", text: t.title,
      });
    }
    return map;
  }, [events, tasks]);

  const monthLabel =
    lang === "en"
      ? new Date(Date.UTC(view.y, view.m, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) + ` ${view.y}`
      : `${view.y} 年 ${view.m + 1} 月`;
  const todayParts = today.split("-").map(Number);
  const isCurrentMonth =
    view.y === todayParts[0] && view.m + 1 === todayParts[1];

  return (
    <section className="b-panel rounded-lg p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="b-label">{t("本月日曆")}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="h-10 w-10 rounded-md border border-[rgba(0,212,255,0.35)] text-lg text-[#7defff] transition hover:bg-[rgba(0,212,255,0.1)]"
            aria-label={lang === "en" ? "Previous month" : t("上個月")}
          >
            ‹
          </button>
          <span className="tech min-w-44 text-center text-xl font-bold text-white">
            {lang === "en"
              ? new Date(Date.UTC(view.y, view.m, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) + ` ${view.y}`
              : `${view.y} 年 ${view.m + 1} 月`}
          </span>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="h-10 w-10 rounded-md border border-[rgba(0,212,255,0.35)] text-lg text-[#7defff] transition hover:bg-[rgba(0,212,255,0.1)]"
            aria-label={lang === "en" ? "Next month" : t("下個月")}
          >
            ›
          </button>
          {offset !== 0 && (
            <button
              onClick={() => setOffset(0)}
              className="h-10 rounded-md border border-[rgba(0,212,255,0.35)] px-3 text-sm text-[#7defff] transition hover:bg-[rgba(0,212,255,0.1)]"
            >
              {lang === "en" ? "NOW" : t("本月")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {(lang === "en"
          ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
          : ["週日", "週一", "週二", "週三", "週四", "週五", "週六"]
        ).map((w) => (
          <div key={w} className="b-label pb-1 text-center">{w}</div>
        ))}
        {grid.map((cell, i) => {
          if (!cell.date) return <div key={i} className="min-h-20 rounded-md border border-[rgba(0,212,255,0.06)]" />;
          const items = byDate.get(cell.date) ?? [];
          const isToday = cell.date === today;
          const dow = i % 7;
          const weekend = dow >= 5;
          return (
            <div
              key={i}
              className={`min-h-20 rounded-md border p-1.5 ${
                isToday
                  ? "b-today"
                  : weekend
                    ? "border-[rgba(0,212,255,0.12)] bg-[rgba(0,212,255,0.03)]"
                    : "border-[rgba(0,212,255,0.14)] bg-[rgba(3,12,24,0.6)]"
              }`}
            >
              <div
                className={`tech mb-1 text-base font-bold ${
                  isToday ? "text-[#7defff]" : weekend ? "text-[#3f6b80]" : "text-[#9fdcec]"
                }`}
              >
                {cell.day}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 2).map((it, k) => (
                  <div key={k} className="flex items-center gap-1 text-[13px] leading-tight text-[#c9ecf7]">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.dot}`} />
                    <span className="truncate" title={it.text}>{it.text}</span>
                  </div>
                ))}
                {items.length > 2 && (
                  <div className="text-[13px] text-[#4f7a8f]">+{items.length - 2} MORE</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] text-[#4f7a8f]">
        <span className="mr-3"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#2eaadc] align-middle" />{t("例會")}</span>
        <span className="mr-3"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 align-middle" />{t("水測")}</span>
        <span className="mr-3"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#a14545] align-middle" />{t("比賽")}</span>
        <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />{t("任務截止")}</span>
      </p>
    </section>
  );
}
