"use client";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { tt } from "@/lib/i18n-core";
import { isStaff } from "@/lib/roles";


import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { fmtMD, localDateStr, parseDate, todayStr, weekdayCn } from "@/lib/date";
import {
  CHIP,
  EVENT_TYPES,
  STATUSES,
  eventType,
} from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDialogs } from "@/components/ui/Dialogs";
import TaskModal from "@/components/TaskModal";
import { PageError, PageLoading } from "@/components/PageState";
import type { EventType, Me, Member, Task, TeamEvent } from "@/lib/types";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;
const WEEKDAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export default function CalendarPage() {
  const { t, lang } = useI18n();
  const { subteams } = useSubteams();
  const { confirm, toast } = useDialogs();
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [events, setEvents] = useState<TeamEvent[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [sel, setSel] = useState<string>(todayStr());
  const [error, setError] = useState("");

  const [evTitle, setEvTitle] = useState("");
  const [evType, setEvType] = useState<EventType>("meeting");
  const [evTime, setEvTime] = useState("");
  const [evLocation, setEvLocation] = useState("");
  const [evSubteam, setEvSubteam] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [t, e, u, mem] = await Promise.all([
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ events: TeamEvent[] }>("/api/events"),
      api<{ user: Me | null }>("/api/auth/me"),
      api<{ members: Member[] }>("/api/members"),
    ]);
    setTasks(t.tasks);
    setEvents(e.events);
    setMe(u.user);
    setMembers(mem.members);
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

  if (error) return <PageError message={error} />;
  if (!tasks || !events || !me) return <PageLoading label={t("載入中…")} />;

  // 月份與星期皆以香港時間計算，並跟隨 now（上一月／下一月／今天）
  const shifted = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
  const y = shifted.getFullYear();
  const m = shifted.getMonth();
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
      {modalTask && (
        <TaskModal
          key={modalTask.id}
          mode="edit"
          task={modalTask}
          cycleId={modalTask.cycle_id ?? 0}
          cycleTitle=""
          members={members}
          subteams={subteams}
          me={me}
          onClose={() => setModalTask(null)}
          onChanged={load}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="board-title">{t("任務日曆")}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => setNow(new Date(y, m - 1, 1))}>
            ‹
          </Button>
          <span className="min-w-32 text-center font-semibold">
            {lang === "en" ? `${m + 1}/${y}` : `${y} 年 ${m + 1} 月`}
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={() => setNow(new Date(y, m + 1, 1))}>
            ›
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setNow(new Date());
              setSel(today);
            }}
          >
            {t("今天")}
          </Button>
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
        <div className="overflow-hidden border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-hairline text-center text-xs text-ink-tertiary">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className="py-2">
                {tt(w, WEEKDAY_EN[i])}
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
                <Button
                  type="button"
                  variant="ghost"
                  key={cell}
                  onClick={(ev) => {
                    const id = (ev.target as HTMLElement).closest("[data-task-id]")?.getAttribute("data-task-id");
                    if (id) {
                      const task = data?.tasks.find((item) => item.id === Number(id));
                      if (task) setModalTask(task);
                    }
                    setSel(cell);
                  }}
                  className={`h-auto min-h-24 w-full flex-col items-start justify-start gap-0 whitespace-normal rounded-none border-b border-r border-hairline/60 p-1.5 text-left font-normal ${
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
                    {data?.tasks.slice(0, 1).map((task) => (
                      <div
                        key={`t${task.id}`}
                        data-task-id={task.id}
                        className={`truncate rounded px-1 py-0.5 text-[11px] ${
                          task.status === "done"
                            ? "bg-surface-2 text-ink-subtle line-through"
                            : "bg-warning/15 text-warning"
                        }`}
                        title={task.title}
                      >
                        ⚑ {task.title}
                      </div>
                    ))}
                    {(data?.events.length ?? 0) + (data?.tasks.length ?? 0) > 3 && (
                      <div className="px-1 text-[11px] text-ink-tertiary">
                        +{(data!.events.length + data!.tasks.length) - 3} {t("更多")}
                      </div>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
            <CardTitle>
              {fmtMD(sel)}（{weekdayCn(sel)}）
            </CardTitle>
            </CardHeader>
            <CardContent>
            <div className="space-y-3">
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeEvent(e)}
                            className="text-muted-foreground hover:text-destructive"
                            title={t("刪除活動")}
                          >
                            ✕
                          </Button>
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
                    {selData.tasks.map((task) => {
                      const st = STATUSES.find((s) => s.key === task.status)!;
                      return (
                        <li key={task.id}>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto w-full justify-start gap-2 rounded-lg bg-surface-2 px-2.5 py-2 text-left text-sm font-normal"
                            onClick={() => setModalTask(task)}
                          >
                            <span className="flex-1 truncate">{task.title}</span>
                            <span className={`${CHIP} border-hairline-strong text-xs text-ink-subtle`}>
                              {st.label}
                            </span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            </CardContent>
          </Card>

          {isStaff(me.role) ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("新增活動")} · {fmtMD(sel)}</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="space-y-2">
                <Input
                  placeholder={t("活動名稱，例如：每週例會")}
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={evType} onValueChange={(value) => value && setEvType(value as EventType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    value={evTime}
                    onChange={(e) => setEvTime(e.target.value)}
                  />
                </div>
                <Input
                  placeholder={t("地點（選填）")}
                  value={evLocation}
                  onChange={(e) => setEvLocation(e.target.value)}
                />
                <Select value={evSubteam || "all"} onValueChange={(value) => setEvSubteam(!value || value === "all" ? "" : value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("組別：全隊（不限）")}</SelectItem>
                    {subteams.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {t("組別")}：{s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" className="w-full" onClick={addEvent} disabled={busy || !evTitle.trim()}>
                  {busy ? t("處理中…") : t("新增活動")}
                </Button>
              </div>
              </CardContent>
            </Card>
          ) : (
            <p className="rounded-xl border border-hairline bg-surface-1 p-4 text-xs text-ink-tertiary">{t("活動由隊長安排；如需調整請跟隊長說。")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
