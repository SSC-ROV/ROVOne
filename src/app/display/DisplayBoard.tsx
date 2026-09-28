"use client";

import { useEffect, useState } from "react";
import Clock from "./Clock";
import MonthCalendar, { type CalEvent, type CalTask } from "./MonthCalendar";
import type { BoardData } from "@/lib/board";

const TYPE_DOT: Record<string, string> = {
  meeting: "bg-[#2eaadc]",
  watertest: "bg-sky-400",
  competition: "bg-[#eb5757]",
  other: "bg-gray-400",
};

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(b + "T00:00:00+08:00") - Date.parse(a + "T00:00:00+08:00")) / 86400000
  );
}

function weekdayZh(dateStr: string): string {
  return new Date(dateStr + "T00:00:00+08:00").toLocaleDateString("zh-TW", {
    weekday: "short",
    timeZone: "Asia/Hong_Kong",
  });
}

/** 全屏按鈕（Raspberry Pi／PC 上也可直接用瀏覽器 --kiosk 參數） */
function FullscreenButton() {
  return (
    <button
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }}
      title="全屏"
      aria-label="全屏"
      className="h-12 w-12 rounded-lg border border-hairline-strong text-xl text-ink-subtle transition hover:border-hairline-strong hover:text-ink"
    >
      ⛶
    </button>
  );
}

/**
 * 看板本體：左＝月曆（固定常駐），右＝週期列表（獨立捲動，再多也不會擠走日曆）。
 * 資料以 fetch 輪詢更新（純 DOM 差異更新，永不整頁刷新＝零閃黑）。
 */
