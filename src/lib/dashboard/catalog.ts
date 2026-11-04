// Shared (client + server) description of the customizable dashboard: widget types, sizes and
// per-widget settings. Rendering lives in src/components/dashboard; this file has no JSX so the
// API route can validate saved layouts against the same list.

/**
 * Apple-style widget sizes, in cells (columns × rows) of the 4-column desktop grid. Underneath, the
 * desktop grid has 12 columns (one size column = 3 grid columns), so a template can also give a
 * widget an exact width with `w` — the Jude template uses that to match the Float sheet.
 */
export type WidgetSize = "s" | "m" | "l" | "xl";

export const WIDGET_SIZES: { key: WidgetSize; cols: number; rows: number; zh: string; en: string }[] = [
  { key: "s", cols: 1, rows: 1, zh: "小", en: "Small" },
  { key: "m", cols: 2, rows: 1, zh: "中", en: "Medium" },
  { key: "l", cols: 2, rows: 2, zh: "大", en: "Large" },
  { key: "xl", cols: 4, rows: 2, zh: "特大", en: "Extra large" },
];

export type GroupBy = "subteam" | "person";

export interface WidgetSettings {
  /** Custom heading; empty uses the widget's own name. */
  title?: string;
  /** Subteam key to show; empty or missing means every subteam. */
  subteam?: string;
  /** Only tasks assigned to the viewer. */
  mine?: boolean;
  /** Breakdown widgets: one row / series per subteam or per person. */
  groupBy?: GroupBy;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  /** Optional exact width in 12ths of the desktop grid; cleared when the size is changed. */
  w?: number;
  settings: WidgetSettings;
}

export const GRID_COLUMNS = 12;

/** Width in 12ths of the desktop grid. */
export function widgetSpan(w: Pick<WidgetConfig, "size" | "w">): number {
  return w.w ?? sizeDef(w.size).cols * 3;
}

export interface DashboardLayout {
  /** Template the layout was last reset to (for "Reset"). */
  template: TemplateKey;
  widgets: WidgetConfig[];
}

export type WidgetCategory = "numbers" | "tables" | "charts" | "team";

/** Which settings a widget understands, so the settings popover only shows those. */
export type SettingKey = "subteam" | "mine" | "groupBy";

export interface WidgetDef {
  type: string;
  category: WidgetCategory;
  zh: string;
  en: string;
  descZh: string;
  descEn: string;
  sizes: WidgetSize[];
  settings: SettingKey[];
}

const TASK_FILTERS: SettingKey[] = ["subteam", "mine"];

