"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExternalLinkIcon,
  LinkIcon,
  MapPinIcon,
  MousePointerClickIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { tt } from "@/lib/i18n-core";
import { isStaff } from "@/lib/roles";
import { api } from "@/lib/api-client";
import { localDateStr, parseDate, todayStr } from "@/lib/date";
import { googleCalendarUrl } from "@/lib/google-calendar";
import { EVENT_TYPES, eventType, groupColor } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useDialogs } from "@/components/ui/Dialogs";
import { ContextMenu, type ContextMenuState } from "@/components/ui/context-menu";
import { Label, StatusIcon } from "@/components/board/ColorCell";
import { AvatarStack, peopleSummary } from "@/components/board/PersonCell";
import TaskModal from "@/components/TaskModal";
import { SubscribeButton } from "@/components/calendar/SubscribeButton";
import { PageError, PageLoading } from "@/components/PageState";
import type { EventType, Me, Member, Task, TeamEvent } from "@/lib/types";

type Loaded = { tasks: Task[]; events: TeamEvent[]; me: Me | null; members: Member[] };

async function fetchAll(): Promise<Loaded> {
  const [tk, ev, u, mem] = await Promise.all([
    api<{ tasks: Task[] }>("/api/tasks"),
    api<{ events: TeamEvent[] }>("/api/events"),
    api<{ user: Me | null }>("/api/auth/me"),
    api<{ members: Member[] }>("/api/members"),
  ]);
  return { tasks: tk.tasks, events: ev.events, me: u.user, members: mem.members };
}

type Draft = {
  id?: number;
  title: string;
  type: EventType;
  date: string;
  time: string;
  location: string;
  subteam: string;
  task_id: number | null;
  notes: string;
};

const blankDraft = (date: string, task?: Task | null): Draft => ({
  title: task ? task.title : "",
  type: "meeting",
  date,
  time: "",
  location: "",
  subteam: task?.subteam ?? "",
  task_id: task?.id ?? null,
  notes: "",
});

function locale(lang: string) {
  return lang === "zh" ? "zh-HK" : "en-GB";
}

