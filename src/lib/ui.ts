import type {
  EventType,
  PartStatus,
  Priority,
  Subteam,
  TaskStatus,
} from "./types";

export const SUBTEAMS: { key: Subteam; label: string }[] = [
  { key: "mech", label: "機械" },
  { key: "elec", label: "電控" },
  { key: "sw", label: "軟體" },
  { key: "pilot", label: "操控" },
  { key: "general", label: "全隊" },
];

export const subteamLabel = (k: string) =>
  SUBTEAMS.find((s) => s.key === k)?.label ?? k;

export const SUBTEAM_CLS: Record<string, string> = {
  mech: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  elec: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  sw: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  pilot: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  general: "border-slate-600/60 bg-slate-500/10 text-slate-300",
};

export const PRIORITIES: { key: Priority; label: string; dot: string }[] = [
  { key: "high", label: "高", dot: "bg-rose-500" },
  { key: "medium", label: "中", dot: "bg-amber-400" },
  { key: "low", label: "低", dot: "bg-slate-500" },
];

export const priorityDot = (k: string) =>
  PRIORITIES.find((p) => p.key === k)?.dot ?? "bg-slate-500";

export const STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "待辦" },
  { key: "doing", label: "進行中" },
  { key: "done", label: "已完成" },
];

export const EVENT_TYPES: {
  key: EventType;
  label: string;
  dot: string;
  chip: string;
}[] = [
  { key: "meeting", label: "例會", dot: "bg-cyan-400", chip: "bg-cyan-500/15 text-cyan-300" },
  { key: "watertest", label: "水測", dot: "bg-sky-400", chip: "bg-sky-500/15 text-sky-300" },
  { key: "competition", label: "比賽", dot: "bg-rose-400", chip: "bg-rose-500/15 text-rose-300" },
  { key: "other", label: "其他", dot: "bg-slate-400", chip: "bg-slate-500/15 text-slate-300" },
];

export const eventType = (k: string) =>
  EVENT_TYPES.find((e) => e.key === k) ?? EVENT_TYPES[3];

export const PART_STATUSES: {
  key: PartStatus;
  label: string;
  chip: string;
}[] = [
  { key: "pending", label: "待老師審批", chip: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  { key: "approved", label: "已核准", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40" },
  { key: "ordered", label: "已下單", chip: "bg-blue-500/15 text-blue-300 border-blue-500/40" },
  { key: "arrived", label: "已到貨", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  { key: "rejected", label: "已駁回", chip: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
];

export const partStatus = (k: string) =>
  PART_STATUSES.find((p) => p.key === k) ?? PART_STATUSES[0];

export const EQUIPMENT_CATEGORIES = [
  "推進器",
  "相機",
  "纜線",
  "電子",
  "工具",
  "機構",
  "其他",
];

export const INPUT_CLS =
  "w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none";

/** 不強制滿寬的 select 樣式（工具列用） */
export const SELECT_CLS =
  "rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none";

export const BTN =
  "rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50";

export const BTN_GHOST =
  "rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white";

export const CHIP =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs";
