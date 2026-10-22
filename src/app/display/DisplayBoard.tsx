"use client";

import { useEffect, useMemo, useState } from "react";
import MonthCalendar from "./MonthCalendar";
import type { BoardData } from "@/lib/board";

const DAY = 86400000;

type FsDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => void;
};
type FsHtml = HTMLElement & { webkitRequestFullscreen?: () => void };

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00+08:00") - Date.parse(a + "T00:00:00+08:00")) / DAY);
}

/** 標題錯字修正 */
function fixTitle(s: string): string {
  return s.replace(/medhanical/gi, "mechanical").replace(/mon rack/gi, "monitor rack");
}

/** 成員名 → 頭像縮寫（去掉 (班號) 前綴，取首尾字首） */
function initials(name: string): string {
  const clean = name.replace(/\([^)]*\)/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words[0][0] + (words[words.length - 1][0] || "")).toUpperCase();
}

function avatarColors(name: string, mode: "dark" | "light") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  const h = hash;
  return mode === "dark"
    ? { background: `hsl(${h} 38% 78%)`, color: `hsl(${h} 60% 16%)` }
    : { background: `hsl(${h} 45% 27%)`, color: "#ffffff" };
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtDayMon(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+08:00");
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function weekdayShort(dateStr: string): string {
  return DAYS_SHORT[new Date(dateStr + "T00:00:00+08:00").getDay()];
}

/* ── 主題分段切換 ── */
function ThemeSeg({ mode, setMode }: { mode: "dark" | "light"; setMode: (m: "dark" | "light") => void }) {
  return (
    <div className="b-seg" role="group" aria-label="Theme">
      <button aria-pressed={mode === "light"} onClick={() => setMode("light")} title="Light mode">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
      <button aria-pressed={mode === "dark"} onClick={() => setMode("dark")} title="Dark mode">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </button>
    </div>
  );
}

/* ── 全屏按鈕（含 F 快捷鍵與 Esc 同步） ── */
function FullscreenButton() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const doc = document as FsDoc;
    if (!(document.fullscreenEnabled || doc.webkitFullscreenEnabled)) return;
    const sync = () => setOn(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => document.addEventListener(ev, sync));
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !/input|textarea/i.test(target.tagName)) {
        toggleFs();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => document.removeEventListener(ev, sync));
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggleFs() {
    const root = document.documentElement as FsHtml;
    const doc = document as FsDoc;
    if (!(document.fullscreenElement || doc.webkitFullscreenElement)) {
      (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
    } else {
      (document.exitFullscreen || doc.webkitExitFullscreen)?.call(document);
    }
  }

  const doc = document as FsDoc;
  const supported = !!(document.fullscreenEnabled || doc.webkitFullscreenEnabled);

  return (
    <button
      id="fs"
      onClick={toggleFs}
      aria-label={on ? "Exit full screen" : "Enter full screen"}
      aria-pressed={on}
      title={on ? "Exit full screen (F)" : "Enter full screen (F)"}
      hidden={!supported}
      className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-[var(--b-line)] bg-[var(--b-surface)] text-[var(--b-text-3)] shadow-[var(--b-card-shadow)] transition-colors duration-150 hover:text-[var(--b-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--b-accent)]"
    >
      {on ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      )}
    </button>
  );
}

/* ── 主題分段切換（頂欄用） ── */
function ThemeSegTop({ mode, setMode }: { mode: "dark" | "light"; setMode: (m: "dark" | "light") => void }) {
  return (
    <div className="b-seg" role="group" aria-label="Theme">
      <button aria-pressed={mode === "light"} onClick={() => setMode("light")} title="Light mode">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
      <button aria-pressed={mode === "dark"} onClick={() => setMode("dark")} title="Dark mode">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </button>
    </div>
  );
}

const EV_COLOR: Record<string, string> = {
  meeting: "var(--b-accent)",
  watertest: "var(--b-green)",
  competition: "var(--b-red)",
  other: "var(--b-violet)",
};