export const WIDGETS = [
  // ---- Numbers ----
  { type: "week-banner", category: "numbers", zh: "本週資訊", en: "This week", descZh: "今天日期、第幾週與本週起訖", descEn: "Today's date, the week number and this week's dates", sizes: ["m", "s"], settings: ["subteam"] },
  { type: "overall-progress", category: "numbers", zh: "整體進度", en: "Overall progress", descZh: "已完成任務的百分比", descEn: "Share of tasks done", sizes: ["s", "m"], settings: TASK_FILTERS },
  { type: "week-deadlines", category: "numbers", zh: "本週截止完成", en: "This week's deadlines done", descZh: "本週（一至日）到期的任務完成了幾個", descEn: "Tasks due Mon to Sun that are done", sizes: ["s", "m"], settings: TASK_FILTERS },
  { type: "overdue-count", category: "numbers", zh: "逾期", en: "Overdue", descZh: "已過截止日但未完成", descEn: "Past the due date, not done", sizes: ["s", "m"], settings: TASK_FILTERS },
  { type: "due-week-count", category: "numbers", zh: "七天內到期", en: "Due in 7 days", descZh: "今天起七天內到期的未完成任務", descEn: "Open tasks due in the next 7 days", sizes: ["s", "m"], settings: TASK_FILTERS },
  { type: "behind-count", category: "numbers", zh: "落後", en: "Behind", descZh: "還沒開始，但已用掉超過一半時間", descEn: "Not started, over half the time used", sizes: ["s", "m"], settings: TASK_FILTERS },
  { type: "ahead-behind", category: "numbers", zh: "超前（+）/ 落後（−）", en: "Ahead (+) / behind (−)", descZh: "已完成數減去至今應完成數", descEn: "Tasks done minus tasks due so far", sizes: ["s", "m"], settings: TASK_FILTERS },
  { type: "blocked-count", category: "numbers", zh: "卡住", en: "Blocked", descZh: "狀態為「卡住」的任務", descEn: "Tasks waiting on something", sizes: ["s", "m"], settings: TASK_FILTERS },
  { type: "countdown", category: "numbers", zh: "比賽倒數", en: "Competition countdown", descZh: "距離比賽還有幾天", descEn: "Days until the competition", sizes: ["s", "m"], settings: [] },
  { type: "waiting-for-you", category: "numbers", zh: "待你處理", en: "Waiting for you", descZh: "等你審批的專案與零件", descEn: "Projects and parts waiting for your approval", sizes: ["s", "m", "l"], settings: [] },
  // ---- Tables ----
  { type: "task-buckets", category: "tables", zh: "任務清單", en: "Task list", descZh: "依逾期、本週、之後分組的未完成任務", descEn: "Open tasks grouped into overdue, this week and later", sizes: ["l", "xl"], settings: TASK_FILTERS },
  { type: "week-deadlines-table", category: "tables", zh: "本週截止", en: "This week: deadlines", descZh: "週一到週日到期的任務與健康狀態", descEn: "Tasks due Mon to Sun with their health", sizes: ["m", "l", "xl"], settings: TASK_FILTERS },
  { type: "overdue-table", category: "tables", zh: "逾期清單", en: "Overdue list", descZh: "逾期任務與逾期天數", descEn: "Overdue tasks and how many days late", sizes: ["m", "l", "xl"], settings: TASK_FILTERS },
  { type: "next-two-weeks", category: "tables", zh: "未來兩週截止", en: "Next 2 weeks", descZh: "下週起兩週內到期的任務", descEn: "Deadlines in the two weeks after this one", sizes: ["m", "l", "xl"], settings: TASK_FILTERS },
  { type: "season-progress", category: "tables", zh: "整季進度", en: "Season progress", descZh: "每個組別或成員的完成度與逾期數", descEn: "Done, total and overdue per subteam or person", sizes: ["m", "l", "xl"], settings: ["subteam", "mine", "groupBy"] },
  { type: "week-progress", category: "tables", zh: "本週進度", en: "This week progress", descZh: "每個組別或成員本週的截止與完成", descEn: "This week's deadlines and finished tasks per group", sizes: ["m", "l", "xl"], settings: ["subteam", "mine", "groupBy"] },
  { type: "members-need-help", category: "team", zh: "需要幫忙的成員", en: "Members who need help", descZh: "有逾期或落後任務的成員", descEn: "People with overdue or behind tasks", sizes: ["m", "l", "xl"], settings: ["subteam"] },
  { type: "project-timeline", category: "team", zh: "專案時間軸", en: "Project timeline", descZh: "每個專案的起訖日期長條", descEn: "Start-to-end bars for every project", sizes: ["l", "xl"], settings: [] },
  { type: "project-progress", category: "team", zh: "專案進度", en: "Project progress", descZh: "進行中專案的完成度", descEn: "How far along active projects are", sizes: ["m", "l", "xl"], settings: [] },
  { type: "upcoming-events", category: "team", zh: "近期活動", en: "Upcoming events", descZh: "日曆上接下來的活動", descEn: "Next events on the calendar", sizes: ["m", "l"], settings: ["subteam"] },
  // ---- Charts ----
  { type: "task-health", category: "charts", zh: "任務健康度", en: "Task health", descZh: "逾期、落後、即將到期、正常、完成的比例", descEn: "Overdue, behind, due soon, on track and done", sizes: ["m", "l"], settings: TASK_FILTERS },
  { type: "deadlines-by-day", category: "charts", zh: "本週每日截止", en: "This week: deadlines by day", descZh: "本週每天到期的任務（錯過、未完成、完成）", descEn: "Each day's deadlines: missed, still open, done", sizes: ["m", "l", "xl"], settings: TASK_FILTERS },
  { type: "burn-up", category: "charts", zh: "累積完成圖", en: "Burn-up", descZh: "應完成數與實際完成數隨時間累積", descEn: "Tasks planned vs done over time", sizes: ["m", "l", "xl"], settings: TASK_FILTERS },
  { type: "deadlines-per-week", category: "charts", zh: "每週截止數", en: "Deadlines per week", descZh: "每週到期任務數，依組別或成員堆疊", descEn: "Deadlines each week, stacked by subteam or person", sizes: ["m", "l", "xl"], settings: ["subteam", "mine", "groupBy"] },
] as const satisfies readonly WidgetDef[];

