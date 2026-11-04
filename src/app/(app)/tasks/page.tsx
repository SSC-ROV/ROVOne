"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  ClipboardListIcon,
  FlagIcon,
  KanbanSquareIcon,
  LayersIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PanelRightOpenIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Table2Icon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { isStaff } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { todayStr, addDaysStr } from "@/lib/date";
import { useSubteams } from "@/lib/subteams";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageError, PageLoading } from "@/components/PageState";
import { PRIORITIES, STATUSES, groupColor, priorityLabel, subteamLabel } from "@/lib/ui";
import { BoardGroup } from "@/components/board/BoardGroup";
import { BoardHeader } from "@/components/board/BoardHeader";
import { ColorCell, PriorityCell, StatusCell, StatusIcon } from "@/components/board/ColorCell";
import { AvatarStack, PeopleCell, personColor } from "@/components/board/PersonCell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Choice, DateCell, DueCell, Kbd, MultiFilter, Pill, PRIORITY_RANK, Progress, dueState, type DueState, type FilterOption } from "@/components/tasks/shared";
import { TaskSheet } from "@/components/tasks/TaskSheet";
import { NewTaskSheet, type NewTaskInput } from "@/components/tasks/NewTaskSheet";
import { isAssignedTo, type ChecklistItem, type Cycle, type Me, type Member, type Task } from "@/lib/types";

// Any project still open (including ones awaiting approval) can be marked complete.
const COMPLETABLE_STATUSES = new Set(["active", "late", "approved", "pending_leader", "pending_teacher"]);
const OPEN_STATUSES = new Set(["active", "late", "approved", "pending_leader", "pending_teacher"]);
const PREFS_KEY = "rov-tasks-prefs-v2";
const STATUS_HINT: Record<string, string> = {
  get todo() { return tt("尚未開始", "This item hasn't been started"); },
  get doing() { return tt("正在進行", "This is actively being worked on"); },
  get blocked() { return tt("在等其他事情", "This is waiting on something"); },
  get done() { return tt("已經完成", "This has been completed"); },
};
const LEGACY_PREFS_KEY = "rov-tasks-prefs";

type View = "table" | "board";
type GroupBy = "cycle" | "status" | "assignee" | "priority" | "subteam" | "due" | "none";
type SortBy = "manual" | "due" | "start" | "priority" | "title" | "status";
type SortDir = "asc" | "desc";
type Prefs = { view: View; groupBy: GroupBy; sort: SortBy; sortDir: SortDir; cycleId: string };
type Filters = {
  query: string;
  assignees: string[];
  statuses: string[];
  priorities: string[];
  subteams: string[];
  cycles: string[];
  due: string[];
};
type Group = {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
  preset: Partial<NewTaskInput>;
  addable: boolean;
};

const EMPTY_FILTERS: Filters = { query: "", assignees: [], statuses: [], priorities: [], subteams: [], cycles: [], due: [] };
const DEFAULT_PREFS: Prefs = { view: "table", groupBy: "subteam", sort: "due", sortDir: "asc", cycleId: "" };

function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Prefs>;
      // Prefs saved before sort direction existed carry the old "manual" default;
      // drop that so the soonest-due-first default applies.
      if (!saved.sortDir) delete saved.sort;
      return { ...DEFAULT_PREFS, ...saved };
    }
    // Carry over older prefs, but let the new subteam grouping default take effect.
    const legacy = window.localStorage.getItem(LEGACY_PREFS_KEY);
    if (!legacy) return DEFAULT_PREFS;
    const { groupBy: _ignored, sort: _oldSort, ...rest } = JSON.parse(legacy) as Partial<Prefs>;
    void _ignored;
    void _oldSort;
    return { ...DEFAULT_PREFS, ...rest };
  } catch {
    return DEFAULT_PREFS;
  }
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === "INPUT") return !["checkbox", "radio", "button"].includes((el as HTMLInputElement).type);
  return el.isContentEditable || ["TEXTAREA", "SELECT"].includes(el.tagName);
}

