"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { BTN, BTN_GHOST, INPUT_CLS, SELECT_CLS } from "@/lib/ui";
import {
  CABINETS,
  GRID_COLS,
  INVENTORY_CATEGORIES,
  INVENTORY_STATUSES,
  compareLocations,
  describeLocation,
  normalizeLocation,
  slotKindLabel,
  slotOptions,
  type InventoryStatus,
} from "@/lib/inventory";

export type ItemFormValue = {
  name: string;
  spec: string;
  category: string;
  note: string;
  locations: string[];
  status: InventoryStatus;
  /** undefined = 不變；null = 移除；字串 = 新照片 */
  photo?: string | null;
};

export const EMPTY_ITEM: ItemFormValue = {
  name: "",
  spec: "",
  category: "",
  note: "",
  locations: [],
  status: "in_stock",
};

/** 位置挑選器：選櫃號，再選層/抽屜/收納盒；也能直接輸入代碼（例如 4-A-14） */
export function LocationPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [cab, setCab] = useState("1");
  const [slot, setSlot] = useState("1-1");
  const [col, setCol] = useState("A");
  const [row, setRow] = useState("1");
  const [typed, setTyped] = useState("");
  const [typedErr, setTypedErr] = useState(false);
  const def = CABINETS.find((c) => c.id === cab)!;

  function add(code: string | null) {
    if (!code) return;
    if (!value.includes(code)) onChange([...value, code].sort(compareLocations));
  }

  function pickCabinet(id: string) {
    setCab(id);
    const opts = slotOptions(id);
    if (opts.length) setSlot(opts[0]);
  }

  const current = def.grid ? `${cab}-${col}-${row}` : slot;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={tt("櫃號", "Cabinet")} className={`${SELECT_CLS} w-28`} value={cab} onChange={(e) => pickCabinet(e.target.value)}>
          {CABINETS.map((c) => (
            <option key={c.id} value={c.id}>{tt(`${c.id} 號櫃`, `Cabinet ${c.id}`)}</option>
          ))}
        </select>
        {def.grid ? (
          <>
            <select aria-label={tt("欄", "Column")} className={`${SELECT_CLS} w-24`} value={col} onChange={(e) => setCol(e.target.value)}>
              {GRID_COLS.slice(0, def.grid.cols).map((c) => (
                <option key={c} value={c}>{tt(`${c} 欄`, `Col ${c}`)}</option>
              ))}
            </select>
            <select aria-label={tt("列（由上數）", "Row (from top)")} className={`${SELECT_CLS} w-28`} value={row} onChange={(e) => setRow(e.target.value)}>
              {Array.from({ length: def.grid.rows }, (_, i) => (
                <option key={i} value={String(i + 1)}>{tt(`第 ${i + 1} 列`, `Row ${i + 1}`)}</option>
              ))}
            </select>
          </>
        ) : def.slots > 1 ? (
          <select aria-label={slotKindLabel(def.kind)} className={`${SELECT_CLS} w-32`} value={slot} onChange={(e) => setSlot(e.target.value)}>
            {slotOptions(cab).map((code) => (
              <option key={code} value={code}>{slotKindLabel(def.kind)} {code.split("-")[1]}</option>
            ))}
          </select>
        ) : null}
        <button type="button" className={BTN_GHOST + " border border-border"} onClick={() => add(def.slots === 1 ? `${cab}-1` : current)}>
          {tt("＋ 加入", "+ Add")} {def.slots === 1 ? `${cab}-1` : current}
        </button>
        <span className="text-xs text-muted-foreground">{tt("或輸入", "or type")}</span>
        <input
          className={`${INPUT_CLS.replace("w-full", "w-28")} ${typedErr ? "border-danger" : ""}`}
          placeholder="4-A-14"
          aria-label={tt("輸入位置代碼", "Type a location code")}
          value={typed}
          onChange={(e) => { setTyped(e.target.value); setTypedErr(false); }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const code = normalizeLocation(typed);
            if (!code) { setTypedErr(true); return; }
            add(code); setTyped("");
          }}
        />
      </div>
      {typedErr && <p className="text-xs text-danger">{tt("沒有這個位置。格式：7-12、8-1、4-A-14", "That location doesn't exist. Use 7-12, 8-1 or 4-A-14")}</p>}
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-xs text-muted-foreground">{tt("還沒選位置", "No location yet")}</span>}
        {value.map((code) => (
          <span key={code} className="inline-flex items-center gap-1 rounded-[4px] bg-[#cce5ff] px-2 py-0.5 text-sm text-[#0060b9] dark:bg-[#0073ea]/25 dark:text-[#cce5ff]" title={describeLocation(code)}>
            <b className="font-mono">{code}</b>
            <button type="button" aria-label={tt(`移除 ${code}`, `Remove ${code}`)} className="rounded hover:bg-black/10" onClick={() => onChange(value.filter((v) => v !== code))}>
              <XIcon className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      {value.length > 1 && (
        <p className="text-xs text-[#c27c0e]">
          {tt("⚠ 同一物品放在多個位置會被標記，建議集中放一處", "⚠ Items in more than one place get flagged. Try to keep them in one spot.")}
        </p>
      )}
    </div>
  );
}

/** 把照片縮到最長邊 640px 的 JPEG，避免資料庫塞大檔 */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("讀不到這張照片"));
      i.src = url;
    });
    const scale = Math.min(1, 640 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ItemForm({
  initial,
  initialPhoto,
  submitLabel,
  busy,
  showStatus,
  onSubmit,
  onCancel,
}: {
  initial: ItemFormValue;
  initialPhoto?: string | null;
  submitLabel: string;
  busy?: boolean;
  showStatus?: boolean;
  onSubmit: (v: ItemFormValue) => void;
  onCancel?: () => void;
}) {
  const { t, lang } = useI18n();
  const [v, setV] = useState<ItemFormValue>(initial);
  const [preview, setPreview] = useState<string | null>(initialPhoto ?? null);
  const [photoErr, setPhotoErr] = useState("");
  const set = <K extends keyof ItemFormValue>(k: K, val: ItemFormValue[K]) => setV((p) => ({ ...p, [k]: val }));

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoErr("");
    try {
      const data = await shrinkPhoto(file);
      setPreview(data);
      set("photo", data);
    } catch (err) {
      setPhotoErr(t((err as Error).message));
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.name.trim()) onSubmit(v);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">{tt("名稱 *", "Name *")}</span>
          <input id="inv-name" className={INPUT_CLS} placeholder={tt("例如：M3 內六角螺絲", "e.g. M3 hex socket screw")} value={v.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">{tt("規格 / 尺寸", "Size / spec")}</span>
          <input id="inv-spec" className={INPUT_CLS} placeholder={tt("例如：M3 × 10 mm 不鏽鋼", "e.g. M3 × 10 mm, stainless")} value={v.spec} onChange={(e) => set("spec", e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">{tt("分類", "Category")}</span>
          <input id="inv-category" className={INPUT_CLS} list="inv-category-list" placeholder={tt("選擇或輸入", "Pick or type")} value={v.category} onChange={(e) => set("category", e.target.value)} />
          <datalist id="inv-category-list">
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c.en} value={lang === "zh" ? c.zh : c.en} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">{tt("備註", "Note")}</span>
          <input id="inv-note" className={INPUT_CLS} placeholder={tt("選填", "Optional")} value={v.note} onChange={(e) => set("note", e.target.value)} />
        </label>
      </div>

      <div className="grid gap-1">
        <span className="text-xs font-medium text-muted-foreground">{tt("放在哪裡", "Where it's stored")}</span>
        <LocationPicker value={v.locations} onChange={(locs) => set("locations", locs)} />
      </div>

      {showStatus && (
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">{tt("目前庫存", "Current stock")}</span>
          <div className="flex flex-wrap gap-2">
            {INVENTORY_STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={v.status === s.key}
                className="h-8 rounded-[4px] border px-3 text-sm font-medium"
                style={v.status === s.key ? { background: s.color, borderColor: s.color, color: "#fff" } : { borderColor: "var(--border)" }}
                onClick={() => set("status", s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-1">
        <span className="text-xs font-medium text-muted-foreground">{tt("照片（選填）", "Photo (optional)")}</span>
        <div className="flex flex-wrap items-center gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-16 rounded-[4px] border border-border object-cover" />
          )}
          <label className="inline-flex h-8 cursor-pointer items-center rounded-[4px] border border-border px-2.5 text-sm hover:bg-muted">
            {preview ? tt("換照片", "Change photo") : tt("上傳照片", "Upload photo")}
            <input id="inv-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </label>
          {preview && (
            <button type="button" className="text-xs text-muted-foreground hover:text-rose-400" onClick={() => { setPreview(null); set("photo", null); }}>
              {tt("移除照片", "Remove photo")}
            </button>
          )}
          {photoErr && <span className="text-xs text-danger">{photoErr}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className={BTN} disabled={busy || !v.name.trim()}>{busy ? tt("儲存中…", "Saving…") : submitLabel}</button>
        {onCancel && (
          <button type="button" className={BTN_GHOST} onClick={onCancel}>{t("取消")}</button>
        )}
      </div>
    </form>
  );
}