export type WidgetType = (typeof WIDGETS)[number]["type"];

export const WIDGET_CATEGORIES: { key: WidgetCategory; zh: string; en: string }[] = [
  { key: "numbers", zh: "數字", en: "Numbers" },
  { key: "tables", zh: "表格", en: "Tables" },
  { key: "charts", zh: "圖表", en: "Charts" },
  { key: "team", zh: "團隊", en: "Team" },
];

export function widgetDef(type: string): WidgetDef | undefined {
  return (WIDGETS as readonly WidgetDef[]).find((w) => w.type === type);
}

export function sizeDef(size: WidgetSize) {
  return WIDGET_SIZES.find((s) => s.key === size) ?? WIDGET_SIZES[0];
}

export function newWidgetId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Templates ----

export type TemplateKey = "overview" | "jude" | "my-work";

type Seed = [WidgetType, WidgetSize, WidgetSettings?, number?];

export interface TemplateDef {
  key: TemplateKey;
  zh: string;
  en: string;
  descZh: string;
  descEn: string;
  /** `floatKey` is the subteam whose label is "Float" (empty if none). */
  build: (ctx: { floatKey: string }) => Seed[];
}

export const TEMPLATES: TemplateDef[] = [
  {
    key: "overview",
    zh: "總覽",
    en: "Overview",
    descZh: "原本的首頁：比賽倒數、任務清單、專案進度與近期活動。",
    descEn: "The classic home page: countdown, task list, project progress and upcoming events.",
    build: () => [
      ["countdown", "s"],
      ["overdue-count", "s"],
      ["due-week-count", "s"],
      ["waiting-for-you", "s"],
      ["task-buckets", "xl"],
      ["project-timeline", "xl"],
      ["project-progress", "l"],
      ["upcoming-events", "l"],
    ],
  },
  {
    key: "jude",
    zh: "Jude：甘特圖",
    en: "Jude: Gantt",
    descZh: "Float 組的甘特圖儀表板：進度數字、成員進度、四張圖表與截止清單。",
    descEn: "The Float Gantt dashboard: headline numbers, progress per person, four charts and deadline lists.",
    // Same arrangement as the "Float Gantt chart – Dashboard" sheet: header strip, six headline
    // numbers in one row, season | this-week tables, three charts, deadlines per week across the
    // full width, then the deadline lists (wide left, narrow right). Widths are 12ths of the grid.
    build: ({ floatKey }) => {
      const f: WidgetSettings = { subteam: floatKey };
      const byPerson: WidgetSettings = { subteam: floatKey, groupBy: "person" };
      return [
        ["week-banner", "m", { ...f, title: "Float Team Dashboard" }, 12],
        ["overall-progress", "s", f, 2],
        ["week-deadlines", "s", f, 2],
        ["overdue-count", "s", f, 2],
        ["behind-count", "s", f, 2],
        ["ahead-behind", "s", f, 2],
        ["blocked-count", "s", f, 2],
        ["season-progress", "m", { ...byPerson, title: "Season progress (all tasks)" }, 7],
        ["week-progress", "m", { ...byPerson, title: "This week (Mon to Sun)" }, 5],
        ["task-health", "l", f, 3],
        ["deadlines-by-day", "l", f, 4],
        ["burn-up", "l", { ...f, title: "Burn-up: tasks planned vs done" }, 5],
        ["deadlines-per-week", "xl", { ...byPerson, title: "Deadlines per week (week starting)" }, 12],
        ["week-deadlines-table", "l", { ...f, title: "This week: deadlines Mon to Sun" }, 7],
        ["overdue-table", "l", { ...f, title: "Overdue" }, 5],
        ["next-two-weeks", "l", { ...f, title: "Next 2 weeks: upcoming deadlines" }, 7],
        ["members-need-help", "l", { subteam: floatKey }, 5],
      ];
    },
  },
  {
    key: "my-work",
    zh: "我的工作",
    en: "My work",
    descZh: "只看指派給你的任務：你的逾期、本週截止與未來兩週。",
    descEn: "Only tasks assigned to you: your overdue work, this week's deadlines and the next two weeks.",
    build: () => {
      const mine: WidgetSettings = { mine: true };
      return [
        ["countdown", "s"],
        ["overdue-count", "s", mine],
        ["due-week-count", "s", mine],
        ["waiting-for-you", "s"],
        ["week-deadlines-table", "l", mine],
        ["overdue-table", "l", mine],
        ["next-two-weeks", "xl", mine],
        ["project-progress", "m"],
        ["upcoming-events", "m"],
      ];
    },
  },
];

