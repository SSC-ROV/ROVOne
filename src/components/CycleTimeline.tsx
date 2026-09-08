"use client";

import { daysBetween, fmtMD, addDaysStr } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { cycleStatus } from "@/lib/ui";
import type { Cycle } from "@/lib/types";

const TRACKED = ["active", "approved", "late", "pending_teacher", "pending_leader"];

const BAR_CLS: Record<string, string> = {
  active: "bg-cyan-500",
  approved: "bg-emerald-500",
  late: "bg-orange-400",
  pending_teacher: "bg-amber-400/70",
  pending_leader: "bg-amber-400/50",
};

/** 週期時間軸：所有成員可見，長條位置＝週期起訖；多個週期並行是正常運作模式 */
export default function CycleTimeline({ cycles, today }: { cycles: Cycle[]; today: string }) {
  const { t } = useI18n();
  const shown = cycles.filter((c) => TRACKED.includes(c.status));
  if (shown.length === 0) return null;

  const minStart = shown.reduce((m, c) => (c.start_date < m ? c.start_date : m), shown[0].start_date);
  const maxEnd = shown.reduce((m, c) => (c.end_date > m ? c.end_date : m), shown[0].end_date);
  const total = Math.max(1, daysBetween(minStart, maxEnd));
  const pos = (d: string) => Math.max(0, Math.min(100, (daysBetween(minStart, d) / total) * 100));
  const todayPos = today >= minStart && today <= maxEnd ? pos(today) : null;

  // 日期格度：跨度內自動選 7 / 14 / 30 天刻度
  const step = total <= 35 ? 7 : total <= 100 ? 14 : 30;
  const ticks: string[] = [];
  for (let d = minStart; daysBetween(minStart, d) <= total; d = addDaysStr(d, step)) {
    ticks.push(d);
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{t("週期時間軸")}</h2>
        <span className="text-xs text-slate-500">
          {fmtMD(minStart)} ~ {fmtMD(maxEnd)}
          <span className="ml-2 text-cyan-300">│ {t("今天")} {fmtMD(today)}</span>
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        {t("每個長條＝一個週期的起訖；多個週期同時並行沒有問題")}
      </p>
      <div className="flex gap-2">
        {/* 左側名稱欄 */}
        <div className="w-32 shrink-0">
          <div className="h-5" />
          <div className="space-y-2">
            {shown.map((c) => (
              <div key={c.id} className="flex h-6 items-center">
                <span className="w-32 truncate text-xs text-slate-300" title={c.title}>
                  {c.title}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* 右側刻度＋長條區（格線與今日線貫穿全部列） */}
        <div className="relative flex-1">
          <div className="relative h-5">
            {ticks.map((d) => (
              <span
                key={d}
                className="absolute top-0 -translate-x-1/2 text-[10px] text-slate-500"
                style={{ left: `${pos(d)}%` }}
              >
                {fmtMD(d)}
              </span>
            ))}
          </div>
          <div className="relative">
            {ticks.map((d) => (
              <div
                key={"g" + d}
                className="absolute inset-y-0 w-px bg-slate-700/60"
                style={{ left: `${pos(d)}%` }}
              />
            ))}
            {todayPos !== null && (
              <div
                className="absolute inset-y-0 z-10 w-px bg-cyan-300/80"
                style={{ left: `${todayPos}%` }}
              />
            )}
            <div className="space-y-2">
              {shown.map((c) => {
                const left = pos(c.start_date);
                const width = Math.max(2, pos(c.end_date) - left);
                return (
                  <div key={c.id} className="relative h-6">
                    <div
                      className={`absolute top-0.5 flex h-5 items-center justify-center overflow-hidden rounded px-1 text-[10px] font-medium text-slate-950 ${
                        BAR_CLS[c.status] ?? "bg-slate-500"
                      }`}
                      style={{ left: `${left}%`, width: `${Math.max(3, width)}%` }}
                      title={`${c.title}（${cycleStatus(c.status).label}）`}
                    >
                      {cycleStatus(c.status).label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
