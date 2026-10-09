"use client";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { tt } from "@/lib/i18n-core";
import { isStaff } from "@/lib/roles";


import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { fmtMD, localDateStr, parseDate, todayStr, weekdayCn } from "@/lib/date";
import {
  BTN,
  BTN_GHOST,
  CHIP,
  EVENT_TYPES,
  INPUT_CLS,
  STATUSES,
  eventType,
} from "@/lib/ui";
import { useDialogs } from "@/components/ui/Dialogs";
import type { EventType, Me, Task, TeamEvent } from "@/lib/types";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;

export default function CalendarPage() {
  const { t, lang } = useI18n();
  const { subteams } = useSubteams();
  const { confirm, toast } = useDialogs();
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [events, setEvents] = useState<TeamEvent[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [sel, setSel] = useState<string>(todayStr());
  const [error, setError] = useState("");

  const [evTitle, setEvTitle] = useState("");
  const [evType, setEvType] = useState<EventType>("meeting");
  const [evTime, setEvTime] = useState("");
  const [evLocation, setEvLocation] = useState("");
  const [evSubteam, setEvSubteam] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [t, e, u] = await Promise.all([
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ events: TeamEvent[] }>("/api/events"),
      api<{ user: Me | null }>("/api/auth/me"),
    ]);
    setTasks(t.tasks);
    setEvents(e.events);
    setMe(u.user);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, { tasks: Task[]; events: TeamEvent[] }>();
    const ensure = (k: string) => {
      let v = map.get(k);
      if (!v) {
        v = { tasks: [], events: [] };
        map.set(k, v);
      }
      return v;
    };
    for (const t of tasks ?? []) {
      if (t.due_date) ensure(t.due_date).tasks.push(t);
    }
    for (const e of events ?? []) ensure(e.date).events.push(e);
    return map;
  }, [tasks, events]);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-red-50 p-4 text-sm text-[#eb5757]">
        {error}
      </p>
    );
  }
  if (!tasks || !events || !me) {
    return <p className="py-20 text-center text-sm text-ink-tertiary">{t("載入中…")}</p>;
  }

  // 月份與星期皆以北京時間計算（不依賴裝置時區）
  const bjNow = new Date(Date.now() + (8 * 60 + new Date().getTimezoneOffset()) * 60000);
  const y = bjNow.getFullYear();
  const m = bjNow.getMonth();
  const monthStart = new Date(y, m, 1);
  const offset = monthStart.getDay(); // 週日開頭
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(localDateStr(new Date(y, m, 1 - offset + i)));
  }
  const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
  const today = todayStr();

  const selData = byDate.get(sel) ?? { tasks: [], events: [] };

  async function addEvent() {
    if (!evTitle.trim()) return;
    setBusy(true);
    try {
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: evTitle.trim(),
          type: evType,
          date: sel,
          time: evTime || null,
          location: evLocation,
          subteam: evSubteam || null,
        }),
      });
      setEvTitle("");
      setEvTime("");
      setEvLocation("");
      setEvSubteam("");
      toast(t("活動已新增"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeEvent(e: TeamEvent) {
    const ok = await confirm({
      title: `${t("刪除活動")}「${e.title}」？`,
      confirmText: t("刪除"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/events/${e.id}`, { method: "DELETE" });
      toast(t("已刪除活動"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{t("任務日曆")}</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            className={BTN_GHOST}
            onClick={() => setNow(new Date(y, m - 1, 1))}
          >
            ‹
          </button>
          <span className="min-w-32 text-center font-semibold">
            {lang === "en" ? `${m + 1}/${y}` : `${y} 年 ${m + 1} 月`}
          </span>
          <button
            className={BTN_GHOST}
            onClick={() => setNow(new Date(y, m + 1, 1))}
          >
            ›
          </button>
          <button
            className={BTN_GHOST}
            onClick={() => {
              setNow(new Date());
              setSel(today);
            }}
          >
            {t("今天")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-ink-subtle">
        {EVENT_TYPES.map((e) => (
          <span key={e.key} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${e.dot}`} /> {e.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> {t("任務截止")}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
          <div className="grid grid-cols-7 border-b border-hairline text-center text-xs text-ink-tertiary">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className="py-2">
                {tt(w, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i])}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const inMonth = cell.startsWith(monthKey);
              const day = parseDate(cell).getDate();
              const data = byDate.get(cell);
              const isToday = cell === today;
              return (
                <button
                  key={cell}
                  onClick={() => setSel(cell)}
                  className={`min-h-24 border-b border-r border-hairline/60 p-1.5 text-left align-top transition hover:bg-surface-2/40 ${
                    inMonth ? "" : "opacity-40"
                  } ${sel === cell ? "bg-primary/10" : ""}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? "bg-primary font-bold text-white" : "text-ink-subtle"
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {data?.events.slice(0, 2).map((e) => (
                      <div
                        key={`e${e.id}`}
                        className={`truncate rounded px-1 py-0.5 text-[11px] ${
                          eventType(e.type).chip
                        }`}
                        title={e.title}
                      >
                        {e.time ? `${e.time} ` : ""}
                        {e.title}
                      </div>
                    ))}
                    {data?.tasks.slice(0, 1).map((t) => (
                      <div
                        key={`t${t.id}`}
                        className={`truncate rounded px-1 py-0.5 text-[11px] ${
                          t.status === "done"
                            ? "bg-surface-2 text-ink-subtle line-through"
                            : "bg-yellow-50 text-amber-700"
                        }`}
                        title={t.title}
                      >
                        ⚑ {t.title}
                      </div>
                    ))}
                    {(data?.events.length ?? 0) + (data?.tasks.length ?? 0) > 3 && (
                      <div className="px-1 text-[11px] text-ink-tertiary">
                        +{(data!.events.length + data!.tasks.length) - 3} {t("更多")}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-hairline bg-surface-1 p-4">
            <h2 className="font-bold">
              {fmtMD(sel)}（{weekdayCn(sel)}）
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-ink-tertiary">{t("活動")}</p>
                {selData.events.length === 0 ? (
                  <p className="text-sm text-ink-tertiary">{t("沒有活動")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selData.events.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2 text-sm"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${eventType(e.type).dot}`} />
                        <span className="flex-1">
                          {e.title}
                          {e.subteam && (
                            <span className="ml-1 text-xs text-ink-tertiary">
                              [{subteams.find((x) => x.key === e.subteam)?.label ?? e.subteam}]
                            </span>
                          )}
                        </span>
                        {e.time && <span className="text-xs text-ink-subtle">{e.time}</span>}
                        {e.location && (
                          <span className="text-xs text-ink-tertiary">@{e.location}</span>
                        )}
                        {isStaff(me.role) && (
                          <button
                            onClick={() => removeEvent(e)}
                            className="text-ink-tertiary transition hover:text-rose-400"
                            title={t("刪除活動")}
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-ink-tertiary">{t("任務截止")}</p>
                {selData.tasks.length === 0 ? (
                  <p className="text-sm text-ink-tertiary">{t("沒有任務截止")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selData.tasks.map((t) => {
                      const st = STATUSES.find((s) => s.key === t.status)!;
                      return (
                        <li
                          key={t.id}
                          className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2 text-sm"
                        >
                          <span className="flex-1 truncate">{t.title}</span>
                          <span className={`${CHIP} border-hairline-strong text-xs text-ink-subtle`}>
                            {st.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {isStaff(me.role) ? (
            <section className="rounded-xl border border-hairline bg-surface-1 p-4">
              <h2 className="mb-2 font-bold">{t("新增活動")} · {fmtMD(sel)}</h2>
              <div className="space-y-2">
                <input
                  className={INPUT_CLS}
                  placeholder={t("活動名稱，例如：每週例會")}
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className={INPUT_CLS}
                    value={evType}
                    onChange={(e) => setEvType(e.target.value as EventType)}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    className={INPUT_CLS}
                    value={evTime}
                    onChange={(e) => setEvTime(e.target.value)}
                  />
                </div>
                <input
                  className={INPUT_CLS}
                  placeholder={t("地點（選填）")}
                  value={evLocation}
                  onChange={(e) => setEvLocation(e.target.value)}
                />
                <select
                  className={INPUT_CLS}
                  value={evSubteam}
                  onChange={(e) => setEvSubteam(e.target.value)}
                >
                  <option value="">{t("組別：全隊（不限）")}</option>
                  {subteams.map((s) => (
                    <option key={s.key} value={s.key}>
                      {t("組別")}：{s.label}
                    </option>
                  ))}
                </select>
                <button className={`${BTN} w-full`} onClick={addEvent} disabled={busy || !evTitle.trim()}>
                  {busy ? t("處理中…") : t("新增活動")}
                </button>
              </div>
            </section>
          ) : (
            <p className="rounded-xl border border-hairline bg-surface-1 p-4 text-xs text-ink-tertiary">{t("活動由隊長安排；如需調整請跟隊長說。")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
