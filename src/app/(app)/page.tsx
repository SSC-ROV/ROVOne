"use client";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { daysBetween, fmtMD, todayStr, weekdayCn } from "@/lib/date";
import { CHIP, cycleStatusLabel, cycleStatus } from "@/lib/ui";
import { useI18n } from "@/lib/i18n";
import CycleTimeline from "@/components/CycleTimeline";
import type { Cycle, Me, Settings, TeamEvent } from "@/lib/types";

export default function DashboardPage() {
  const { t } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [u, s, c, e] = await Promise.all([
        api<{ user: Me | null }>("/api/auth/me"),
        api<Settings>("/api/settings"),
        api<{ cycles: Cycle[] }>("/api/cycles"),
        api<{ events: TeamEvent[] }>("/api/events"),
      ]);
      if (!u.user) {
        window.location.href = "/login";
        return;
      }
      setMe(u.user);
      setSettings(s);
      setCycles(c.cycles);
      setEvents(e.events);
    })().catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {t(error)}
      </p>
    );
  }
  if (!cycles || !me || !settings) {
    return <p className="py-20 text-center text-sm text-ink-tertiary">{t("載入中…")}</p>;
  }

  const today = todayStr();
  const isTeacher = me.role === "teacher";
  // 老師看全隊；其他成員看自己參與的週期
  const mine = isTeacher
    ? cycles
    : cycles.filter(
        (c) => c.proposer_id === me.id || c.members.some((m) => m.id === me.id)
      );
  const myActive = mine.filter((c) => c.status === "active");
  const myApproved = mine.filter((c) => c.status === "approved");
  const myLate = mine.filter((c) => c.status === "late");
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 4);

  let countdown: { label: string; days: number } | null = null;
  if (settings.competition_date) {
    const diff = daysBetween(today, settings.competition_date);
    countdown = {
      label:
        diff > 0 ? t("距離比賽還有") : diff === 0 ? t("比賽就是今天！") : t("比賽已結束"),
      days: Math.abs(diff),
    };
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-hairline bg-surface-1 p-5 md:col-span-1">
          {countdown ? (
            <>
              <p className="text-sm text-primary-hover/90">{countdown.label}</p>
              <p className="mt-1 text-5xl font-black tabular-nums">
                {countdown.days}
                <span className="ml-1 text-base font-medium text-ink-subtle">{t("天")}</span>
              </p>
              <p className="mt-2 text-sm text-ink-subtle">
                {fmtMD(settings.competition_date!)}（{weekdayCn(settings.competition_date!)}）
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-subtle">{t("尚未設定比賽日期")}</p>
              {isStaff(me.role) ? (
                <Link
                  href="/admin"
                  className="mt-2 inline-block text-sm text-primary-hover hover:underline"
                >
                  {t("前往「管理」設定 →")}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-ink-tertiary">{t("請隊長或老師於「管理」頁設定")}</p>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 md:col-span-2">
          <StatCard label={t("進行中週期")} value={myActive.length} accent="text-primary-hover" />
          <StatCard label={t("遲交")} value={myLate.length} accent={myLate.length ? "text-orange-300" : "text-ink-subtle"} />
          <StatCard label={t("已核准待開始")} value={myApproved.length} accent="text-emerald-300" />
        </div>
      </div>

      <CycleTimeline cycles={cycles} today={today} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">
            {isTeacher ? t("全隊週期進度") : t("我的開發週期進度")}
          </h2>
          <Link href="/cycles" className="text-sm text-primary-hover hover:underline">
            {t("開發週期")} →
          </Link>
        </div>
        {mine.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface-1 py-10 text-center text-sm text-ink-tertiary">
            {t("目前沒有參與中的週期，到「開發週期」提案一個吧")}
          </p>
        ) : (
          <div className="space-y-3">
            {mine
              .filter((c) => c.status === "active" || c.status === "approved" || c.status === "late")
              .map((c) => {
                const pct =
                  c.task_total > 0 ? Math.round((c.task_done / c.task_total) * 100) : 0;
                const left = daysBetween(today, c.end_date);
                return (
                  <Link
                    key={c.id}
                    href="/cycles"
                    className="block rounded-2xl border border-hairline bg-surface-1 p-4 transition hover:border-hairline-strong"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cycleStatus(c.status).chip}`}
                      >
                        {cycleStatusLabel(c.status)}
                      </span>
                      <span className="font-bold">{c.title}</span>
                      {isTeacher && c.proposer_name && (
                        <span className={`${CHIP} border-hairline-strong text-ink-muted`}>
                          {c.proposer_name}
                        </span>
                      )}
                      <span className="ml-auto text-xs tabular-nums text-ink-subtle">
                        {fmtMD(c.start_date)} ~ {fmtMD(c.end_date)}
                        {c.status === "active" && (
                          <span
                            className={`ml-2 ${left < 0 ? "text-rose-400" : left <= 3 ? "text-amber-300" : "text-ink-tertiary"}`}
                          >
                            {left < 0 ? `${t("已超過結束日")} ${-left} ${t("天")}` : `${t("剩")} ${left} ${t("天")}`}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-ink-subtle">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full ${c.task_total > 0 ? "bg-primary" : ""}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="tabular-nums">
                        {t("任務")} {c.task_done}/{c.task_total}（{pct}%）
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-hairline bg-surface-1 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{t("近期活動")}</h2>
          <Link href="/calendar" className="text-sm text-primary-hover hover:underline">
            {t("日曆 →")}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-tertiary">{t("沒有排定的活動")}</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-1 px-3 py-2.5 text-sm"
              >
                <span className="w-20 shrink-0 text-ink-subtle">
                  {fmtMD(e.date)}
                  {e.time && <span className="ml-1">{e.time}</span>}
                </span>
                <span className="flex-1 truncate">{e.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-hairline bg-surface-1 p-4 text-center">
      <p className={`text-3xl font-black tabular-nums ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-subtle">{label}</p>
    </div>
  );
}
