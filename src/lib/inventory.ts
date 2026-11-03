/**
 * 庫存位置系統（客戶端與伺服器共用的純函數）
 *
 * 位置代碼格式：
 * - 一般櫃：`<櫃號>-<格號>`，例如 `7-12`（7 號櫃第 12 個抽屜）、`8-1`
 * - 收納盒櫃（4、9、10、11）：`<櫃號>-<欄>-<列>`，欄由左到右（A、B…），列由上到下，
 *   例如 `4-A-14`、`10-B-3`。4 號 5×20、9 號 4×4、10 號 2×4、11 號 4×4（寬×高）
 *
 * 層架（1/2/3/5/6）由上往下數；7 號為 L 形抽屜櫃：左側直段 1–3 由上往下，
 * 底部橫段 4–18 由左到右；8 號只有一格（8-1）。
 */
import { tt } from "./i18n-core";

export type InventoryStatus = "in_stock" | "low" | "empty";
export type SlotKind = "shelf" | "drawer" | "bin" | "space";

export interface CabinetDef {
  id: string;
  kind: SlotKind;
  /** 一般櫃的格數（1..slots） */
  slots: number;
  /** 4 號大櫃的欄（A–E）×列（1–20） */
  grid?: { cols: number; rows: number };
}

export const CABINETS: CabinetDef[] = [
  { id: "1", kind: "shelf", slots: 3 },
  { id: "2", kind: "shelf", slots: 4 },
  { id: "3", kind: "shelf", slots: 4 },
  { id: "4", kind: "bin", slots: 100, grid: { cols: 5, rows: 20 } },
  { id: "5", kind: "shelf", slots: 5 },
  { id: "6", kind: "shelf", slots: 3 },
  { id: "7", kind: "drawer", slots: 18 },
  { id: "8", kind: "space", slots: 1 },
  { id: "9", kind: "bin", slots: 16, grid: { cols: 4, rows: 4 } },
  { id: "10", kind: "bin", slots: 8, grid: { cols: 2, rows: 4 } },
  { id: "11", kind: "bin", slots: 16, grid: { cols: 4, rows: 4 } },
];

export const cabinetById = (id: string) => CABINETS.find((c) => c.id === id);

export const GRID_COLS = ["A", "B", "C", "D", "E"];

export interface ParsedLocation {
  cabinet: string;
  /** 一般櫃的格號 */
  slot?: number;
  /** 4 號櫃 */
  col?: string;
  row?: number;
}

/** 解析使用者輸入的位置（容許空白、大小寫、省略連字號，如 "4a14"、"7 12"） */
export function parseLocation(input: string): ParsedLocation | null {
  const s = input.trim().toUpperCase().replace(/[\s_·.]+/g, "-").replace(/-+/g, "-");
  const grid = s.match(/^(\d+)-?([A-Z])-?(\d+)$/);
  if (grid) {
    const cab = cabinetById(String(Number(grid[1])));
    if (!cab?.grid) return null;
    const colIdx = GRID_COLS.indexOf(grid[2]);
    const row = Number(grid[3]);
    if (colIdx < 0 || colIdx >= cab.grid.cols || row < 1 || row > cab.grid.rows) return null;
    return { cabinet: cab.id, col: grid[2], row };
  }
  const plain = s.match(/^(\d+)-(\d+)$/);
  if (plain) {
    const cab = cabinetById(String(Number(plain[1])));
    if (!cab || cab.grid) return null;
    const slot = Number(plain[2]);
    if (slot < 1 || slot > cab.slots) return null;
    return { cabinet: cab.id, slot };
  }
  return null;
}

export function formatLocation(p: ParsedLocation): string {
  if (p.col && p.row) return `${p.cabinet}-${p.col}-${p.row}`;
  return `${p.cabinet}-${p.slot}`;
}

/** 正規化位置代碼；無效時回 null */
export function normalizeLocation(input: string): string | null {
  const p = parseLocation(input);
  return p ? formatLocation(p) : null;
}

export function slotKindLabel(kind: SlotKind): string {
  switch (kind) {
    case "shelf": return tt("層", "Shelf");
    case "drawer": return tt("抽屜", "Drawer");
    case "bin": return tt("收納盒", "Bin");
    default: return tt("格", "Space");
  }
}