export default function CalendarPage() {
  const { t, lang } = useI18n();
  const { subteams } = useSubteams();
  const { confirm, toast } = useDialogs();
  const router = useRouter();
  const today = todayStr();
  const [anchor, setAnchor] = useState(() => ({ y: parseDate(today).getFullYear(), m: parseDate(today).getMonth() }));
  const [sel, setSel] = useState(today);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [events, setEvents] = useState<TeamEvent[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<ContextMenuState>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);

  const apply = useCallback((data: Loaded) => {
    setTasks(data.tasks);
    setEvents(data.events);
    setMe(data.me);
    setMembers(data.members);
    return data;
  }, []);
  const load = useCallback(() => fetchAll().then(apply), [apply]);

  // First load, then honour deep links: ?date=, ?event= (highlight), ?new=1&task= (prefilled new event).
  useEffect(() => {
    fetchAll()
      .then(apply)
      .then(({ tasks: loadedTasks, events: loadedEvents }) => {
        const params = new URLSearchParams(window.location.search);
        const date = params.get("date");
        const event = loadedEvents.find((item) => item.id === Number(params.get("event")));
        const task = loadedTasks.find((item) => item.id === Number(params.get("task")));
        const target = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : event?.date ?? task?.due_date ?? null;
        if (target) {
          setSel(target);
          setAnchor({ y: parseDate(target).getFullYear(), m: parseDate(target).getMonth() });
        }
        if (event) setFlash(event.id);
        if (params.get("new") === "1") setDraft(blankDraft(target ?? todayStr(), task ?? null));
        if (params.toString()) window.history.replaceState(null, "", window.location.pathname);
      })
      .catch((err: Error) => setError(err.message));
  }, [apply]);

  useEffect(() => {
    if (flash == null) return;
    const timer = window.setTimeout(() => setFlash(null), 2400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const byDate = useMemo(() => {
    const map = new Map<string, { tasks: Task[]; events: TeamEvent[] }>();
    const ensure = (key: string) => {
      let value = map.get(key);
      if (!value) map.set(key, (value = { tasks: [], events: [] }));
      return value;
    };
    for (const task of tasks ?? []) if (task.due_date) ensure(task.due_date).tasks.push(task);
    for (const event of events ?? []) ensure(event.date).events.push(event);
    return map;
  }, [tasks, events]);

  const eventsByTask = useMemo(() => {
    const map = new Map<number, TeamEvent[]>();
    for (const event of events ?? []) {
      if (event.task_id == null) continue;
      map.set(event.task_id, [...(map.get(event.task_id) ?? []), event]);
    }
    return map;
  }, [events]);

  if (error) return <PageError message={error} />;
  if (!tasks || !events || !me) return <PageLoading label={t("載入中…")} />;

  const staff = isStaff(me.role);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const subteamName = (key: string | null) => (key ? subteams.find((item) => item.key === key)?.label ?? key : tt("全隊", "Whole team"));

  // Month grid (weeks start on Sunday), only as many weeks as the month needs.
  const first = new Date(anchor.y, anchor.m, 1);
  const offset = first.getDay();
  const daysInMonth = new Date(anchor.y, anchor.m + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => localDateStr(new Date(anchor.y, anchor.m, 1 - offset + i)));
  const monthKey = `${anchor.y}-${String(anchor.m + 1).padStart(2, "0")}`;
  const monthLabel = first.toLocaleDateString(locale(lang), { month: "long", year: "numeric" });
  const weekdayNames = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 1 + i).toLocaleDateString(locale(lang), { weekday: "short" }));
  const longDate = (date: string) => parseDate(date).toLocaleDateString(locale(lang), { weekday: "long", day: "numeric", month: "long" });

  const selData = byDate.get(sel) ?? { tasks: [], events: [] };

  /** Clicking an event opens the editor for leaders; others see its linked task, or the day. */
  function openEvent(event: TeamEvent) {
    const linked = event.task_id ? taskById.get(event.task_id) : undefined;
    if (staff) openEdit(event);
    else if (linked) setModalTask(linked);
    else setSel(event.date);
  }

  /** Drag an event onto another day to move it (leaders only). */
  async function moveEvent(id: number, date: string) {
    const event = events?.find((item) => item.id === id);
    if (!event || event.date === date) return;
    setEvents((prev) => prev?.map((item) => (item.id === id ? { ...item, date } : item)) ?? prev);
    setSel(date);
    try {
      await api(`/api/events/${id}`, { method: "PATCH", body: JSON.stringify({ date }) });
      toast(tt(`已移到 ${date}`, `Moved to ${longDate(date)}`), "ok");
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
    await load();
  }

  function goMonth(delta: number) {
    const next = new Date(anchor.y, anchor.m + delta, 1);
    setAnchor({ y: next.getFullYear(), m: next.getMonth() });
  }

  function goToday() {
    setAnchor({ y: parseDate(today).getFullYear(), m: parseDate(today).getMonth() });
    setSel(today);
  }

  function openNew(date: string, task?: Task | null) {
    setSel(date);
    setDraft(blankDraft(date, task));
  }

  function openEdit(event: TeamEvent) {
    setSel(event.date);
    setDraft({
      id: event.id,
      title: event.title,
      type: event.type,
      date: event.date,
      time: event.time ?? "",
      location: event.location,
      subteam: event.subteam ?? "",
      task_id: event.task_id,
      notes: event.notes,
    });
  }

  async function saveDraft() {
    if (!draft || !draft.title.trim() || saving) return;
    setSaving(true);
    const body = JSON.stringify({
      title: draft.title.trim(),
      type: draft.type,
      date: draft.date,
      time: draft.time || null,
      location: draft.location,
      subteam: draft.subteam || null,
      task_id: draft.task_id,
      notes: draft.notes,
    });
    try {
      if (draft.id) await api(`/api/events/${draft.id}`, { method: "PATCH", body });
      else await api("/api/events", { method: "POST", body });
      toast(draft.id ? tt("活動已更新", "Event updated") : t("活動已新增"), "ok");
      setDraft(null);
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(event: TeamEvent) {
    const ok = await confirm({ title: `${t("刪除活動")}「${event.title}」？`, confirmText: t("刪除"), danger: true });
    if (!ok) return;
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      toast(t("已刪除活動"), "ok");
      setDraft(null);
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  // ── Right-click menus ─────────────────────────────────────
  function dayMenu(event: ReactMouseEvent, date: string) {
    event.preventDefault();
    setSel(date);
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { type: "label", label: longDate(date) },
        { label: tt("新增活動", "New event"), icon: <CalendarPlusIcon />, disabled: !staff, hint: staff ? undefined : tt("限隊長", "Leaders only"), onSelect: () => openNew(date) },
        { label: tt("查看這天", "View this day"), icon: <CalendarDaysIcon />, onSelect: () => setSel(date) },
        { type: "separator" },
        { label: tt("回到今天", "Go to today"), icon: <MousePointerClickIcon />, onSelect: goToday },
      ],
    });
  }

  function eventMenu(mouse: ReactMouseEvent, event: TeamEvent) {
    mouse.preventDefault();
    mouse.stopPropagation();
    const linked = event.task_id ? taskById.get(event.task_id) : undefined;
    setMenu({
      x: mouse.clientX,
      y: mouse.clientY,
      items: [
        { type: "label", label: event.title },
        { label: staff ? tt("編輯活動", "Edit event") : tt("查看活動", "View event"), icon: <PencilIcon />, onSelect: () => (staff ? openEdit(event) : setSel(event.date)) },
        { label: tt("加到我的 Google 日曆", "Add to my Google Calendar"), icon: <CalendarPlusIcon />, onSelect: () => window.open(googleCalendarUrl(event), "_blank", "noopener") },
        ...(linked
          ? [
              { label: tt("開啟關聯任務", "Open linked task"), icon: <StatusIcon status={linked.status} />, onSelect: () => setModalTask(linked) },
              { label: tt("在任務頁開啟", "Open in Tasks"), icon: <ExternalLinkIcon />, onSelect: () => router.push(`/tasks?task=${linked.id}`) },
            ]
          : staff
            ? [{ label: tt("關聯任務…", "Link to a task…"), icon: <LinkIcon />, onSelect: () => openEdit(event) }]
            : []),
        ...(staff
          ? [
              { type: "separator" as const },
              { label: tt("刪除活動", "Delete event"), icon: <Trash2Icon />, danger: true, onSelect: () => removeEvent(event) },
            ]
          : []),
      ],
    });
  }

  function taskMenu(mouse: ReactMouseEvent, task: Task) {
    mouse.preventDefault();
    mouse.stopPropagation();
    setMenu({
      x: mouse.clientX,
      y: mouse.clientY,
      items: [
        { type: "label", label: task.title },
        { label: tt("開啟任務", "Open task"), icon: <StatusIcon status={task.status} />, onSelect: () => setModalTask(task) },
        { label: tt("在任務頁開啟", "Open in Tasks"), icon: <ExternalLinkIcon />, onSelect: () => router.push(`/tasks?task=${task.id}`) },
        { type: "separator" },
        {
          label: tt("為此任務安排活動", "Schedule an event for this task"),
          icon: <CalendarPlusIcon />,
          disabled: !staff,
          onSelect: () => openNew(task.due_date ?? sel, task),
        },
      ],
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
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
          onChanged={() => load().then(() => undefined)}
        />
      )}
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="board-title">{t("行事曆")}</h1>
        <div className="flex items-center gap-1 rounded-[6px] border border-border bg-card p-0.5">
          <Button variant="ghost" size="icon-sm" onClick={() => goMonth(-1)} aria-label={tt("上個月", "Previous month")}>
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-40 text-center text-[15px] font-semibold capitalize tabular-nums">{monthLabel}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => goMonth(1)} aria-label={tt("下個月", "Next month")}>
            <ChevronRightIcon />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>{t("今天")}</Button>
        <div className="ml-auto flex items-center gap-2">
          <SubscribeButton />
          {staff && (
            <Button onClick={() => openNew(sel)}>
              <PlusIcon /> {tt("新增活動", "New event")}
            </Button>
          )}
        </div>
      </div>

      {/* Legend + tip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
        {EVENT_TYPES.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} /> {item.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon status="todo" size={14} /> {t("任務截止")}
        </span>
        <span className="ml-auto hidden items-center gap-1.5 md:inline-flex">
          <MousePointerClickIcon className="size-3.5" />
          {staff
            ? tt("右鍵點日期可新增活動；右鍵點活動或任務查看更多", "Right-click a day to add an event, or an event or task for more")
            : tt("右鍵點活動或任務查看更多", "Right-click an event or task for more")}
        </span>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Month grid */}
        <div className="min-w-0 overflow-hidden rounded-[6px] border border-border bg-card">
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-b border-border bg-muted/50">
            {weekdayNames.map((name, i) => (
              <div key={name} className={`truncate px-1.5 py-2 text-xs sm:px-3 font-semibold tracking-wide uppercase ${i === 0 || i === 6 ? "text-muted-foreground/80" : "text-muted-foreground"}`}>
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))]" role="grid" aria-label={monthLabel}>
            {cells.map((cell, index) => {
              const inMonth = cell.startsWith(monthKey);
              const day = parseDate(cell).getDate();
              const data = byDate.get(cell);
              const isToday = cell === today;
              const selected = cell === sel;
              const items = [...(data?.events ?? []).map((event) => ({ kind: "event" as const, event })), ...(data?.tasks ?? []).map((task) => ({ kind: "task" as const, task }))];
              const shown = items.slice(0, 3);
              const weekend = index % 7 === 0 || index % 7 === 6;
              return (
                <div
                  key={cell}
                  role="gridcell"
                  tabIndex={0}
                  aria-selected={selected}
                  aria-label={longDate(cell)}
                  onClick={() => setSel(cell)}
                  onDoubleClick={() => staff && openNew(cell)}
                  onContextMenu={(event) => dayMenu(event, cell)}
                  onDragOver={(event) => {
                    if (!staff || !event.dataTransfer.types.includes("application/x-rov-event")) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (dropDay !== cell) setDropDay(cell);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDay((d) => (d === cell ? null : d));
                  }}
                  onDrop={(event) => {
                    const id = Number(event.dataTransfer.getData("application/x-rov-event"));
                    setDropDay(null);
                    if (!staff || !id) return;
                    event.preventDefault();
                    moveEvent(id, cell);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setSel(cell);
                  }}
                  className={`group/day relative flex min-h-[7.5rem] min-w-0 cursor-default flex-col overflow-hidden gap-1 border-r border-b border-border p-1.5 outline-none transition-colors duration-150 [&:nth-child(7n)]:border-r-0 ${
                    selected ? "bg-primary-soft" : weekend ? "bg-muted/25 hover:bg-muted/60" : "hover:bg-muted/50"
                  } ${inMonth ? "" : "text-muted-foreground/60"} ${dropDay === cell ? "ring-2 ring-[var(--c-blue)] ring-inset" : ""} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                        isToday ? "bg-[var(--c-blue)] font-semibold text-white" : selected ? "font-semibold text-foreground" : inMonth ? "text-foreground" : ""
                      }`}
                    >
                      {day}
                    </span>
                    {staff && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openNew(cell);
                        }}
                        className="flex size-6 scale-90 items-center justify-center rounded-[6px] text-muted-foreground opacity-0 transition-all duration-150 group-hover/day:scale-100 group-hover/day:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                        aria-label={`${tt("新增活動", "New event")}: ${longDate(cell)}`}
                      >
                        <PlusIcon className="size-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    {shown.map((item) =>
                      item.kind === "event" ? (
                        <button
                          key={`e${item.event.id}`}
                          type="button"
                          onClick={(mouse) => {
                            mouse.stopPropagation();
                            openEvent(item.event);
                          }}
                          onContextMenu={(mouse) => eventMenu(mouse, item.event)}
                          draggable={staff}
                          onDragStart={(drag) => {
                            drag.dataTransfer.setData("application/x-rov-event", String(item.event.id));
                            drag.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDropDay(null)}
                          title={staff ? `${item.event.title}\n${tt("拖到其他日期即可移動", "Drag to another day to move")}` : item.event.title}
                          className={`flex min-w-0 items-center gap-1.5 rounded-[4px] border-l-[3px] px-1.5 py-[3px] text-left text-[13px] leading-tight transition-[filter,transform] duration-150 hover:brightness-125 active:scale-[0.98] ${
                            flash === item.event.id ? "animate-pulse ring-2 ring-[var(--c-blue)]" : ""
                          }`}
                          style={{ borderColor: eventType(item.event.type).color, background: `color-mix(in srgb, ${eventType(item.event.type).color} 16%, transparent)` }}
                        >
                          {item.event.time && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.event.time}</span>}
                          <span className="min-w-0 truncate font-medium text-foreground">{item.event.title}</span>
                          {item.event.task_id && <LinkIcon className="size-3 shrink-0 text-muted-foreground" aria-label={tt("已關聯任務", "Linked to a task")} />}
                        </button>
                      ) : (
                        <button
                          key={`t${item.task.id}`}
                          type="button"
                          onClick={(mouse) => {
                            mouse.stopPropagation();
                            setModalTask(item.task);
                          }}
                          onContextMenu={(mouse) => taskMenu(mouse, item.task)}
                          title={item.task.title}
                          className="flex min-w-0 items-center gap-1.5 rounded-[4px] px-1.5 py-[3px] text-left text-[13px] leading-tight transition-colors duration-150 hover:bg-muted"
                        >
                          <StatusIcon status={item.task.status} size={13} />
                          <span className={`min-w-0 truncate ${item.task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.task.title}</span>
                        </button>
                      )
                    )}
                    {items.length > shown.length && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSel(cell);
                        }}
                        className="self-start rounded-[4px] px-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {tt(`還有 ${items.length - shown.length} 項`, `+${items.length - shown.length} more`)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day agenda */}
        <aside className="flex min-w-0 flex-col gap-4">
          <section key={sel} className="min-w-0 animate-in overflow-hidden rounded-[6px] border border-border bg-card duration-200 fade-in slide-in-from-right-1">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold capitalize">{longDate(sel)}</h2>
                <p className="text-xs text-muted-foreground">
                  {sel === today ? tt("今天", "Today") : ""}
                  {sel === today && (selData.events.length || selData.tasks.length) ? " · " : ""}
                  {selData.events.length || selData.tasks.length
                    ? tt(`${selData.events.length} 個活動、${selData.tasks.length} 項任務截止`, `${selData.events.length} event${selData.events.length === 1 ? "" : "s"}, ${selData.tasks.length} task${selData.tasks.length === 1 ? "" : "s"} due`)
                    : sel === today
                      ? ""
                      : tt("沒有安排", "Nothing scheduled")}
                </p>
              </div>
              {staff && (
                <Button variant="outline" size="sm" onClick={() => openNew(sel)}>
                  <PlusIcon /> {tt("活動", "Event")}
                </Button>
              )}
            </header>

            <div className="flex flex-col gap-1 p-2">
              {selData.events.length === 0 && selData.tasks.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                  <CalendarDaysIcon className="size-6 opacity-60" />
                  {staff ? tt("右鍵點日曆上的日期，或按「活動」新增", "Right-click a day on the calendar or press Event to add one") : tt("這天沒有活動", "No events on this day")}
                </div>
              )}

              {selData.events.map((event) => {
                const linked = event.task_id ? taskById.get(event.task_id) : undefined;
                return (
                  <article
                    key={event.id}
                    onContextMenu={(mouse) => eventMenu(mouse, event)}
                    onClick={(mouse) => {
                      if ((mouse.target as HTMLElement).closest("a,button")) return;
                      if (staff) openEdit(event);
                      else if (linked) setModalTask(linked);
                    }}
                    className={`group/ev min-w-0 rounded-[6px] ${staff || linked ? "cursor-pointer" : ""} border border-transparent p-2.5 transition-colors hover:border-border hover:bg-muted/40 ${flash === event.id ? "border-[var(--c-blue)] bg-primary-soft" : ""}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1 h-9 w-1 shrink-0 rounded-full" style={{ background: eventType(event.type).color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]">{event.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                          <Label color={eventType(event.type).color}>{eventType(event.type).label}</Label>
                          {event.time && (
                            <span className="inline-flex items-center gap-1"><ClockIcon className="size-3.5" /> {event.time}</span>
                          )}
                          {event.location && (
                            <span className="inline-flex min-w-0 items-center gap-1 [overflow-wrap:anywhere]"><MapPinIcon className="size-3.5 shrink-0" /> {event.location}</span>
                          )}
                          <span className="inline-flex items-center gap-1"><UsersIcon className="size-3.5" /> {subteamName(event.subteam)}</span>
                        </div>
                        {event.notes && <p className="mt-1.5 text-[13px] whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">{event.notes}</p>}
                        {linked && (
                          <button
                            type="button"
                            onClick={() => setModalTask(linked)}
                            className="mt-2 flex w-full items-center gap-2 rounded-[6px] border border-border bg-background px-2 py-1.5 text-left text-[13px] transition-colors hover:border-[var(--c-blue)]"
                          >
                            <StatusIcon status={linked.status} size={14} />
                            <span className="min-w-0 flex-1 truncate">{linked.title}</span>
                          </button>
                        )}
                        <a
                          href={googleCalendarUrl(event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-border bg-background px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <CalendarPlusIcon className="size-3.5" /> {tt("加到我的 Google 日曆", "Add to my Google Calendar")}
                        </a>
                      </div>
                      {staff && (
                        <button
                          type="button"
                          onClick={() => openEdit(event)}
                          className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground opacity-0 transition-opacity group-hover/ev:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                          aria-label={tt("編輯活動", "Edit event")}
                        >
                          <PencilIcon className="size-4" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {selData.tasks.length > 0 && (
                <>
                  <p className="px-2.5 pt-2 pb-1 text-xs font-semibold text-muted-foreground">{t("任務截止")}</p>
                  {selData.tasks.map((task) => {
                    const linkedEvents = eventsByTask.get(task.id) ?? [];
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setModalTask(task)}
                        onContextMenu={(mouse) => taskMenu(mouse, task)}
                        className="flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
                      >
                        <StatusIcon status={task.status} />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>{task.title}</span>
                          {linkedEvents.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <LinkIcon className="size-3" /> {tt(`${linkedEvents.length} 個關聯活動`, `${linkedEvents.length} linked event${linkedEvents.length > 1 ? "s" : ""}`)}
                            </span>
                          )}
                        </span>
                        {task.assignees?.length > 0 && <AvatarStack names={task.assignees.map((person) => person.display_name)} size={22} />}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </section>

        </aside>
      </div>

      {/* New / edit event */}
      <Sheet open={draft != null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <SheetContent className="w-full gap-0 sm:max-w-[460px]" style={{ width: "min(460px, 100%)", maxWidth: 460 }}>
          {draft && (
            <EventForm
              draft={draft}
              setDraft={setDraft}
              tasks={tasks}
              subteams={subteams.map((item, i) => ({ key: item.key, label: item.label, color: groupColor(i) }))}
              saving={saving}
              longDate={longDate}
              onSave={saveDraft}
              onDelete={draft.id ? () => removeEvent(events.find((event) => event.id === draft.id)!) : undefined}
              onCancel={() => setDraft(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "h-9 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none transition-shadow focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function EventForm({
  draft,
  setDraft,
  tasks,
  subteams,
  saving,
  longDate,
  onSave,
  onDelete,
  onCancel,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  tasks: Task[];
  subteams: { key: string; label: string; color: string }[];
  saving: boolean;
  longDate: (date: string) => string;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });
  const linked = draft.task_id ? tasks.find((task) => task.id === draft.task_id) : undefined;
  const needle = query.trim().toLowerCase();
  const matches = tasks
    .filter((task) => !needle || task.title.toLowerCase().includes(needle) || String(task.id) === needle.replace("#", ""))
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"))
    .slice(0, 8);

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="border-b border-border px-5 pt-5 pb-4 pr-12">
        <SheetTitle className="text-lg font-semibold">{draft.id ? tt("編輯活動", "Edit event") : tt("新增活動", "New event")}</SheetTitle>
        <SheetDescription className="capitalize">{longDate(draft.date)}</SheetDescription>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <Field label={tt("名稱", "Title")}>
          <input autoFocus className={inputCls} value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder={tt("例如：每週例會", "e.g. Weekly meeting")} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">{tt("類型", "Type")}</span>
          <div className="grid grid-cols-2 gap-1.5">
            {EVENT_TYPES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => set("type", item.key)}
                aria-pressed={draft.type === item.key}
                className={`flex h-9 items-center gap-2 rounded-[6px] border px-3 text-sm transition-colors ${
                  draft.type === item.key ? "border-[var(--c-blue)] bg-primary-soft font-medium" : "border-border hover:bg-muted"
                }`}
              >
                <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} /> {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={tt("日期", "Date")}>
            <input type="date" required className={inputCls} value={draft.date} onChange={(event) => event.target.value && set("date", event.target.value)} />
          </Field>
          <Field label={tt("時間（選填）", "Time (optional)")}>
            <input type="time" className={inputCls} value={draft.time} onChange={(event) => set("time", event.target.value)} />
          </Field>
        </div>

        <Field label={tt("地點（選填）", "Location (optional)")}>
          <input className={inputCls} value={draft.location} onChange={(event) => set("location", event.target.value)} placeholder={tt("例如：泳池、Lab 3", "e.g. School pool, Lab 3")} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">{tt("組別", "Subteam")}</span>
          <div className="flex flex-wrap gap-1.5">
            {[{ key: "", label: tt("全隊", "Whole team"), color: "var(--c-gray)" }, ...subteams].map((item) => (
              <button
                key={item.key || "all"}
                type="button"
                onClick={() => set("subteam", item.key)}
                aria-pressed={draft.subteam === item.key}
                className={`rounded-full transition-[opacity,transform] duration-150 hover:scale-105 ${draft.subteam === item.key ? "" : "opacity-55 hover:opacity-100"}`}
              >
                <Label color={item.color}>{item.label}</Label>
              </button>
            ))}
          </div>
        </div>

        {/* Linked task */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">{tt("關聯任務（選填）", "Linked task (optional)")}</span>
          {linked && !picking ? (
            <div className="flex items-center gap-2 rounded-[6px] border border-border bg-background px-3 py-2 text-sm">
              <StatusIcon status={linked.status} />
              <span className="min-w-0 flex-1 truncate">{linked.title}</span>
                            <button type="button" onClick={() => setPicking(true)} className="rounded-[4px] px-1.5 text-xs text-[var(--c-blue)] hover:underline">
                {tt("更換", "Change")}
              </button>
              <button type="button" onClick={() => set("task_id", null)} className="flex size-6 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={tt("取消關聯", "Unlink")}>
                <XIcon className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[6px] border border-border">
              <div className="flex items-center gap-2 border-b border-border px-3">
                <SearchIcon className="size-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={tt("搜尋任務名稱", "Search tasks by name")}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                {linked && (
                  <button type="button" onClick={() => setPicking(false)} className="text-xs text-muted-foreground hover:text-foreground">
                    {tt("取消", "Cancel")}
                  </button>
                )}
              </div>
              <ul className="max-h-56 overflow-y-auto p-1">
                {matches.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({ ...draft, task_id: task.id, title: draft.title || task.title });
                        setPicking(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${task.id === draft.task_id ? "bg-primary-soft" : ""}`}
                    >
                      <StatusIcon status={task.status} size={14} />
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      {task.assignees?.length > 0 && <span className="shrink-0 text-xs text-muted-foreground">{peopleSummary(task.assignees.map((person) => person.display_name))}</span>}
                    </button>
                  </li>
                ))}
                {matches.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted-foreground">{tt("找不到任務", "No matching tasks")}</li>}
              </ul>
            </div>
          )}
        </div>

        <Field label={tt("備註（選填）", "Notes (optional)")}>
          <textarea
            className="field-sizing-content min-h-20 w-full rounded-[6px] border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            value={draft.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
        </Field>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-5 py-3">
        {onDelete && (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2Icon /> {tt("刪除", "Delete")}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>{tt("取消", "Cancel")}</Button>
          <Button type="submit" disabled={saving || !draft.title.trim()}>
            {saving ? tt("儲存中…", "Saving…") : draft.id ? tt("儲存", "Save") : tt("新增活動", "Add event")}
          </Button>
        </div>
      </div>
    </form>
  );
}
