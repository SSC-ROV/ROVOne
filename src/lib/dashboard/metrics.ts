// Pure task maths for the dashboard widgets. Dates are "YYYY-MM-DD" strings in local time.
import { addDaysStr, daysBetween, parseDate } from "@/lib/date";
import { isAssignedTo, type Task } from "@/lib/types";
import { shortName } from "@/components/board/PersonCell";
import type { GroupBy, WidgetSettings } from "./catalog";

export type Health = "overdue" | "blocked" | "behind" | "soon" | "ontrack" | "done" | "nodate";

export const HEALTH_ORDER: Health[] = ["overdue", "blocked", "behind", "soon", "ontrack", "done", "nodate"];

/** Monday of the week that holds `day`. */
export function weekStart(day: string): string {
  const dow = parseDate(day).getDay(); // 0 = Sunday
  return addDaysStr(day, dow === 0 ? -6 : 1 - dow);
}

/** Done date of a task (YYYY-MM-DD), or null. */
export function doneDate(task: Task): string | null {
  if (task.status !== "done") return null;
  return task.completed_at ? task.completed_at.slice(0, 10) : task.due_date;
}

/** Start date: the start_date column, or the "Start: YYYY-MM-DD" line the Gantt import wrote. */
export function startDate(task: Task): string | null {
  if (task.start_date) return task.start_date.slice(0, 10);
  const m = /(?:^|\n)Start: (\d{4}-\d{2}-\d{2})/.exec(task.description ?? "");
  return m ? m[1] : null;
}

/** Not started with more than half of the start→due window used up (and not yet overdue). */
export function isBehind(task: Task, today: string): boolean {
  if (task.status !== "todo" || !task.due_date || task.due_date < today) return false;
  const start = startDate(task);
  if (!start || start >= task.due_date) return false;
  const span = daysBetween(start, task.due_date);
  return daysBetween(start, today) > span / 2;
}

export function health(task: Task, today: string): Health {
  if (task.status === "done") return "done";
  if (task.due_date && task.due_date < today) return "overdue";
  if (task.status === "blocked") return "blocked";
  if (!task.due_date) return "nodate";
  if (isBehind(task, today)) return "behind";
  if (daysBetween(today, task.due_date) <= 7) return "soon";
  return "ontrack";
}

export function filterTasks(tasks: Task[], settings: WidgetSettings, meId: number): Task[] {
  return tasks.filter(
    (t) => (!settings.subteam || t.subteam === settings.subteam) && (!settings.mine || isAssignedTo(t, meId))
  );
}

export interface Week {
  start: string;
  end: string;
  days: string[];
}

export function thisWeek(today: string): Week {
  const start = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(start, i));
  return { start, end: days[6], days };
}

const inRange = (d: string | null | undefined, from: string, to: string) => !!d && d >= from && d <= to;

export function summary(tasks: Task[], today: string) {
  const week = thisWeek(today);
  const done = tasks.filter((t) => t.status === "done");
  const open = tasks.filter((t) => t.status !== "done");
  const dueWeek = tasks.filter((t) => inRange(t.due_date, week.start, week.end));
  const dueSoFar = tasks.filter((t) => t.due_date && t.due_date <= today).length;
  return {
    total: tasks.length,
    done: done.length,
    pct: tasks.length ? Math.round((done.length / tasks.length) * 100) : 0,
    dueWeek: dueWeek.length,
    dueWeekDone: dueWeek.filter((t) => t.status === "done").length,
    finishedThisWeek: done.filter((t) => inRange(doneDate(t), week.start, week.end)).length,
    overdue: open.filter((t) => t.due_date && t.due_date < today).length,
    dueNext7: open.filter((t) => inRange(t.due_date, today, addDaysStr(today, 6))).length,
    behind: open.filter((t) => isBehind(t, today)).length,
    blocked: open.filter((t) => t.status === "blocked").length,
    aheadBehind: done.length - dueSoFar,
  };
}

export interface Group {
  key: string;
  label: string;
  tasks: Task[];
}

const UNASSIGNED = "__none";

