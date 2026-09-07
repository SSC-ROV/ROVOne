"use client";

import { daysBetween, fmtMD } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { cycleStatus } from "@/lib/ui";
import type { Cycle } from "@/lib/types";

export type CycleConflict = { otherTitle: string; names: string[] };

const TRACKED = ["active", "approved", "late", "pending_teacher", "pending_leader"];

/**
 * 撞期偵測：兩個週期「日期重疊」且「有共同成員」才算相撞
 * （各組各自平行作業不衝突；搶同一批人才需要協調）
 */
export function computeConflicts(cycles: Cycle[]): Map<number, CycleConflict[]> {
  const rel = cycles.filter((c) => TRACKED.includes(c.status));
  const participants = new Map<number, Set<number>>();
  const nameOf = new Map<number, string>();
  for (const c of rel) {
    const set = new Set<number>();
    if (c.proposer_id) {
      set.add(c.proposer_id);
      if (c.proposer_name) nameOf.set(c.proposer_id, c.proposer_name);
    }
    for (const m of c.members) {
      set.add(m.id);
      nameOf.set(m.id, m.display_name);
    }
    participants.set(c.id, set);
  }
  const out = new Map<number, CycleConflict[]>();
  const add = (id: number, otherTitle: string, ids: number[]) => {
    const arr = out.get(id) ?? [];
    arr.push({
      otherTitle,
      names: ids.map((id) => nameOf.get(id) ?? "").filter(Boolean),
    });
    out.set(id, arr);
  };
  for (let i = 0; i < rel.length; i++) {
    for (let j = i + 1; j < rel.length; j++) {
      const a = rel[i];
      const b = rel[j];
      const overlap = a.start_date <= b.end_date && b.start_date <= a.end_date;
      if (!overlap) continue;
      const pa = participants.get(a.id)!;
      const pb = participants.get(b.id)!;
      const shared = [...pa].filter((id) => pb.has(id));
      if (shared.length === 0) continue;
      add(a.id, b.title, shared);
      add(b.id, a.title, shared);
    }
  }
  return out;
}

const BAR_CLS: Record<string, string> = {
  active: "bg-cyan-500",
  approved: "bg-emerald-500",
  late: "bg-orange-400",
  pending_teacher: "bg-amber-400/70",
  pending_leader: "bg-amber-400/50",
};

/** 週期時間軸：所有人可見，長條重疊＝同時進行；⚠ = 有共同成員撞期 */
export default function CycleTimeline({
  cycles,
  today,
  compact = false,
}: {
  cycles: Cycle[];
  today: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const { subteams } = useSubteams();
  const shown = cycles.filter((c) => TRACKED.includes(c.status));
  if (shown.length === 0) return null;

  const minStart = shown.reduce((m, c) => (c.start_date < m ? c.start_date : m), shown[0].start_date);
  const maxEnd = shown.reduce((m, c) => (c.end_date > m ? c.end_date : m), shown[0].end_date);
  const total = Math.max(1, daysBetween(minStart, maxEnd));
  const pos = (d: string) => Math.max(0, Math.min(100, (daysBetween(minStart, d) / total) * 100));
  const conflicts = computeConflicts(cycles);
  const todayIn = today >= minStart && today <= maxEnd;
  const todayPos = todayIn ? pos(today) : null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{t("週期時間軸")}</h2>
        <span className="text-xs text-slate-500">
          {fmtMD(minStart)} ~ {fmtMD(maxEnd)}
          {todayIn && <span className="ml-2 text-cyan-300">│ 今天 {fmtMD(today)}</span>}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        {t("長條重疊＝同時進行；⚠ 表示兩個週期有共同成員，開始前先協調")}
      </p>
      <div className="space-y-2">
        {shown.map((c) => {
          const left = pos(c.start_date);
          const width = Math.max(2, pos(c.end_date) - left);
          const warn = conflicts.get(c.id);
          return (
            <div key={c.id} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-xs text-slate-300" title={c.title}>
                {c.title}
              </span>
              <div className="relative h-6 flex-1 rounded bg-slate-800/70">
                {todayPos !== null && (
                  <div
                    className="absolute top-0 h-6 w-px bg-cyan-300/70"
                    style={{ left: `${todayPos}%` }}
                  />
                )}
                <div
                  className={`absolute top-0.5 flex h-5 items-center justify-center rounded px-1 text-[10px] font-medium text-slate-950 ${
                    BAR_CLS[c.status] ?? "bg-slate-500"
                  } ${warn ? "ring-2 ring-rose-400" : ""}`}
                  style={{ left: `${left}%`, width: `${Math.max(3, width)}%` }}
                  title={`${c.title}（${cycleStatus(c.status).label}）`}
                >
                  {warn ? "⚠" : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {compact && conflicts.size > 0 && (
        <p className="mt-2 text-xs text-rose-300">
          ⚠ {t("有撞期的週期，請到「開發週期」頁協調")}
        </p>
      )}
      {!compact && conflicts.size > 0 && (
        <div className="mt-3 space-y-1 text-xs text-rose-300">
          {Array.from(conflicts.entries()).map(([id, list]) => (
            <div key={id}>
              ⚠ {t("撞期")}「{(cycles.find((x) => x.id === id))?.title}」：
              {list.map((w) => `×「${w.otherTitle}」（${w.names.join("、")}）`).join(" ")}
            </div>
          ))}
        </div>
      )}
      {subteams.length > 0 && !compact && (
        <p className="mt-2 text-xs text-slate-500">{t("各長條依狀態著色；游標停在上面可看完整名稱")}</p>
      )}
    </div>
  );
}