function sameFilters(a: Filters, b: Filters) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function TasksPage() {
  const { t } = useI18n();
  const { subteams } = useSubteams();
  const { toast, confirm } = useDialogs();
  const [me, setMe] = useState<Me | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState<Partial<NewTaskInput> | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const deepLinked = useRef(false);
  const today = todayStr();

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep in memory */
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const [userRes, taskRes, cycleRes, memberRes] = await Promise.all([
      api<{ user: Me | null }>("/api/auth/me"),
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ cycles: Cycle[] }>("/api/cycles"),
      api<{ members: Member[] }>("/api/members"),
    ]);
    setMe(userRes.user);
    setTasks(taskRes.tasks);
    setCycles(cycleRes.cycles);
    setMembers(memberRes.members);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (alive) setError((err as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setRefreshing(false);
    }
  }

  // Open a task from ?task=ID (deep links, home page) or from the command palette queue.
  useEffect(() => {
    if (!tasks) return;
    function open(id: number) {
      if (tasks!.some((task) => task.id === id)) setOpenId(id);
    }
    if (!deepLinked.current) {
      deepLinked.current = true;
      const fromUrl = Number(new URLSearchParams(window.location.search).get("task"));
      if (fromUrl) open(fromUrl);
    }
    function openQueued() {
      const raw = sessionStorage.getItem("rov-open-task");
      if (!raw) return;
      sessionStorage.removeItem("rov-open-task");
      open(Number(raw));
    }
    openQueued();
    window.addEventListener("rov-open-task", openQueued);
    return () => window.removeEventListener("rov-open-task", openQueued);
  }, [tasks]);

  // Keep the URL in sync with the open task so it can be shared or reloaded.
  useEffect(() => {
    if (!deepLinked.current) return;
    const url = new URL(window.location.href);
    if (openId != null) url.searchParams.set("task", String(openId));
    else url.searchParams.delete("task");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [openId]);

  const addable = useMemo(() => cycles.filter((cycle) => OPEN_STATUSES.has(cycle.status)), [cycles]);
  const defaultCycleId = useMemo(() => {
    const saved = addable.find((cycle) => String(cycle.id) === prefs.cycleId);
    return (saved ?? addable[0])?.id ?? null;
  }, [addable, prefs.cycleId]);

  const canEdit = useCallback(
    (task: Task) => !!me && (isStaff(me.role) || isAssignedTo(task, me.id) || task.created_by === me.id),
    [me]
  );

  // Keyboard shortcuts: N = new task, F = focus search, Esc = clear selection.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (openId != null || creating) return;
      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        setCreating({});
      } else if (key === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "Escape") {
        setSelected(new Set());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, creating]);

  const matches = useCallback(
    (task: Task, f: Filters) => {
      const needle = f.query.trim().toLowerCase();
      if (needle && !`${task.title}\n${task.description}\n${(task.assignees ?? []).map((person) => person.display_name).join("\n")}`.toLowerCase().includes(needle)) return false;
      if (f.statuses.length && !f.statuses.includes(task.status)) return false;
      // Done tasks stay hidden unless the status filter asks for them.
      if (task.status === "done" && !f.statuses.includes("done")) return false;
      if (f.priorities.length && !f.priorities.includes(task.priority)) return false;
      if (f.subteams.length && !f.subteams.includes(task.subteam)) return false;
      if (f.cycles.length && !f.cycles.includes(String(task.cycle_id ?? "none"))) return false;
      if (f.assignees.length) {
        const ok = f.assignees.some((value) =>
          value === "me" ? isAssignedTo(task, me?.id) : value === "none" ? !task.assignee_ids?.length : isAssignedTo(task, Number(value))
        );
        if (!ok) return false;
      }
      if (f.due.length && !f.due.includes(dueState(task, today))) return false;
      return true;
    },
    [me, today]
  );

  const filtered = useMemo(() => (tasks ?? []).filter((task) => matches(task, filters)), [tasks, filters, matches]);

  const sortTasks = useCallback(
    (list: Task[]) => {
      const sorted = [...list];
      const byManual = (a: Task, b: Task) => a.sort_order - b.sort_order || a.id - b.id;
      // Direction flips the primary key only; ties keep the manual order.
      const dir = prefs.sortDir === "desc" ? -1 : 1;
      switch (prefs.sort) {
        case "due":
          sorted.sort((a, b) => {
            // Tasks without a due date always sink to the bottom.
            if (!a.due_date || !b.due_date) return (a.due_date ? 0 : 1) - (b.due_date ? 0 : 1) || byManual(a, b);
            return dir * a.due_date.localeCompare(b.due_date) || byManual(a, b);
          });
          break;
        case "start":
          sorted.sort((a, b) => {
            // Tasks without a start date always sink to the bottom.
            if (!a.start_date || !b.start_date) return (a.start_date ? 0 : 1) - (b.start_date ? 0 : 1) || byManual(a, b);
            return dir * a.start_date.localeCompare(b.start_date) || byManual(a, b);
          });
          break;
        case "priority":
          sorted.sort((a, b) => dir * ((PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)) || byManual(a, b));
          break;
        case "title":
          sorted.sort((a, b) => dir * a.title.localeCompare(b.title) || byManual(a, b));
          break;
        case "status": {
          const rank = (s: string) => STATUSES.findIndex((item) => item.key === s);
          sorted.sort((a, b) => dir * (rank(a.status) - rank(b.status)) || byManual(a, b));
          break;
        }
        default:
          sorted.sort(byManual);
      }
      return sorted;
    },
    [prefs.sort, prefs.sortDir]
  );

  const groups = useMemo<Group[]>(() => {
    const canQuickAdd = defaultCycleId != null;
    const make = (id: string, title: string, color: string, list: Task[], preset: Partial<NewTaskInput> = {}, addableGroup = canQuickAdd): Group => ({
      id,
      title,
      color,
      tasks: sortTasks(list),
      preset,
      addable: addableGroup,
    });
    switch (prefs.groupBy) {
      case "status":
        return STATUSES.map((s) => make(s.key, s.label, s.color, filtered.filter((task) => task.status === s.key), { status: s.key }));
      case "priority":
        return PRIORITIES.map((p) => make(p.key, p.label, p.color, filtered.filter((task) => task.priority === p.key), { priority: p.key }));
      case "subteam":
        return subteams.map((s, i) => make(s.key, s.label, groupColor(i), filtered.filter((task) => task.subteam === s.key), { subteam: s.key }));
      case "assignee": {
        const ids = new Set(filtered.flatMap((task) => task.assignee_ids ?? []));
        const people = members.filter((member) => ids.has(member.id));
        if (me && !people.some((m) => m.id === me.id)) people.unshift({ ...me });
        const sortedPeople = people.sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : a.display_name.localeCompare(b.display_name)));
        const out = sortedPeople.map((member) =>
          make(
            String(member.id),
            member.id === me?.id ? `${member.display_name} (${tt("我", "me")})` : member.display_name,
            personColor(member.display_name),
            filtered.filter((task) => isAssignedTo(task, member.id)),
            { assignee_ids: [member.id] }
          )
        );
        out.push(make("none", tt("未指派", "Unassigned"), "var(--c-gray)", filtered.filter((task) => !task.assignee_ids?.length)));
        return out;
      }
      case "due": {
        const buckets: { key: DueState; title: string; color: string; preset: Partial<NewTaskInput> }[] = [
          { key: "overdue", title: tt("已逾期", "Overdue"), color: "var(--c-red)", preset: {} },
          { key: "today", title: tt("今天到期", "Due today"), color: "var(--c-yellow)", preset: { due_date: today } },
          { key: "soon", title: tt("七天內", "Next 7 days"), color: "var(--c-blue)", preset: { due_date: addDaysStr(today, 7) } },
          { key: "later", title: tt("之後", "Later"), color: "var(--c-purple)", preset: {} },
          { key: "none", title: tt("無截止日", "No date"), color: "var(--c-gray)", preset: {} },
          { key: "done", title: tt("已完成", "Done"), color: "var(--c-green)", preset: { status: "done" } },
        ];
        return buckets.map((b) => make(b.key, b.title, b.color, filtered.filter((task) => dueState(task, today) === b.key), b.preset));
      }
      case "none":
        return [make("all", tt("全部任務", "All tasks"), "var(--c-blue)", filtered)];
      default: {
        const ordered = [...cycles].sort(
          (a, b) => Number(OPEN_STATUSES.has(b.status)) - Number(OPEN_STATUSES.has(a.status)) || b.start_date.localeCompare(a.start_date) || a.title.localeCompare(b.title)
        );
        const out = ordered.map((cycle, i) =>
          make(
            String(cycle.id),
            cycle.title,
            groupColor(i),
            filtered.filter((task) => task.cycle_id === cycle.id),
            { cycle_id: cycle.id },
            OPEN_STATUSES.has(cycle.status)
          )
        );
        const loose = filtered.filter((task) => task.cycle_id == null || !cycles.some((cycle) => cycle.id === task.cycle_id));
        if (loose.length) out.push(make("none", tt("未分專案", "No project"), "var(--c-gray)", loose, {}, false));
        return out;
      }
    }
  }, [prefs.groupBy, filtered, sortTasks, subteams, members, me, cycles, today, defaultCycleId]);

  function updateLocal(id: number, fn: (task: Task) => Task) {
    setTasks((prev) => (prev ?? []).map((item) => (item.id === id ? fn(item) : item)));
  }

  async function patch(task: Task, body: Record<string, unknown>) {
    // Optimistic update for simple fields so the UI feels instant.
    const optimistic: Partial<Task> = {};
    for (const key of ["status", "priority", "subteam", "due_date", "title", "description", "cycle_id", "start_date"] as const) {
      if (key in body) (optimistic as Record<string, unknown>)[key] = body[key];
    }
    if ("assignee_ids" in body) {
      const ids = body.assignee_ids as number[];
      optimistic.assignee_ids = ids;
      optimistic.assignees = ids.map((id) => ({ id, display_name: members.find((m) => m.id === id)?.display_name ?? "" }));
      optimistic.assignee_id = ids[0] ?? null;
      optimistic.assignee_name = optimistic.assignees[0]?.display_name ?? null;
    }
    updateLocal(task.id, (item) => ({ ...item, ...optimistic }));
    try {
      const res = await api<{ task: Task }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        // Assignee picks send the whole list, so quick successive toggles skip the stale-version check.
        body: JSON.stringify("assignee_ids" in body ? body : { ...body, version: task.version }),
      });
      updateLocal(task.id, (item) => ({ ...item, ...res.task, items: res.task.items ?? item.items }));
    } catch (err) {
      toast(t((err as Error).message), "err");
      load().catch(() => {});
    }
  }

  async function createTask(input: Partial<NewTaskInput> & { title: string }) {
    const cycleId = input.cycle_id ?? defaultCycleId;
    if (!cycleId) {
      toast(tt("請先選擇專案", "Pick a project first"), "err");
      return false;
    }
    try {
      const res = await api<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          subteam: filters.subteams.length === 1 ? filters.subteams[0] : me?.subteam ?? "general",
          ...input,
          title: input.title.trim(),
          cycle_id: cycleId,
        }),
      });
      setTasks((prev) => [...(prev ?? []), res.task]);
      updatePrefs({ cycleId: String(cycleId) });
      toast(tt("已建立任務", "Task created"), "ok");
      return true;
    } catch (err) {
      toast(t((err as Error).message), "err");
      return false;
    }
  }

  async function deleteTasks(ids: number[]) {
    const results = await Promise.allSettled(ids.map((id) => api(`/api/tasks/${id}`, { method: "DELETE" })));
    const failed = results.filter((r) => r.status === "rejected").length;
    setTasks((prev) => (prev ?? []).filter((task) => !ids.includes(task.id) || results[ids.indexOf(task.id)].status === "rejected"));
    setSelected(new Set());
    if (failed) toast(tt(`${failed} 項刪除失敗`, `${failed} could not be deleted`), "err");
    else toast(tt(`已刪除 ${ids.length} 項任務`, `Deleted ${ids.length} task(s)`), "ok");
  }

  async function completeProject(cycle: Cycle) {
    const open = (tasks ?? []).filter((task) => task.cycle_id === cycle.id && task.status !== "done").length;
    const ok = await confirm({
      title: tt(`將「${cycle.title}」標記為完成？`, `Mark "${cycle.title}" as complete?`),
      message: open
        ? tt(`還有 ${open} 項任務未完成。完成後專案會移到歷史，無法再加入任務。`, `${open} task${open === 1 ? " is" : "s are"} still open. Completed projects move to history and can't take new tasks.`)
        : tt("完成後專案會移到歷史，無法再加入任務。", "Completed projects move to history and can't take new tasks."),
      confirmText: tt("標記完成", "Mark complete"),
    });
    if (!ok) return;
    try {
      await api(`/api/cycles/${cycle.id}`, { method: "PATCH", body: JSON.stringify({ action: "complete", note: "" }) });
      toast(tt("專案已完成，辛苦了！", "Project completed — nice work!"), "ok");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  async function confirmDelete(list: Task[]) {
    const ok = await confirm({
      title: list.length === 1 ? tt(`刪除「${list[0].title}」？`, `Delete "${list[0].title}"?`) : tt(`刪除 ${list.length} 項任務？`, `Delete ${list.length} tasks?`),
      message: tt("刪除後無法復原。", "This can't be undone."),
      confirmText: tt("刪除", "Delete"),
      danger: true,
    });
    if (!ok) return;
    if (list.some((task) => task.id === openId)) setOpenId(null);
    await deleteTasks(list.map((task) => task.id));
  }

  async function bulkPatch(body: Record<string, unknown> | ((task: Task) => Record<string, unknown>)) {
    const all = (tasks ?? []).filter((task) => selected.has(task.id));
    const targets = all.filter(canEdit);
    const skipped = all.length - targets.length;
    const results = await Promise.allSettled(
      targets.map((task) => api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ ...(typeof body === "function" ? body(task) : body), version: task.version }) }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    await load().catch(() => {});
    const done = targets.length - failed;
    const extra = skipped + failed ? tt(`，${skipped + failed} 項略過（無權限或已被修改）`, `, ${skipped + failed} skipped (no permission or changed)`) : "";
    toast(tt(`已更新 ${done} 項`, `Updated ${done}`) + extra, failed || skipped ? "info" : "ok");
  }

  /** Bulk action body that adds one person to each task's existing assignees. */
  const addAssignee = (id: number) => (task: Task) => ({
    assignee_ids: (task.assignee_ids ?? []).includes(id) ? task.assignee_ids : [...(task.assignee_ids ?? []), id],
  });

  async function reorder(task: Task, direction: "up" | "down") {
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ reorder: direction, version: task.version }) });
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  function toggleSelect(ids: number[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function copyLink(task: Task) {
    const url = `${window.location.origin}/tasks?task=${task.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(tt("已複製連結", "Link copied"), "ok");
    } catch {
      toast(url, "info");
    }
  }

  if (error) return <PageError message={error} />;
  if (!tasks || !me) return <PageLoading label={t("載入中…")} />;

  const staff = isStaff(me.role);
  const openTask = tasks.find((task) => task.id === openId) ?? null;
  const narrowing = !sameFilters(filters, EMPTY_FILTERS);
  const showingDone = filters.statuses.includes("done");
  const shownGroups = groups.filter(
    (group) =>
      group.tasks.length > 0 ||
      (!narrowing && group.addable && (prefs.groupBy === "cycle" || (prefs.groupBy === "status" && group.id !== "done") || prefs.groupBy === "subteam"))
  );

  const statusOptions = STATUSES.map((item) => ({ value: item.key, label: item.label, color: item.color }));
  const priorityOptions = PRIORITIES.map((item) => ({ value: item.key, label: item.label, color: item.color }));
  const people = [{ value: "none", label: "—" }, ...members.map((member) => ({ value: String(member.id), label: member.display_name }))];
  const subteamOptions = subteams.map((item) => ({ value: item.key, label: item.label }));
  const subteamColorOptions = subteams.map((item, i) => ({ value: item.key, label: item.label, color: groupColor(i) }));
  const reorderable = prefs.sort === "manual" && prefs.groupBy === "cycle";
  // Projects a task can move to: open ones, plus its current project so the cell can show it.
  const projectCellOptions = (task: Task) =>
    cycles
      .filter((cycle) => cycle.id === task.cycle_id || OPEN_STATUSES.has(cycle.status))
      .map((cycle) => ({ value: String(cycle.id), label: cycle.title, color: "var(--c-gray)" }))
      .concat(task.cycle_id == null ? [{ value: "", label: tt("未分專案", "No project"), color: "var(--c-gray)" }] : []);

  // Summary numbers over every task (not just the filtered view).
  const openTasks = tasks.filter((task) => task.status !== "done");
  const doneCount = tasks.length - openTasks.length;
  const stats = {
    open: openTasks.length,
    doing: tasks.filter((task) => task.status === "doing").length,
    overdue: tasks.filter((task) => dueState(task, today) === "overdue").length,
    week: tasks.filter((task) => ["today", "soon"].includes(dueState(task, today))).length,
    mine: openTasks.filter((task) => isAssignedTo(task, me.id)).length,
    donePct: tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0,
  };
  // Quick views: one click applies a preset filter; clicking again clears it.
  const views: { key: string; label: string; value: number; icon: ReactNode; alert?: boolean; preset: Filters }[] = [
    { key: "all", label: tt("全部", "All"), value: tasks.length, icon: <ClipboardListIcon />, preset: EMPTY_FILTERS },
    { key: "mine", label: tt("我的待辦", "My open"), value: stats.mine, icon: <UserIcon />, preset: { ...EMPTY_FILTERS, assignees: ["me"], statuses: ["todo", "doing", "blocked"] } },
    { key: "doing", label: tt("進行中", "In progress"), value: stats.doing, icon: <CircleDotIcon />, preset: { ...EMPTY_FILTERS, statuses: ["doing"] } },
    { key: "week", label: tt("七天內到期", "Due this week"), value: stats.week, icon: <CalendarClockIcon />, preset: { ...EMPTY_FILTERS, due: ["today", "soon"] } },
    { key: "overdue", label: tt("已逾期", "Overdue"), value: stats.overdue, icon: <AlertTriangleIcon />, alert: stats.overdue > 0, preset: { ...EMPTY_FILTERS, due: ["overdue"] } },
    { key: "done", label: tt("已完成", "Done"), value: doneCount, icon: <CheckCircle2Icon />, preset: { ...EMPTY_FILTERS, statuses: ["done"] } },
  ];

  const countBy = (fn: (task: Task) => boolean) => tasks.filter(fn).length;
  const assigneeFilter: FilterOption[] = [
    { value: "me", label: tt("指派給我", "Assigned to me"), hint: countBy((task) => isAssignedTo(task, me.id)) },
    { value: "none", label: tt("未指派", "Unassigned"), hint: countBy((task) => !task.assignee_ids?.length) },
    ...members.map((member) => ({ value: String(member.id), label: member.display_name, color: personColor(member.display_name), hint: countBy((task) => isAssignedTo(task, member.id)) })),
  ];
  const statusFilter: FilterOption[] = STATUSES.map((item) => ({ value: item.key, label: item.label, color: item.color, hint: countBy((task) => task.status === item.key) }));
  const priorityFilter: FilterOption[] = PRIORITIES.map((item) => ({ value: item.key, label: item.label, color: item.color, hint: countBy((task) => task.priority === item.key) }));
  const dueFilter: FilterOption[] = [
    { value: "overdue", label: tt("已逾期", "Overdue"), color: "var(--c-red)" },
    { value: "today", label: tt("今天", "Today"), color: "var(--c-yellow)" },
    { value: "soon", label: tt("七天內", "Next 7 days"), color: "var(--c-blue)" },
    { value: "later", label: tt("之後", "Later"), color: "var(--c-purple)" },
    { value: "none", label: tt("無截止日", "No date"), color: "var(--c-gray)" },
  ].map((option) => ({ ...option, hint: countBy((task) => dueState(task, today) === option.value) }));
  const subteamFilter: FilterOption[] = subteams.map((item, i) => ({ value: item.key, label: item.label, color: groupColor(i), hint: countBy((task) => task.subteam === item.key) }));
  const projectFilter: FilterOption[] = cycles.map((cycle) => ({ value: String(cycle.id), label: cycle.title, hint: countBy((task) => task.cycle_id === cycle.id) }));
  const setFilter = (key: Exclude<keyof Filters, "query">) => (next: string[]) => setFilters((prev) => ({ ...prev, [key]: next }));
  const newTaskDefaults = (): Partial<NewTaskInput> => ({
    cycle_id: defaultCycleId ?? undefined,
    subteam: filters.subteams.length === 1 ? filters.subteams[0] : me.subteam,
    assignee_ids: filters.assignees
      .map((value) => (value === "me" ? me.id : Number(value)))
      .filter((id) => Number.isInteger(id) && id > 0),
  });

  const groupByOptions: { value: GroupBy; label: string }[] = [
    { value: "cycle", label: tt("依專案分組", "Group: Project") },
    { value: "status", label: tt("依狀態分組", "Group: Status") },
    { value: "assignee", label: tt("依負責人分組", "Group: Assignee") },
    { value: "priority", label: tt("依優先級分組", "Group: Priority") },
    { value: "subteam", label: tt("依組別分組", "Group: Subteam") },
    { value: "due", label: tt("依截止日分組", "Group: Due date") },
    { value: "none", label: tt("不分組", "No grouping") },
  ];
  const sortOptions: { value: SortBy; label: string }[] = [
    { value: "manual", label: tt("排序：手動", "Sort: Manual") },
    { value: "due", label: tt("排序：截止日", "Sort: Due date") },
    { value: "start", label: tt("排序：開始日", "Sort: Start date") },
    { value: "priority", label: tt("排序：優先級", "Sort: Priority") },
    { value: "status", label: tt("排序：狀態", "Sort: Status") },
    { value: "title", label: tt("排序：名稱", "Sort: Name") },
  ];
  // Clicking a date column header sorts by it; clicking again flips the direction.
  // Date column filter menus also carry Ascending / Descending sort choices.
  const columnSort = (key: SortBy) => ({
    dir: prefs.sort === key ? prefs.sortDir : null,
    onChange: (sortDir: SortDir) => updatePrefs({ sort: key, sortDir }),
  });
  const sortDirOptions: { value: SortDir; label: string }[] = [
    { value: "asc", label: tt("遞增", "Ascending") },
    { value: "desc", label: tt("遞減", "Descending") },
  ];

  return (
    <div className="flex w-full flex-col pb-24">
      <BoardHeader
        title={t("任務")}
        subtitle={
          <span className="flex items-center gap-2.5">
            <span>{tt(`${stats.open} 項未完成`, `${stats.open} open`)}</span>
            <Progress done={doneCount} total={tasks.length} label={false} className="w-24" />
            <span className="tabular-nums">{tt(`完成 ${stats.donePct}%`, `${stats.donePct}% done`)}</span>
          </span>
        }
        action={
          <>
            <Button variant="ghost" size="icon" onClick={refresh} disabled={refreshing} aria-label={tt("重新整理", "Refresh")} title={tt("重新整理", "Refresh")}>
              <RefreshCwIcon className={refreshing ? "animate-spin" : ""} />
            </Button>
            <Button onClick={() => setCreating(newTaskDefaults())}>
              <PlusIcon /> {tt("新任務", "New task")}
              <span className="ml-1 hidden rounded-[4px] bg-white/20 px-1 text-[11px] sm:inline">N</span>
            </Button>
          </>
        }
      />

      {/* Quick views double as one-click filters */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label={tt("快速檢視", "Quick views")}>
        {views.map((view) => {
          const active = sameFilters(filters, view.preset);
          return (
            <button
              key={view.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilters(active && view.key !== "all" ? EMPTY_FILTERS : view.preset)}
              className={`relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors [&_svg]:size-4 [&_svg]:text-muted-foreground ${
                active ? "border-[var(--underline)] font-semibold text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {view.icon}
              {view.label}
              <span className={`rounded-full px-1.5 text-xs leading-5 font-medium tabular-nums ${view.alert ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>{view.value}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar: view switch, search, filters, display options */}
      <div className="mb-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={prefs.view} onValueChange={(value) => updatePrefs({ view: value as View })}>
            <TabsList>
              <TabsTrigger value="table"><Table2Icon className="size-3.5" /> {t("表格")}</TabsTrigger>
              <TabsTrigger value="board"><KanbanSquareIcon className="size-3.5" /> {t("看板")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-border bg-card px-3 text-muted-foreground focus-within:border-ring sm:max-w-sm">
            <SearchIcon className="size-4 shrink-0" />
            <input
              ref={searchRef}
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setFilters((prev) => ({ ...prev, query: "" }));
                  event.currentTarget.blur();
                }
              }}
              placeholder={tt("搜尋任務、描述、負責人…", "Search tasks, descriptions, people…")}
              aria-label={t("搜尋")}
              className="h-8 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {filters.query ? (
              <button type="button" onClick={() => setFilters((prev) => ({ ...prev, query: "" }))} aria-label={tt("清除", "Clear")}>
                <XIcon className="size-3.5" />
              </button>
            ) : (
              <Kbd>F</Kbd>
            )}
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {prefs.view === "table" && (
              <Choice value={prefs.groupBy} onChange={(value) => updatePrefs({ groupBy: value as GroupBy })} options={groupByOptions} ariaLabel={tt("分組", "Group by")} />
            )}
            <Choice value={prefs.sort} onChange={(value) => updatePrefs({ sort: value as SortBy })} options={sortOptions} ariaLabel={tt("排序", "Sort")} />
            {prefs.sort !== "manual" && (
              <Choice
                value={prefs.sortDir}
                onChange={(value) => updatePrefs({ sortDir: value as SortDir })}
                options={sortDirOptions}
                ariaLabel={tt("排序方向", "Sort direction")}
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MultiFilter
            label={tt("負責人", "Assignee")}
            icon={<UsersIcon className="size-3.5" />}
            value={filters.assignees}
            onChange={(assignees) => setFilters((prev) => ({ ...prev, assignees }))}
            options={assigneeFilter}
          />
          <MultiFilter
            label={tt("狀態", "Status")}
            icon={<CircleDotIcon className="size-3.5" />}
            value={filters.statuses}
            onChange={(statuses) => setFilters((prev) => ({ ...prev, statuses }))}
            options={statusFilter}
          />
          <MultiFilter
            label={tt("優先級", "Priority")}
            icon={<FlagIcon className="size-3.5" />}
            value={filters.priorities}
            onChange={(priorities) => setFilters((prev) => ({ ...prev, priorities }))}
            options={priorityFilter}
          />
          <MultiFilter
            label={tt("截止日", "Due")}
            icon={<CalendarClockIcon className="size-3.5" />}
            value={filters.due}
            onChange={(due) => setFilters((prev) => ({ ...prev, due }))}
            options={dueFilter}
          />
          <MultiFilter
            label={tt("組別", "Subteam")}
            icon={<LayersIcon className="size-3.5" />}
            value={filters.subteams}
            onChange={(next) => setFilters((prev) => ({ ...prev, subteams: next }))}
            options={subteamFilter}
          />
          <MultiFilter
            label={tt("專案", "Project")}
            icon={<RefreshCwIcon className="size-3.5" />}
            value={filters.cycles}
            onChange={(next) => setFilters((prev) => ({ ...prev, cycles: next }))}
            options={projectFilter}
          />
          {narrowing && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              <XIcon /> {tt("清除篩選", "Clear filters")}
            </Button>
          )}
          <span className="ml-auto pr-1 text-xs text-muted-foreground tabular-nums">
            {tt(`顯示 ${filtered.length} / ${tasks.length} 項`, `${filtered.length} of ${tasks.length} tasks`)}
          </span>
        </div>
      </div>

      {prefs.view === "table" ? (
        <div className="flex flex-col">
          {shownGroups.map((group) => {
            const ids = group.tasks.map((task) => task.id);
            const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));
            const someChecked = ids.some((id) => selected.has(id));
            const groupDone = group.tasks.filter((task) => task.status === "done").length;
            const showSubteam = prefs.groupBy !== "subteam";
            const groupCycle = prefs.groupBy === "cycle" ? cycles.find((cycle) => String(cycle.id) === group.id) : undefined;
            const canComplete =
              !!groupCycle && COMPLETABLE_STATUSES.has(groupCycle.status) && (staff || groupCycle.proposer_id === me.id);
            return (
              <BoardGroup
                key={`${prefs.groupBy}-${group.id}`}
                title={group.title}
                color={group.color}
                icon={prefs.groupBy === "status" ? <StatusIcon status={group.id} /> : undefined}
                description={prefs.groupBy === "status" ? STATUS_HINT[group.id] : undefined}
                count={group.tasks.length}
                meta={group.tasks.length > 0 ? <Progress done={groupDone} total={group.tasks.length} className="hidden w-36 sm:inline-flex" /> : null}
                actions={
                  groupCycle && canComplete ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => completeProject(groupCycle)}
                      className="hover:border-[var(--c-green)] hover:text-[var(--c-green)]"
                      title={tt("標記專案完成", "Mark project complete")}
                    >
                      <CheckCircle2Icon />
                      <span className="hidden sm:inline">{tt("標記完成", "Mark complete")}</span>
                    </Button>
                  ) : null
                }
                footer={group.addable ? <AddTaskRow onCreate={(title) => createTask({ ...group.preset, title })} /> : null}
              >
                {group.tasks.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-muted-foreground">{tt("尚未新增任務，用下方輸入快速加入", "No tasks yet — add one below")}</p>
                ) : (
                  <table className="board-table is-interactive table-fixed" style={{ minWidth: showSubteam ? 1300 : 1180 }}>
                    {/* Fixed column widths keep every group's columns aligned */}
                    <colgroup>
                      <col />
                      <col style={{ width: 140 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 96 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 110 }} />
                      {showSubteam && <col style={{ width: 120 }} />}
                      <col style={{ width: 160 }} />
                      <col style={{ width: 40 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>
                          <span className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              className="ml-2 size-4 accent-[var(--c-blue)]"
                              checked={allChecked}
                              ref={(el) => {
                                if (el) el.indeterminate = !allChecked && someChecked;
                              }}
                              onChange={() => toggleSelect(ids, !allChecked)}
                              aria-label={tt("全選", "Select all")}
                            />
                            {tt("標題", "Title")}
                          </span>
                        </th>
                        <th><ColumnHead label={t("負責人")} options={assigneeFilter} value={filters.assignees} onChange={setFilter("assignees")} /></th>
                        <th className="color-cell"><ColumnHead label={t("狀態")} options={statusFilter} value={filters.statuses} onChange={setFilter("statuses")} /></th>
                        <th className="color-cell"><ColumnHead label={t("優先級")} options={priorityFilter} value={filters.priorities} onChange={setFilter("priorities")} /></th>
                        <th>
                          <ColumnHead label={tt("開始日", "Start")} options={[]} value={[]} onChange={() => {}} sort={columnSort("start")} />
                        </th>
                        <th>
                          <ColumnHead label={t("截止日")} options={dueFilter} value={filters.due} onChange={setFilter("due")} sort={columnSort("due")} />
                        </th>
                        <th>{tt("子任務", "Subtasks")}</th>
                        {showSubteam && <th><ColumnHead label={t("組別")} options={subteamFilter} value={filters.subteams} onChange={setFilter("subteams")} /></th>}
                        <th><ColumnHead label={tt("專案", "Project")} options={projectFilter} value={filters.cycles} onChange={setFilter("cycles")} /></th>
                        <th aria-label={tt("動作", "Actions")} />
                      </tr>
                    </thead>
                    <tbody>
                      {group.tasks.map((task, index) => {
                        const editable = canEdit(task);
                        const checked = selected.has(task.id);
                        const itemsDone = task.items.filter((item) => item.done).length;
                        return (
                          <tr key={task.id} data-selected={checked ? "true" : undefined} className="group/row">
                            <td>
                              <span className="flex min-w-0 items-center gap-2.5">
                                {/* Row number; becomes a checkbox on hover or when selected */}
                                <span className="relative flex w-6 shrink-0 justify-end">
                                  <span className={`text-xs tabular-nums text-muted-foreground group-hover/row:invisible ${checked ? "invisible" : ""}`}>{index + 1}</span>
                                  <input
                                    type="checkbox"
                                    className={`absolute top-1/2 right-0 size-4 -translate-y-1/2 accent-[var(--c-blue)] group-hover/row:visible focus-visible:visible ${checked ? "visible" : "invisible"}`}
                                    checked={checked}
                                    onChange={() => toggleSelect([task.id], !checked)}
                                    aria-label={task.title}
                                  />
                                </span>
                                <StatusIcon status={task.status} />
                                <button
                                  type="button"
                                  className={`min-w-0 truncate text-left hover:text-[var(--c-blue)] hover:underline hover:underline-offset-4 ${task.status === "done" ? "text-muted-foreground" : "text-foreground"}`}
                                  onClick={() => setOpenId(task.id)}
                                  title={task.title}
                                >
                                  {task.title}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOpenId(task.id)}
                                  className="ml-auto flex h-6 shrink-0 translate-x-1 items-center gap-1 rounded-[6px] border border-border bg-card px-1.5 text-xs text-muted-foreground opacity-0 transition-all duration-150 group-hover/row:translate-x-0 group-hover/row:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                                >
                                  <PanelRightOpenIcon className="size-3.5" /> {tt("開啟", "Open")}
                                </button>
                              </span>
                            </td>
                            <td>
                              <PeopleCell
                                names={(task.assignees ?? []).map((person) => person.display_name)}
                                value={task.assignee_ids ?? []}
                                disabled={!editable}
                                options={people}
                                onChange={(ids) => patch(task, { assignee_ids: ids })}
                              />
                            </td>
                            <td className="color-cell">
                              <StatusCell value={task.status} disabled={!editable} options={statusOptions} onChange={(value) => patch(task, { status: value })} />
                            </td>
                            <td className="color-cell">
                              <PriorityCell value={task.priority} disabled={!editable} options={priorityOptions} onChange={(value) => patch(task, { priority: value })} />
                            </td>
                            <td>
                              <DateCell value={task.start_date} today={today} disabled={!editable} onChange={(value) => patch(task, { start_date: value })} />
                            </td>
                            <td>
                              <DueCell task={task} today={today} disabled={!editable} onChange={(value) => patch(task, { due_date: value })} />
                            </td>
                            <td>
                              <Progress done={itemsDone} total={task.items.length} />
                            </td>
                            {showSubteam && (
                            <td>
                              <ColorCell
                                kind="priority"
                                value={task.subteam}
                                disabled={!editable}
                                onChange={(value) => patch(task, { subteam: value })}
                                options={subteamColorOptions.length ? subteamColorOptions : [{ value: task.subteam, label: subteamLabel(task.subteam), color: "var(--c-gray)" }]}
                              />
                            </td>
                            )}
                            <td>
                              <ColorCell
                                kind="priority"
                                value={task.cycle_id != null ? String(task.cycle_id) : ""}
                                disabled={!editable}
                                onChange={(value) => Number(value) !== task.cycle_id && patch(task, { cycle_id: Number(value) })}
                                options={projectCellOptions(task)}
                              />
                            </td>
                            <td>
                              <RowMenu
                                task={task}
                                staff={staff}
                                canUp={reorderable && editable && index > 0}
                                canDown={reorderable && editable && index < group.tasks.length - 1}
                                onOpen={() => setOpenId(task.id)}
                                onCopy={() => copyLink(task)}
                                onMove={(dir) => reorder(task, dir)}
                                onDelete={() => confirmDelete([task])}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </BoardGroup>
            );
          })}
          {shownGroups.length === 0 && (
            <EmptyState
              narrowing={narrowing}
              hasCycle={defaultCycleId != null}
              onClear={() => {
                setFilters(EMPTY_FILTERS);
              }}
              onCreate={() => setCreating(newTaskDefaults())}
            />
          )}
        </div>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((column) => {
            const columnTasks = sortTasks(filtered.filter((task) => task.status === column.key));
            return (
              <section
                key={column.key}
                className={`flex max-h-[calc(100dvh-14rem)] min-h-64 flex-col rounded-[8px] border bg-background transition-colors duration-200 ${
                  dragOver === column.key ? "border-[var(--c-blue)] bg-primary-soft" : "border-border"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragOver !== column.key) setDragOver(column.key);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null);
                }}
                onDrop={(event) => {
                  setDragOver(null);
                  const id = Number(event.dataTransfer.getData("text/plain"));
                  const task = tasks.find((item) => item.id === id);
                  if (task && canEdit(task) && task.status !== column.key) patch(task, { status: column.key });
                }}
              >
                <header className="px-3 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={column.key} />
                    <h2 className="text-[15px] font-semibold">{column.label}</h2>
                    <span className="rounded-full bg-muted px-2 text-xs leading-5 font-medium tabular-nums text-muted-foreground">{columnTasks.length}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {column.key === "done" && !showingDone ? (
                      <button
                        type="button"
                        className="text-[var(--c-blue)] hover:underline"
                        onClick={() => setFilters((prev) => ({ ...prev, statuses: ["todo", "doing", "blocked", "done"] }))}
                      >
                        {tt("已完成的任務已隱藏，點此顯示", "Done tasks are hidden. Show them")}
                      </button>
                    ) : (
                      STATUS_HINT[column.key]
                    )}
                  </p>
                </header>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {columnTasks.map((task) => {
                    const editable = canEdit(task);
                    const itemsDone = task.items.filter((item) => item.done).length;
                    const priority = PRIORITIES.find((item) => item.key === task.priority);
                    const project = cycles.find((cycle) => cycle.id === task.cycle_id)?.title;
                    return (
                      <article
                        key={task.id}
                        draggable={editable}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", String(task.id));
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDragOver(null)}
                        onClick={() => setOpenId(task.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") setOpenId(task.id);
                        }}
                        tabIndex={0}
                        className={`group/card flex cursor-pointer flex-col gap-2 rounded-[6px] border border-border bg-card p-3 outline-none transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--c-gray)_60%,transparent)] hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring ${editable ? "active:cursor-grabbing" : ""}`}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <StatusIcon status={task.status} size={14} />
                          <span className="min-w-0 truncate">{project ?? tt("無專案", "No project")}</span>
                          <span className="ml-auto">{task.assignees?.length > 0 && <AvatarStack names={task.assignees.map((person) => person.display_name)} size={20} />}</span>
                        </div>
                        <p className="text-sm leading-snug font-medium break-words group-hover/card:text-[var(--c-blue)]">{task.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {priority && <Pill color={priority.color}>{priorityLabel(task.priority)}</Pill>}
                          <Pill color={subteamColorOptions.find((item) => item.value === task.subteam)?.color ?? "var(--c-gray)"}>{subteamOptions.find((item) => item.value === task.subteam)?.label ?? subteamLabel(task.subteam)}</Pill>
                          {task.due_date && task.status !== "done" && <DueCell task={task} today={today} className="[&_*]:text-xs" />}
                        </div>
                        {task.items.length > 0 && (
                          <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                            {itemsDone} / {task.items.length}
                            <Progress done={itemsDone} total={task.items.length} label={false} className="flex-1" />
                            {Math.round((itemsDone / task.items.length) * 100)}%
                          </span>
                        )}
                      </article>
                    );
                  })}
                  {columnTasks.length === 0 && (
                    <p className="rounded-[6px] border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      {tt("拖曳任務到這裡", "Drag tasks here")}
                    </p>
                  )}
                  {defaultCycleId != null && <AddTaskRow compact onCreate={(title) => createTask({ title, status: column.key })} />}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-max -translate-x-1/2 flex-wrap items-center gap-1 rounded-[12px] border border-border bg-popover p-1.5 pl-3 text-sm shadow-xl">
          <span className="mr-1 font-medium tabular-nums">{tt(`已選 ${selected.size} 項`, `${selected.size} selected`)}</span>
          <BulkMenu label={tt("狀態", "Status")} icon={<CircleDotIcon />}>
            {STATUSES.map((item) => (
              <DropdownMenuItem key={item.key} onClick={() => bulkPatch({ status: item.key })}>
                <span className="size-2.5 rounded-full" style={{ background: item.color }} /> {item.label}
              </DropdownMenuItem>
            ))}
          </BulkMenu>
          <BulkMenu label={tt("優先級", "Priority")} icon={<FlagIcon />}>
            {PRIORITIES.map((item) => (
              <DropdownMenuItem key={item.key} onClick={() => bulkPatch({ priority: item.key })}>
                <span className="size-2.5 rounded-full" style={{ background: item.color }} /> {item.label}
              </DropdownMenuItem>
            ))}
          </BulkMenu>
          <BulkMenu label={tt("負責人", "Assignee")} icon={<UserIcon />}>
            <DropdownMenuItem onClick={() => bulkPatch(addAssignee(me.id))}>{tt("加入我", "Add me")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => bulkPatch({ assignee_ids: [] })}>{tt("取消全部指派", "Unassign everyone")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            {members.map((member) => (
              <DropdownMenuItem key={member.id} onClick={() => bulkPatch(addAssignee(member.id))}>
                {member.display_name}
              </DropdownMenuItem>
            ))}
          </BulkMenu>
          <BulkMenu label={tt("截止日", "Due")} icon={<CalendarClockIcon />}>
            <DropdownMenuItem onClick={() => bulkPatch({ due_date: today })}>{tt("今天", "Today")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => bulkPatch({ due_date: addDaysStr(today, 1) })}>{tt("明天", "Tomorrow")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => bulkPatch({ due_date: addDaysStr(today, 7) })}>{tt("下週", "Next week")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => bulkPatch({ due_date: null })}>{tt("清除截止日", "Clear date")}</DropdownMenuItem>
          </BulkMenu>
          {staff && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => confirmDelete(tasks.filter((task) => selected.has(task.id)))}>
              <Trash2Icon /> {tt("刪除", "Delete")}
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => setSelected(new Set())} aria-label={tt("取消選取", "Clear selection")} title={tt("取消選取 (Esc)", "Clear selection (Esc)")}>
            <XIcon />
          </Button>
        </div>
      )}

      <Sheet open={openTask != null} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <SheetContent className="w-full gap-0 bg-background sm:max-w-[1040px]" style={{ width: "min(1040px, 100%)", maxWidth: 1040 }}>
          {openTask && (
            <TaskSheet
              key={openTask.id}
              task={openTask}
              today={today}
              editable={canEdit(openTask)}
              staff={staff}
              me={me}
              cycles={cycles}
              people={people}
              subteams={subteamOptions}
              onPatch={(body) => patch(openTask, body)}
              onItems={(items: ChecklistItem[]) => updateLocal(openTask.id, (task) => ({ ...task, items }))}
              onDelete={async () => {
                setOpenId(null);
                await deleteTasks([openTask.id]);
              }}
              onReload={load}
              confirm={confirm}
              toast={toast}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={creating != null} onOpenChange={(open) => { if (!open) setCreating(null); }}>
        <SheetContent className="w-full gap-0 sm:max-w-[520px]" style={{ width: "min(520px, 100%)", maxWidth: 520 }}>
          {creating && (
            <NewTaskSheet
              cycles={addable}
              people={people}
              subteams={subteamOptions}
              today={today}
              defaults={creating}
              onCreate={(input) => createTask(input)}
              onDone={() => setCreating(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AddTaskRow({ onCreate, compact }: { onCreate: (title: string) => Promise<boolean>; compact?: boolean }) {
  useI18n();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={
        compact
          ? "group/add flex h-10 items-center gap-2 rounded-[8px] border border-dashed border-input px-2 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary-soft focus-within:border-solid focus-within:border-primary focus-within:bg-card"
          : "group/add flex h-11 items-center gap-2 border-t border-border px-3 text-muted-foreground transition-colors hover:bg-primary-soft focus-within:bg-primary-soft"
      }
      onSubmit={async (event) => {
        event.preventDefault();
        const next = draft.trim();
        if (!next || busy) return;
        setBusy(true);
        const ok = await onCreate(next);
        setBusy(false);
        if (ok) setDraft("");
      }}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground group-hover/add:bg-primary group-hover/add:text-primary-foreground group-focus-within/add:bg-primary group-focus-within/add:text-primary-foreground" aria-hidden>
        <PlusIcon className="size-4" />
      </span>
      <input
        value={draft}
        disabled={busy}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft("");
            event.currentTarget.blur();
          }
        }}
        placeholder={tt("新增任務⋯", "Add a task…")}
        aria-label={tt("新增任務", "Add task")}
        className="h-8 min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-primary-soft-foreground focus:placeholder:text-muted-foreground"
      />
      {draft.trim() ? (
        <button
          type="submit"
          disabled={busy}
          className="flex h-7 shrink-0 items-center gap-1 rounded-[6px] bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {tt("新增", "Add")}
          <kbd className="rounded-[3px] bg-white/20 px-1 font-sans text-[10px]">↵</kbd>
        </button>
      ) : (
        <kbd className="hidden shrink-0 rounded-[4px] border border-border px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground group-focus-within/add:inline-block">
          Enter ↵
        </kbd>
      )}
    </form>
  );
}

function RowMenu({
  task,
  staff,
  canUp,
  canDown,
  onOpen,
  onCopy,
  onMove,
  onDelete,
}: {
  task: Task;
  staff: boolean;
  canUp: boolean;
  canDown: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-7 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted"
        aria-label={tt(`「${task.title}」的更多動作`, `More actions for "${task.title}"`)}
      >
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onOpen}>
          <PanelRightOpenIcon /> {tt("開啟詳情", "Open details")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopy}>
          <LinkIcon /> {tt("複製連結", "Copy link")}
        </DropdownMenuItem>
        {(canUp || canDown) && <DropdownMenuSeparator />}
        {canUp && (
          <DropdownMenuItem onClick={() => onMove("up")}>
            <ArrowUpIcon /> {tt("上移", "Move up")}
          </DropdownMenuItem>
        )}
        {canDown && (
          <DropdownMenuItem onClick={() => onMove("down")}>
            <ArrowDownIcon /> {tt("下移", "Move down")}
          </DropdownMenuItem>
        )}
        {staff && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon /> {tt("刪除", "Delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BulkMenu({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-sm hover:bg-muted aria-expanded:bg-muted [&_svg]:size-3.5">
        {icon} {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="max-h-72 w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({ narrowing, hasCycle, onClear, onCreate }: { narrowing: boolean; hasCycle: boolean; onClear: () => void; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[8px] border border-dashed border-border bg-card px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {narrowing ? <SearchIcon className="size-5" /> : <ClipboardListIcon className="size-5" />}
      </span>
      <div>
        <p className="font-medium">{narrowing ? tt("沒有符合的任務", "No tasks match") : tt("還沒有任務", "No tasks yet")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {narrowing
            ? tt("試著調整搜尋或篩選條件", "Try adjusting your search or filters")
            : hasCycle
              ? tt("建立第一個任務，開始追蹤進度", "Create the first task to start tracking work")
              : tt("目前沒有進行中的專案，請先在「專案」頁提案", "No active project right now. Propose one on the Projects page first.")}
        </p>
      </div>
      {narrowing ? (
        <Button variant="outline" onClick={onClear}>{tt("清除篩選", "Clear filters")}</Button>
      ) : hasCycle ? (
        <Button onClick={onCreate}><PlusIcon /> {tt("新任務", "New task")}</Button>
      ) : null}
    </div>
  );
}

/** Column title with a funnel that filters the whole view by that column. */
function ColumnHead({
  label,
  options,
  value,
  onChange,
  sort,
}: {
  label: string;
  options: FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  sort?: { dir: SortDir | null; onChange: (dir: SortDir) => void };
}) {
  return (
    <span className="flex items-center justify-between gap-1">
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate">{label}</span>
        {sort?.dir === "asc" && <ArrowUpIcon className="size-3 shrink-0" aria-label={tt("遞增", "Ascending")} />}
        {sort?.dir === "desc" && <ArrowDownIcon className="size-3 shrink-0" aria-label={tt("遞減", "Descending")} />}
      </span>
      <MultiFilter variant="icon" label={label} options={options} value={value} onChange={onChange} sort={sort} />
    </span>
  );
}