/** Splits tasks per subteam or per person. A task with several assignees counts for each. */
export function groupTasks(
  tasks: Task[],
  by: GroupBy,
  subteamLabel: (key: string) => string,
  unassignedLabel: string
): Group[] {
  const map = new Map<string, Group>();
  const push = (key: string, label: string, task: Task) => {
    const g = map.get(key) ?? { key, label, tasks: [] };
    g.tasks.push(task);
    map.set(key, g);
  };
  for (const t of tasks) {
    if (by === "subteam") {
      push(t.subteam, subteamLabel(t.subteam), t);
    } else if ((t.assignees ?? []).length === 0) {
      push(UNASSIGNED, unassignedLabel, t);
    } else {
      for (const a of t.assignees) push(String(a.id), shortName(a.display_name), t);
    }
  }
  return [...map.values()].sort((a, b) =>
    a.key === UNASSIGNED ? 1 : b.key === UNASSIGNED ? -1 : b.tasks.length - a.tasks.length || a.label.localeCompare(b.label)
  );
}

export function deadlinesByDay(tasks: Task[], today: string) {
  return thisWeek(today).days.map((day) => {
    const due = tasks.filter((t) => t.due_date === day);
    const done = due.filter((t) => t.status === "done").length;
    const missed = day < today ? due.length - done : 0;
    return { day, missed, open: due.length - done - missed, done };
  });
}

/** Cumulative planned (due by then) vs done, one point per day from the first date to the last due date. */
export function burnUp(tasks: Task[], today: string) {
  const dated = tasks.filter((t) => t.due_date);
  if (dated.length === 0) return [];
  const starts = dated.map((t) => startDate(t) ?? t.due_date!).concat(dated.map((t) => t.due_date!));
  const first = starts.reduce((a, b) => (a < b ? a : b));
  const last = dated.map((t) => t.due_date!).reduce((a, b) => (a > b ? a : b));
  const span = Math.min(daysBetween(first, last), 730);
  const dueDates = dated.map((t) => t.due_date!).sort();
  const doneDates = tasks.map(doneDate).filter((d): d is string => !!d).sort();
  const points: { day: string; planned: number; done: number | null }[] = [];
  let pi = 0;
  let di = 0;
  for (let i = 0; i <= span; i++) {
    const day = addDaysStr(first, i);
    while (pi < dueDates.length && dueDates[pi] <= day) pi++;
    while (di < doneDates.length && doneDates[di] <= day) di++;
    points.push({ day, planned: pi, done: day <= today ? di : null });
  }
  return points;
}

/** Deadlines per week (keyed by Monday), split by group key. */
export function deadlinesPerWeek(groups: Group[]) {
  const weeks = new Map<string, Map<string, number>>();
  for (const g of groups) {
    for (const t of g.tasks) {
      if (!t.due_date) continue;
      const wk = weekStart(t.due_date);
      const row = weeks.get(wk) ?? new Map<string, number>();
      row.set(g.key, (row.get(g.key) ?? 0) + 1);
      weeks.set(wk, row);
    }
  }
  const keys = [...weeks.keys()].sort();
  if (keys.length === 0) return [];
  const out: { week: string; counts: Map<string, number> }[] = [];
  for (let wk = keys[0]; wk <= keys[keys.length - 1] && out.length < 104; wk = addDaysStr(wk, 7)) {
    out.push({ week: wk, counts: weeks.get(wk) ?? new Map() });
  }
  return out;
}

/** People with overdue or behind tasks, worst first. */
export function membersNeedingHelp(tasks: Task[], today: string, subteamLabel: (key: string) => string) {
  const people = new Map<number, { id: number; name: string; overdue: number; behind: number; subteams: Set<string> }>();
  for (const t of tasks) {
    if (t.status === "done") continue;
    const overdue = !!t.due_date && t.due_date < today;
    const behind = isBehind(t, today);
    for (const a of t.assignees ?? []) {
      const p = people.get(a.id) ?? { id: a.id, name: a.display_name, overdue: 0, behind: 0, subteams: new Set<string>() };
      p.subteams.add(subteamLabel(t.subteam));
      if (overdue) p.overdue++;
      if (behind) p.behind++;
      people.set(a.id, p);
    }
  }
  return [...people.values()]
    .filter((p) => p.overdue + p.behind > 0)
    .sort((a, b) => b.overdue - a.overdue || b.behind - a.behind || a.name.localeCompare(b.name))
    .map((p) => ({ ...p, subteams: [...p.subteams].join(" + ") }));
}

export const byDue = (a: Task, b: Task) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.id - b.id;
