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
  mech: "border-transparent bg-transparent text-foreground",
  elec: "border-transparent bg-transparent text-foreground",
  sw: "border-transparent bg-transparent text-foreground",
  pilot: "border-transparent bg-transparent text-foreground",
  general: "border-transparent bg-transparent text-foreground",
};

export const GROUP_COLORS = ["#579bfc", "#00c875", "#a25ddc", "#ff642e", "#ffcb00"] as const;

export const groupColor = (index: number) => GROUP_COLORS[index % GROUP_COLORS.length];

export const PRIORITIES: { key: Priority; zh: string; en: string; dot: string; color: string; label: string }[] = [
  { key: "high", zh: "高", en: "High", dot: "bg-[#401694]", color: "#401694", get label() { return tt(this.zh, this.en); } },
  { key: "medium", zh: "中", en: "Med", dot: "bg-[#5559df]", color: "#5559df", get label() { return tt(this.zh, this.en); } },
  { key: "low", zh: "低", en: "Low", dot: "bg-[#579bfc]", color: "#579bfc", get label() { return tt(this.zh, this.en); } },
];

export const priorityLabel = (k: string) => {
  const p = PRIORITIES.find((x) => x.key === k);
  return p ? tt(p.zh, p.en) : k;
};

export const priorityDot = (k: string) =>
  PRIORITIES.find((p) => p.key === k)?.dot ?? "bg-gray-400";

export const STATUSES: { key: TaskStatus; zh: string; en: string; color: string; label: string }[] = [
  { key: "todo", zh: "待辦", en: "To Do", color: "#c4c4c4", get label() { return tt(this.zh, this.en); } },
  { key: "doing", zh: "進行中", en: "In Progress", color: "#fdab3d", get label() { return tt(this.zh, this.en); } },
  { key: "done", zh: "已完成", en: "Done", color: "#00c875", get label() { return tt(this.zh, this.en); } },
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
  { key: "meeting", zh: "例會", en: "Meeting", dot: "bg-[#0073ea]", chip: "border-transparent bg-[#0073ea] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "watertest", zh: "水測", en: "Water Test", dot: "bg-[#579bfc]", chip: "border-transparent bg-[#579bfc] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "competition", zh: "比賽", en: "Competition", dot: "bg-[#df2f4a]", chip: "border-transparent bg-[#df2f4a] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "other", zh: "其他", en: "Other", dot: "bg-[#c4c4c4]", chip: "border-transparent bg-[#c4c4c4] text-[#323338]", get label() { return tt(this.zh, this.en); } },
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
  color: string;
  chip: string;
  label: string;
}[] = [
  { key: "pending", zh: "待老師審批", en: "Awaiting Teacher", color: "#fdab3d", chip: "border-transparent bg-[#fdab3d] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "approved", zh: "已核准", en: "Approved", color: "#579bfc", chip: "border-transparent bg-[#579bfc] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "ordered", zh: "已下單", en: "Ordered", color: "#5559df", chip: "border-transparent bg-[#5559df] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "arrived", zh: "已到貨", en: "Arrived", color: "#00c875", chip: "border-transparent bg-[#00c875] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "rejected", zh: "已駁回", en: "Rejected", color: "#df2f4a", chip: "border-transparent bg-[#df2f4a] text-white", get label() { return tt(this.zh, this.en); } },
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
  color: string;
  chip: string;
  label: string;
}[] = [
  { key: "pending_leader", zh: "待隊長審批", en: "Leader Review", color: "#fdab3d", chip: "border-transparent bg-[#fdab3d] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "pending_teacher", zh: "待老師審批", en: "Teacher Review", color: "#a25ddc", chip: "border-transparent bg-[#a25ddc] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "active", zh: "進行中", en: "Active", color: "#fdab3d", chip: "border-transparent bg-[#fdab3d] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "approved", zh: "已核准", en: "Approved", color: "#579bfc", chip: "border-transparent bg-[#579bfc] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "late", zh: "遲交", en: "Late", color: "#df2f4a", chip: "border-transparent bg-[#df2f4a] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "completed", zh: "已完成", en: "Completed", color: "#00c875", chip: "border-transparent bg-[#00c875] text-white", get label() { return tt(this.zh, this.en); } },
  { key: "rejected", zh: "已駁回", en: "Rejected", color: "#df2f4a", chip: "border-transparent bg-[#df2f4a] text-white", get label() { return tt(this.zh, this.en); } },
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
  "h-8 w-full min-w-0 rounded-[4px] border border-input bg-card px-2.5 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const SELECT_CLS =
  "h-8 rounded-[4px] border border-input bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const BTN =
  "inline-flex h-8 items-center justify-center rounded-[4px] bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#0060b9] disabled:pointer-events-none disabled:opacity-50";

export const BTN_GHOST =
  "inline-flex h-8 items-center justify-center rounded-[4px] px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50";

export const PANEL =
  "rounded-[16px] border border-border bg-card";

export const CHIP =
  "inline-flex h-5 items-center gap-1 rounded-4xl border border-border bg-secondary px-2 text-xs font-medium text-secondary-foreground";

/** 各駝峰式輔助函數給元件直接用：subteamLabel/partStatus/cycleStatus/eventType/statusLabel/priorityLabel/partStatusLabel/cycleStatusLabel/eventTypeLabel/priorityDot/subteamLabel */
export const labelFns = true;
