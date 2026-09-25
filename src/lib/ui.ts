import { tt } from "./i18n-core";
import type {
  CycleStatus,
  EventType,
  PartStatus,
  Priority,
  Subteam,
  TaskStatus,
} from "./types";

export const SUBTEAMS: { key: Subteam; zh: string; en: string; label: string }[] = [
  { key: "mech", zh: "機械", en: "Mechanical", get label() { return tt(this.zh, this.en); } },
  { key: "elec", zh: "電控", en: "Electronics", get label() { return tt(this.zh, this.en); } },
  { key: "sw", zh: "軟體", en: "Software", get label() { return tt(this.zh, this.en); } },
  { key: "pilot", zh: "操控", en: "Pilot", get label() { return tt(this.zh, this.en); } },
  { key: "general", zh: "全隊", en: "Team", get label() { return tt(this.zh, this.en); } },
];

export const subteamLabel = (k: string) => {
  const s = SUBTEAMS.find((x) => x.key === k);
  return s ? tt(s.zh, s.en) : k;
};

export const SUBTEAM_CLS: Record<string, string> = {
  mech: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  elec: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  sw: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  pilot: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  general: "border-slate-600/60 bg-slate-500/10 text-slate-300",
};

export const PRIORITIES: { key: Priority; zh: string; en: string; dot: string; label: string }[] = [
  { key: "high", zh: "高", en: "High", dot: "bg-rose-500", get label() { return tt(this.zh, this.en); } },
  { key: "medium", zh: "中", en: "Med", dot: "bg-amber-400", get label() { return tt(this.zh, this.en); } },
  { key: "low", zh: "低", en: "Low", dot: "bg-slate-500", get label() { return tt(this.zh, this.en); } },
];

export const priorityLabel = (k: string) => {
  const p = PRIORITIES.find((x) => x.key === k);
  return p ? tt(p.zh, p.en) : k;
};

export const priorityDot = (k: string) =>
  PRIORITIES.find((p) => p.key === k)?.dot ?? "bg-slate-500";

export const STATUSES: { key: TaskStatus; zh: string; en: string; label: string }[] = [
  { key: "todo", zh: "待辦", en: "To Do", get label() { return tt(this.zh, this.en); } },
  { key: "doing", zh: "進行中", en: "In Progress", get label() { return tt(this.zh, this.en); } },
  { key: "done", zh: "已完成", en: "Done", get label() { return tt(this.zh, this.en); } },
];

export const statusLabel = (k: string) => {
  const s = STATUSES.find((x) => x.key === k);
  return s ? tt(s.zh, s.en) : k;
};

export const EVENT_TYPES: {
  key: EventType;
  zh: string;
  en: string;
  dot: string;
  chip: string;
  label: string;
}[] = [
  { key: "meeting", zh: "例會", en: "Meeting", dot: "bg-cyan-400", chip: "bg-cyan-500/15 text-cyan-300", get label() { return tt(this.zh, this.en); } },
  { key: "watertest", zh: "水測", en: "Water Test", dot: "bg-sky-400", chip: "bg-sky-500/15 text-sky-300", get label() { return tt(this.zh, this.en); } },
  { key: "competition", zh: "比賽", en: "Competition", dot: "bg-rose-400", chip: "bg-rose-500/15 text-rose-300", get label() { return tt(this.zh, this.en); } },
  { key: "other", zh: "其他", en: "Other", dot: "bg-slate-400", chip: "bg-slate-500/15 text-slate-300", get label() { return tt(this.zh, this.en); } },
];

export const eventType = (k: string) =>
  EVENT_TYPES.find((e) => e.key === k) ?? EVENT_TYPES[3];

export const eventTypeLabel = (k: string) => {
  const e = eventType(k);
  return tt(e.zh, e.en);
};

export const PART_STATUSES: {
  key: PartStatus;
  zh: string;
  en: string;
  chip: string;
  label: string;
}[] = [
  { key: "pending", zh: "待老師審批", en: "Awaiting Teacher", chip: "bg-amber-500/15 text-amber-300 border-amber-500/40", get label() { return tt(this.zh, this.en); } },
  { key: "approved", zh: "已核准", en: "Approved", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40", get label() { return tt(this.zh, this.en); } },
  { key: "ordered", zh: "已下單", en: "Ordered", chip: "bg-blue-500/15 text-blue-300 border-blue-500/40", get label() { return tt(this.zh, this.en); } },
  { key: "arrived", zh: "已到貨", en: "Arrived", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", get label() { return tt(this.zh, this.en); } },
  { key: "rejected", zh: "已駁回", en: "Rejected", chip: "bg-rose-500/15 text-rose-300 border-rose-500/40", get label() { return tt(this.zh, this.en); } },
];

export const partStatus = (k: string) =>
  PART_STATUSES.find((p) => p.key === k) ?? PART_STATUSES[0];

export const partStatusLabel = (k: string) => {
  const p = partStatus(k);
  return tt(p.zh, p.en);
};

export const CYCLE_STATUSES: {
  key: CycleStatus;
  zh: string;
  en: string;
  chip: string;
  label: string;
}[] = [
  { key: "pending_leader", zh: "待隊長審批", en: "Leader Review", chip: "border-amber-500/40 bg-amber-500/10 text-amber-300", get label() { return tt(this.zh, this.en); } },
  { key: "pending_teacher", zh: "待老師審批", en: "Teacher Review", chip: "border-violet-500/40 bg-violet-500/10 text-violet-300", get label() { return tt(this.zh, this.en); } },
  { key: "active", zh: "進行中", en: "Active", chip: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300", get label() { return tt(this.zh, this.en); } },
  { key: "approved", zh: "已核准", en: "Approved", chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", get label() { return tt(this.zh, this.en); } },
  { key: "late", zh: "遲交", en: "Late", chip: "border-orange-400/40 bg-orange-400/10 text-orange-300", get label() { return tt(this.zh, this.en); } },
  { key: "completed", zh: "已完成", en: "Completed", chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", get label() { return tt(this.zh, this.en); } },
  { key: "rejected", zh: "已駁回", en: "Rejected", chip: "border-rose-500/40 bg-rose-500/10 text-rose-300", get label() { return tt(this.zh, this.en); } },
];

export const cycleStatus = (k: string) =>
  CYCLE_STATUSES.find((c) => c.key === k) ?? CYCLE_STATUSES[0];

export const cycleStatusLabel = (k: string) => {
  const c = cycleStatus(k);
  return tt(c.zh, c.en);
};

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
  "w-full rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50";

/** 不強制滿寬的 select 樣式（工具列用） */
export const SELECT_CLS =
  "rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink transition focus:border-primary focus:outline-none";

export const BTN =
  "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover active:bg-primary-focus disabled:cursor-not-allowed disabled:opacity-50";

export const BTN_GHOST =
  "rounded-lg border border-hairline bg-surface-1 px-3 py-1.5 text-sm text-ink transition hover:border-hairline-strong hover:bg-surface-2";

export const CHIP =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs";

/** 各駝峰式輔助函數給元件直接用：subteamLabel/partStatus/cycleStatus/eventType/statusLabel/priorityLabel/partStatusLabel/cycleStatusLabel/eventTypeLabel/priorityDot/subteamLabel */
export const labelFns = true;