export default function DisplayBoard({
  token,
  initial,
}: {
  token: string;
  initial: BoardData;
}) {
  const [data, setData] = useState(initial);
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [sortBy, setSortBy] = useState<"due" | "progress">("due");
  const [now, setNow] = useState<Date | null>(null);

  // 時鐘每秒
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // 資料每 60 秒（fetch 純 DOM 更新，永不整頁刷新）
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/display?token=${token}`, { cache: "no-store" });
        if (r.ok && alive) setData(await r.json());
      } catch {
        /* 保留舊畫面 */
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
  const longDate = now
    ? now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Hong_Kong",
      })
    : "";
  const hh = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mm = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  const ss = now ? String(now.getSeconds()).padStart(2, "0") : "--";

  const active = data.cycles.filter((c) => c.status === "active");

  const taskCards = useMemo(() => {
    const cards = [...active];
    if (sortBy === "due") cards.sort((a, b) => a.end_date.localeCompare(b.end_date));
    else cards.sort((a, b) => (b.total ? b.done / b.total : 0) - (a.total ? a.done / a.total : 0));
    return cards;
  }, [active, sortBy]);

  const membersInvolved = new Set<string>();
  for (const c of active) for (const m of c.members) membersInvolved.add(m);

  const dueIn7 = data.tasksDue.filter((t) => t.due_date >= today && daysBetween(today, t.due_date) <= 7);
  const dueToday = dueIn7.filter((t) => t.due_date === today);

  const nextWater = data.events
    .filter((e) => e.type === "watertest" && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const compDate = data.competitionDate;
  let seasonPct = 0;
  let seasonStartYear = "";
  if (compDate) {
    const cy = Number(compDate.slice(0, 4));
    const start = (compDate.slice(5, 7) >= "09" ? cy : cy - 1) + "-09-01";
    seasonStartYear = start.slice(0, 4);
    const total = Math.max(1, daysBetween(start, compDate));
    seasonPct = Math.min(100, Math.max(0, Math.round((daysBetween(start, today) / total) * 100)));
  }
  const compDays = compDate ? daysBetween(today, compDate) : null;

  // 最近的三個進行中任務（依截止日排序）
  const recentTasks = [...active]
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
    .slice(0, 3);

  const cycleCard = (c: (typeof data.cycles)[number]) => {
    const totalDays = Math.max(1, daysBetween(c.start_date, c.end_date));
    const elapsed = Math.min(totalDays, Math.max(0, daysBetween(c.start_date, today)));
    const elapsedPct = Math.round((elapsed / totalDays) * 100);
    const endDays = daysBetween(today, c.end_date);
    const statusColor =
      endDays < 0 || endDays === 0 ? "var(--b-red)" : endDays <= 3 ? "var(--b-amber)" : "var(--b-green)";
    const statusText =
      endDays < 0 ? "Overdue" : endDays === 0 ? "Due today" : endDays <= 3 ? "Due soon" : "On track";
    const rel =
      endDays < 0
        ? `${Math.abs(endDays)}d overdue`
        : endDays === 0
          ? "Due today"
          : `${endDays} day${endDays === 1 ? "" : "s"} to deadline`;
    const taskPct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
    const bar = endDays < 0 ? "var(--b-red)" : endDays <= 3 ? "var(--b-amber)" : "var(--b-green)";
    return (
      <div key={c.id} className="b-task rounded-lg border border-[var(--b-line)] bg-[var(--b-surface)] p-5 transition-all duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[19.5px] leading-snug text-[var(--b-text)]">{fixTitle(c.title)}</h3>
            <p className="mt-1 text-[14.5px] text-[var(--b-text-2)]">
              {fmtDayMon(c.start_date)} → {fmtDayMon(c.end_date)} · {c.members.length} member
              {c.members.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="b-chip" style={{ "--ev-color": statusColor } as React.CSSProperties}>
              {statusText}
            </span>
            <div className={`mt-1 text-[26px] leading-tight ${endDays === 0 || endDays < 0 ? "italic text-[var(--b-red)]" : "text-[var(--b-text)]"}`}>
              {rel}
            </div>
          </div>
        </div>

        <div className="mt-3 h-[3px] rounded-full bg-[var(--b-surface-2)]">
          <div className="h-full rounded-full" style={{ width: `${elapsedPct}%`, background: bar }} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex -space-x-[7px]">
            {c.members.map((m) => (
              <span key={m} title={m} className="b-avatar" style={avatarColors(m, mode)}>
                {initials(m)}
              </span>
            ))}
          </div>
          <span className="text-[14.5px] text-[var(--b-text-2)]">
            {c.total > 0 ? `Subtasks ${c.done}/${c.total}` : "No subtasks"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div data-mode={mode} className="board-root min-h-screen transition-colors duration-300 min-[1100px]:flex min-[1100px]:h-screen min-[1100px]:flex-col min-[1100px]:overflow-hidden" style={{ padding: "28px 32px" }}>
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="b-eyebrow">ROV Mission Control</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--b-green)]" />
              <span className="text-[13px] italic text-[var(--b-green)]">LIVE</span>
            </span>
          </div>
          <h1 className="mt-1 text-[60px] leading-tight text-[var(--b-text)]">
            {data.teamName}
            <span className="italic text-[var(--b-text-3)]"> Overview</span>
          </h1>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right leading-none">
            <div className="text-[64px] tabular-nums text-[var(--b-text)]">
              {hh}
              <span className="clock-colon">:</span>
              {mm}
              <span className="text-[28px] italic text-[var(--b-text-3)]">:{ss}</span>
            </div>
            <div className="mt-1 text-[15px] text-[var(--b-text-2)]">{longDate}</div>
          </div>
          <ThemeSegTop mode={mode} setMode={setMode} />
          <FullscreenButton />
        </div>
      </header>

      {/* 頂排：比賽倒數＋水測＋最近三個任務 */}
      <section className="mt-6 grid shrink-0 grid-cols-1 gap-4 min-[1100px]:grid-cols-[300fr_300fr_900fr]">
        <div className="b-card p-5">
          <span className="b-eyebrow">Days to competition</span>
          <div className="mt-1 text-[52px] leading-none tabular-nums text-[var(--b-text)]">
            {compDays ?? "—"}
            <span className="text-[18px] italic text-[var(--b-text-3)]"> days</span>
          </div>
          <p className="mt-2 text-[13px] text-[var(--b-text-3)]">
            {compDate ? `${fmtDayMon(compDate)} ${compDate.slice(0, 4)}` : ""}
          </p>
        </div>

        <div className="b-card p-5">
          <span className="b-eyebrow">Next water test</span>
          {nextWater ? (
            <>
              <div className="mt-1 text-[52px] leading-none text-[var(--b-text)]">
                {Number(nextWater.date.slice(8, 10))}{" "}
                <span className="text-[24px]">{MONTHS_SHORT[Number(nextWater.date.slice(5, 7)) - 1]}</span>
              </div>
              <p className="mt-2 text-[13px] text-[var(--b-text-3)]">
                {weekdayShort(nextWater.date)}
                <span className="ml-2 italic text-[var(--b-text-2)]">
                  In {daysBetween(today, nextWater.date)} day{daysBetween(today, nextWater.date) === 1 ? "" : "s"}
                </span>
              </p>
            </>
          ) : (
            <p className="mt-3 text-[15.5px] text-[var(--b-text-3)]">Not scheduled</p>
          )}
        </div>

        <div className="b-card flex flex-col justify-center p-5">
          <span className="b-eyebrow">Upcoming deadlines</span>
          <div className="mt-2 space-y-1.5">
            {recentTasks.length === 0 && (
              <p className="text-[15.5px] text-[var(--b-text-3)]">No active tasks</p>
            )}
            {recentTasks.map((c) => {
              const d = daysBetween(today, c.end_date);
              const overdue = d < 0;
              return (
                <div key={c.id} className="flex items-baseline justify-between gap-4 border-b border-[var(--b-line)] pb-1.5 last:border-0">
                  <span className="truncate text-[17px] text-[var(--b-text)]">{fixTitle(c.title)}</span>
                  <span className={`shrink-0 text-[15px] ${overdue || d === 0 ? "italic text-[var(--b-red)]" : "text-[var(--b-text-2)]"}`}>
                    {overdue
                      ? `Overdue ${-d}d`
                      : d === 0
                        ? "Due today"
                        : `${d} day${d === 1 ? "" : "s"} to deadline`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 主體兩欄：左月曆＋兩週，右任務 */}
      <div className="mt-6 grid min-h-0 flex-1 grid-cols-1 gap-6 min-[1100px]:grid-cols-[11fr_13fr] min-[1100px]:overflow-hidden">
        {/* 左欄 */}
        <div className="min-h-0 space-y-6 min-[1100px]:overflow-y-auto min-[1100px]:pr-1">
          <MonthCalendar events={data.events} tasks={data.tasksDue} today={today} />

        </div>

        {/* 右欄：進行中任務 */}
        <section className="b-card flex min-h-0 flex-col p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[26px] leading-tight text-[var(--b-text)]">Active tasks</h2>
            <div className="b-seg">
              <button aria-pressed={sortBy === "due"} onClick={() => setSortBy("due")}>
                <span className="px-1 text-[12.5px]">By due date</span>
              </button>
              <button aria-pressed={sortBy === "progress"} onClick={() => setSortBy("progress")}>
                <span className="px-1 text-[12.5px]">By progress</span>
              </button>
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {taskCards.length === 0 && (
              <p className="py-10 text-center text-[15.5px] text-[var(--b-text-3)]">No active tasks</p>
            )}
            {taskCards.map(cycleCard)}
          </div>
        </section>
      </div>
    </div>
  );
}
