"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import Clock from "./Clock";
import MonthCalendar from "./MonthCalendar";
import type { BoardData } from "@/lib/board";

const TYPE_DOT: Record<string, string> = {
  meeting: "bg-[#2eaadc]",
  watertest: "bg-sky-400",
  competition: "bg-[#a14545]",
  other: "bg-gray-400",
};

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(b + "T00:00:00+08:00") - Date.parse(a + "T00:00:00+08:00")) / 86400000
  );
}

function weekdayLabel(dateStr: string, lang: string): string {
  return new Date(dateStr + "T00:00:00+08:00").toLocaleDateString(
    lang === "en" ? "en-GB" : "zh-TW",
    { weekday: "short", timeZone: "Asia/Hong_Kong" }
  );
}

/** 全屏按鈕（Raspberry Pi／PC 上也可直接用瀏覽器 --kiosk 參數） */
function FullscreenButton() {
  return (
    <button
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }}
      title="Fullscreen / 全屏"
      aria-label="Fullscreen / 全屏"
      className="h-12 w-12 rounded-lg border border-[rgba(0,212,255,0.35)] text-xl text-[#7defff] transition hover:bg-[rgba(0,212,255,0.1)]"
    >
      ⛶
    </button>
  );
}

/**
 * 看板本體：左＝月曆（固定常駐），右＝週期列表（獨立捲動）。
 * HUD 風格；資料以 fetch 輪詢更新（純 DOM 差異更新，永不整頁刷新＝零閃黑）。
 */
export default function DisplayBoard({
  token,
  initial,
}: {
  token: string;
  initial: BoardData;
}) {
  const [data, setData] = useState<BoardData>(initial);
  const { t, lang } = useI18n();

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
      c.status === "late"
        ? "linear-gradient(90deg, rgba(255,120,120,0.5), rgba(255,120,120,0.95))"
        : "linear-gradient(90deg, rgba(0,212,255,0.45), rgba(0,212,255,0.95))";
    const chipCls =
      c.status === "late"
        ? "border-[rgba(255,120,120,0.6)] text-[#ffb3b3]"
        : "border-[rgba(0,212,255,0.5)] text-[#7defff]";
    const chipLabel =
      c.status === "late" ? t("遲交") : c.status === "active" ? "ACTIVE" : "QUEUED";
    const left = daysBetween(today, c.end_date);
    return (
      <div key={c.id} className="b-panel rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="tech text-2xl font-bold text-white">{c.title}</h3>
          <span className={`b-chip shrink-0 ${chipCls}`}>{chipLabel}</span>
        </div>
        <p className="mt-2 text-lg text-[#8fb8cc]">
          {c.start_date} → {c.end_date}
          {c.status !== "approved" && (
            <span className={`ml-4 text-xl font-bold ${c.status === "late" ? "text-[#ffb3b3]" : "text-[#7defff]"}`}>
              {c.status === "late"
                ? t("已超時")
                : lang === "en"
                  ? `T-${left}`
                  : `剩餘 ${left} 日`}
            </span>
          )}
          {c.status === "approved" && (
            <span className="ml-4 text-xl font-bold text-[#7defff]">
              {lang === "en"
                ? `T-${daysBetween(today, c.start_date)}`
                : `${daysBetween(today, c.start_date)} 日後開始`}
            </span>
          )}
        </p>
        <div className="b-track mt-3 rounded-md">
          <div className="h-full rounded-md" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-base text-[#8fb8cc]">
          <span>
            {t("任務進度")}{" "}
            <span className="tech text-xl font-bold text-white">
              {c.done}/{c.total}
            </span>
          </span>
          {c.members.length > 0 && (
            <span className="truncate text-sm">{c.members.join(" · ")}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="board flex h-screen flex-col overflow-hidden px-8 py-6">
      {/* 頂部：隊名＋比賽倒數｜大時鐘（固定常駐） */}
      <header className="flex shrink-0 items-end justify-between gap-6">
        <div>
          <p className="b-label">ROV MISSION CONTROL</p>
          <h1 className="tech glow mt-2 text-6xl font-black text-white">
            {data.teamName}
          </h1>
          {compDays !== null && (
            <p className="mt-3 inline-block rounded-md border border-[rgba(255,120,120,0.5)] bg-[rgba(255,120,120,0.08)] px-5 py-1.5 text-2xl font-bold text-[#ffb3b3]">
              {lang === "en" ? `COMPETITION T-${compDays}` : `距比賽 ${compDays} 日`}
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
            <section className="b-panel rounded-lg p-6">
              <p className="b-label">{t("未來兩週重點")}</p>
              <div className="mt-4 space-y-3">
                {[...agenda.entries()].map(([date, items]) => (
                  <div
                    key={date}
                    className={`flex items-baseline gap-3 ${
                      date === today ? "text-[#7defff]" : "text-[#c9ecf7]"
                    }`}
                  >
                    <span className="tech w-16 shrink-0 text-2xl font-bold">
                      {Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}
                    </span>
                    <span className="w-12 shrink-0 text-sm text-[#8fb8cc]">{weekdayLabel(date, lang)}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                      {items.map((e) => (
                        <span
                          key={e.id}
                          className="flex items-center gap-2 text-xl"
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
              <p className="b-label !text-[#ffb3b3]">⚠ {t("遲交")} ({late.length})</p>
              <div className="space-y-5">{late.map(cycleCard)}</div>
            </>
          )}
          <p className="b-label">{t("進行中")} ({active.length})</p>
          {active.length === 0 && late.length === 0 ? (
            <div className="b-panel rounded-lg p-10 text-center text-2xl text-[#4f7a8f]">
              {lang === "en" ? "NO ACTIVE MISSIONS" : "目前沒有進行中的週期"}
            </div>
          ) : (
            <div className="space-y-5">{active.map(cycleCard)}</div>
          )}
          {upcoming.length > 0 && (
            <>
              <p className="b-label pt-2">{t("即將開始")} ({upcoming.length})</p>
              <div className="space-y-5">{upcoming.map(cycleCard)}</div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