export default function DisplayBoard({
  token,
  initial,
}: {
  token: string;
  initial: BoardData;
}) {
  const [data, setData] = useState<BoardData>(initial);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/display?token=${token}`, { cache: "no-store" });
        if (r.ok && alive) setData(await r.json());
      } catch {
        /* 網路抖動時保留舊畫面 */
      }
    };
    const id = setInterval(poll, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  const today = data.today;

  // 日程按日期分組（未來兩週重點）
  const agenda = new Map<string, typeof data.events>();
  for (const e of data.events) {
    if (e.date >= today && daysBetween(today, e.date) <= 14) {
      (agenda.get(e.date) ?? agenda.set(e.date, []).get(e.date)!).push(e);
    }
  }

  const late = data.cycles.filter((c) => c.status === "late");
  const active = data.cycles.filter((c) => c.status === "active");
  const upcoming = data.cycles.filter((c) => c.status === "approved");

  const compDays =
    data.competitionDate && data.competitionDate >= today
      ? daysBetween(today, data.competitionDate)
      : null;

  const cycleCard = (c: (typeof data.cycles)[number]) => {
    const totalDays = Math.max(1, daysBetween(c.start_date, c.end_date));
    const elapsed = Math.min(totalDays, Math.max(0, daysBetween(c.start_date, today)));
    const pct = Math.round((elapsed / totalDays) * 100);
    const barColor =
      c.status === "late" ? "bg-rose-400" : c.status === "active" ? "bg-emerald-400" : "bg-sky-400";
    const chip =
      c.status === "late"
        ? "bg-red-50 text-[#eb5757]"
        : c.status === "active"
          ? "bg-green-50 text-[#0f7b6c]"
          : "bg-blue-50 text-[#2383a5]";
    const chipLabel =
      c.status === "late" ? "遲交" : c.status === "active" ? "進行中" : "即將開始";
    const left = daysBetween(today, c.end_date);
    return (
      <div key={c.id} className="rounded-xl border border-hairline bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-3xl font-bold text-ink">{c.title}</h3>
          <span className={`shrink-0 rounded-md px-4 py-1.5 text-lg font-bold ${chip}`}>
            {chipLabel}
          </span>
        </div>
        <p className="mt-2 text-lg font-medium text-ink-subtle">
          {c.start_date} ~ {c.end_date}
          {c.status !== "approved" && (
            <span className="ml-4 text-xl font-bold text-ink">
              {c.status === "late" ? "已超時" : `剩餘 ${left} 日`}
            </span>
          )}
          {c.status === "approved" && (
            <span className="ml-4 text-xl font-bold text-[#2383a5]">
              {daysBetween(today, c.start_date)} 日後開始
            </span>
          )}
        </p>
        <div className="mt-3 h-3.5 overflow-hidden rounded-lg bg-surface-2">
          <div className={`h-full rounded-lg ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-lg text-ink-subtle">
          <span>
            任務進度{" "}
            <span className="text-2xl font-bold text-ink">
              {c.done}/{c.total}
            </span>
          </span>
          {c.members.length > 0 && (
            <span className="truncate text-base">成員：{c.members.join("、")}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-canvas px-8 py-6 text-ink">
      {/* 頂部：隊名＋比賽倒數｜大時鐘（固定常駐） */}
      <header className="flex shrink-0 items-end justify-between gap-6">
        <div>
          <h1 className="text-6xl font-black tracking-tight text-ink">
            {data.teamName}
          </h1>
          <p className="mt-1 text-lg text-ink-subtle">團隊看板 · 每分鐘自動更新</p>
          {compDays !== null && (
            <p className="mt-2 inline-block rounded-md bg-red-50 px-5 py-1.5 text-2xl font-bold text-[#eb5757]">
              距比賽 {compDays} 日
            </p>
          )}
        </div>
        <div className="flex items-end gap-4">
          <FullscreenButton />
          <Clock />
        </div>
      </header>

      {/* 主區：左＝月曆＋兩週重點（常駐），右＝週期列表（獨立捲動）；窄螢幕退回上下堆疊 */}
      <div className="mt-6 grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[46fr_54fr] xl:overflow-hidden">
        {/* 左：月曆＋兩週重點 */}
        <div className="min-h-0 space-y-6 xl:overflow-y-auto xl:pr-1">
          <MonthCalendar events={data.events} tasks={data.tasksDue} today={data.today} />

          {agenda.size > 0 && (
            <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm">
              <h2 className="text-3xl font-bold text-ink">未來兩週重點</h2>
              <div className="mt-4 space-y-3">
                {[...agenda.entries()].map(([date, items]) => (
                  <div
                    key={date}
                    className={`flex items-baseline gap-3 ${
                      date === today ? "text-[#2383a5]" : "text-ink"
                    }`}
                  >
                    <span className="w-16 shrink-0 text-2xl font-bold">
                      {Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}
                    </span>
                    <span className="w-12 shrink-0 text-base text-ink-subtle">{weekdayZh(date)}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                      {items.map((e) => (
                        <span
                          key={e.id}
                          className="flex items-center gap-2 text-xl font-semibold"
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT[e.type] ?? TYPE_DOT.other}`} />
                          {e.title}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 右：週期列表（獨立捲動） */}
        <div className="min-h-0 space-y-5 xl:overflow-y-auto xl:pl-1">
          {late.length > 0 && (
            <>
              <h2 className="text-3xl font-bold text-[#eb5757]">⚠ 遲交（{late.length}）</h2>
              <div className="space-y-5">{late.map(cycleCard)}</div>
            </>
          )}
          <h2 className="text-3xl font-bold text-ink-muted">進行中（{active.length}）</h2>
          {active.length === 0 && late.length === 0 ? (
            <p className="rounded-xl border border-hairline bg-white p-10 text-center text-2xl text-ink-tertiary shadow-sm">
              目前沒有進行中的週期
            </p>
          ) : (
            <div className="space-y-5">{active.map(cycleCard)}</div>
          )}
          {upcoming.length > 0 && (
            <>
              <h2 className="pt-2 text-3xl font-bold text-ink-muted">
                即將開始（{upcoming.length}）
              </h2>
              <div className="space-y-5">{upcoming.map(cycleCard)}</div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