/** Finds the subteam the team calls "Float" (by English or Chinese label). */
export function findFloatKey(subteams: { key: string; zh: string; en: string }[]): string {
  return subteams.find((s) => s.en.trim().toLowerCase() === "float" || s.zh.trim().toLowerCase() === "float")?.key ?? "";
}

export function buildTemplate(key: TemplateKey, subteams: { key: string; zh: string; en: string }[]): DashboardLayout {
  const tpl = TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
  return {
    template: tpl.key,
    widgets: tpl.build({ floatKey: findFloatKey(subteams) }).map(([type, size, settings, w]) => ({
      id: newWidgetId(),
      type,
      size,
      ...(w ? { w } : {}),
      settings: { ...(settings ?? {}) },
    })),
  };
}

// ---- Validation (used by the API before saving) ----

const MAX_WIDGETS = 60;

/** Cleans a layout sent by the browser. Returns null if it isn't a layout at all. */
export function sanitizeLayout(input: unknown): DashboardLayout | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { template?: unknown; widgets?: unknown };
  if (!Array.isArray(raw.widgets)) return null;
  const template = TEMPLATES.some((t) => t.key === raw.template) ? (raw.template as TemplateKey) : "overview";
  const seen = new Set<string>();
  const widgets: WidgetConfig[] = [];
  for (const item of raw.widgets.slice(0, MAX_WIDGETS)) {
    if (!item || typeof item !== "object") continue;
    const w = item as Record<string, unknown>;
    const def = widgetDef(String(w.type));
    if (!def) continue;
    let id = String(w.id ?? "").slice(0, 32);
    if (!id || seen.has(id)) id = newWidgetId();
    seen.add(id);
    const size = def.sizes.includes(w.size as WidgetSize) ? (w.size as WidgetSize) : def.sizes[0];
    const s = (w.settings && typeof w.settings === "object" ? w.settings : {}) as Record<string, unknown>;
    const settings: WidgetSettings = {};
    if (typeof s.title === "string" && s.title.trim()) settings.title = s.title.trim().slice(0, 80);
    if (def.settings.includes("subteam") && typeof s.subteam === "string" && s.subteam) settings.subteam = s.subteam.slice(0, 40);
    if (def.settings.includes("mine") && s.mine === true) settings.mine = true;
    if (def.settings.includes("groupBy") && (s.groupBy === "subteam" || s.groupBy === "person")) settings.groupBy = s.groupBy;
    const span = Number(w.w);
    const width = Number.isInteger(span) && span >= 1 && span <= GRID_COLUMNS ? { w: span } : {};
    widgets.push({ id, type: def.type as WidgetType, size, ...width, settings });
  }
  return { template, widgets };
}