/** 人看得懂的位置描述，例如「4 號櫃 · A 欄第 14 列」/ "Cabinet 4 · column A, row 14" */
export function describeLocation(code: string): string {
  const p = parseLocation(code);
  if (!p) return code;
  const cab = cabinetById(p.cabinet)!;
  const cabLabel = tt(`${cab.id} 號櫃`, `Cabinet ${cab.id}`);
  if (p.col && p.row) {
    return `${cabLabel} · ${tt(`${p.col} 欄第 ${p.row} 列（由上數）`, `column ${p.col}, row ${p.row} from top`)}`;
  }
  if (cab.slots === 1) return cabLabel;
  const kind = slotKindLabel(cab.kind);
  if (cab.kind === "shelf") return `${cabLabel} · ${tt(`由上數第 ${p.slot} 層`, `${kind} ${p.slot} from top`)}`;
  return `${cabLabel} · ${kind} ${p.slot}`;
}

/** 所有有效位置（給下拉選單用） */
export function slotOptions(cabinetId: string): string[] {
  const cab = cabinetById(cabinetId);
  if (!cab || cab.grid) return [];
  return Array.from({ length: cab.slots }, (_, i) => `${cab.id}-${i + 1}`);
}

export function compareLocations(a: string, b: string): number {
  const pa = parseLocation(a), pb = parseLocation(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa.cabinet !== pb.cabinet) return Number(pa.cabinet) - Number(pb.cabinet);
  if (pa.col && pb.col) return pa.col === pb.col ? (pa.row ?? 0) - (pb.row ?? 0) : pa.col.localeCompare(pb.col);
  return (pa.slot ?? 0) - (pb.slot ?? 0);
}

export const INVENTORY_STATUSES: {
  key: InventoryStatus;
  zh: string;
  en: string;
  color: string;
  label: string;
}[] = [
  { key: "in_stock", zh: "有庫存", en: "In stock", color: "#00c875", get label() { return tt(this.zh, this.en); } },
  { key: "low", zh: "快用完", en: "Low", color: "#fdab3d", get label() { return tt(this.zh, this.en); } },
  { key: "empty", zh: "沒有了", en: "Empty", color: "#df2f4a", get label() { return tt(this.zh, this.en); } },
];

export const inventoryStatus = (k: string) =>
  INVENTORY_STATUSES.find((s) => s.key === k) ?? INVENTORY_STATUSES[0];

export const isInventoryStatus = (v: unknown): v is InventoryStatus =>
  v === "in_stock" || v === "low" || v === "empty";

export const INVENTORY_CATEGORIES: { zh: string; en: string }[] = [
  { zh: "螺絲五金", en: "Fasteners" },
  { zh: "電子零件", en: "Electronics" },
  { zh: "接頭端子", en: "Connectors" },
  { zh: "線材", en: "Cables & wire" },
  { zh: "防水密封", en: "Seals & waterproofing" },
  { zh: "機構零件", en: "Mechanical parts" },
  { zh: "工具", en: "Tools" },
  { zh: "耗材", en: "Consumables" },
  { zh: "其他", en: "Other" },
];

export interface InventoryItem {
  id: number;
  name: string;
  spec: string;
  category: string;
  note: string;
  status: InventoryStatus;
  locations: string[];
  has_photo: boolean;
  status_note: string;
  status_at: string | null;
  status_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryReport {
  id: number;
  status: InventoryStatus;
  note: string;
  user_name: string | null;
  created_at: string;
}

export interface InventoryItemDetail extends InventoryItem {
  photo: string | null;
  reports: InventoryReport[];
}

/** 搜尋：名稱、規格、分類、備註、位置代碼都比對；多個關鍵字皆須符合 */
export function matchesSearch(item: InventoryItem, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const normLocs = item.locations.map((l) => l.toLowerCase());
  const text = [item.name, item.spec, item.category, item.note].join(" ").toLowerCase();
  const hay = [text, ...normLocs].join(" ");
  const squash = (v: string) => v.replace(/[×*]/g, "x").replace(/[\s-]+/g, "");
  const hayCompact = squash(hay);
  return words.every((w) => {
    // 看起來是位置代碼（7-1、4a14）就只比對完全相同的位置，避免 7-1 也找到 7-12
    const loc = normalizeLocation(w);
    if (loc) return normLocs.includes(loc.toLowerCase()) || text.includes(w);
    if (hay.includes(w)) return true;
    const compact = squash(w);
    return compact.length > 0 && hayCompact.includes(compact);
  });
}

/** 到零件採買頁開新需求的網址（預先帶入資料） */
export function restockRequestHref(item: Pick<InventoryItem, "id" | "name" | "spec" | "status" | "locations">): string {
  const where = item.locations.join(", ");
  const statusText = item.status === "empty" ? tt("已用完", "empty") : tt("快用完", "running low");
  const purpose = tt(
    `庫存補貨：${statusText}（位置 ${where || "未指定"}）`,
    `Restock: ${statusText} (location ${where || "not set"})`
  );
  const q = new URLSearchParams({ new: "1", name: item.name, spec: item.spec, purpose, from_inventory: String(item.id) });
  return `/parts?${q.toString()}`;
}
