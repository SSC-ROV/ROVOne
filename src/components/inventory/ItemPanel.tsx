"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PencilIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { tt } from "@/lib/i18n-core";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api-client";
import { matchesSearch, type InventoryItem, type InventoryItemDetail } from "@/lib/inventory";
import { useDialogs } from "@/components/ui/Dialogs";
import ItemForm, { EMPTY_ITEM, type ItemFormValue } from "./ItemForm";
import LocationEditor from "./LocationEditor";
import { StatusPill } from "./shared";

type Mode = { kind: "idle" } | { kind: "existing"; item: InventoryItem } | { kind: "new"; name: string };

/**
 * 新增 / 放置物品面板：
 * 1. 在搜尋框輸入 → 下拉選單列出現有物品
 * 2. 選現有物品 → 直接設定它放在哪裡
 * 3. 找不到 → 「新增物品」並帶入輸入的名稱
 */
export default function ItemPanel({
  items,
  onChanged,
  onClose,
  initialQuery = "",
  autoFocus = true,
}: {
  items: InventoryItem[];
  onChanged: () => Promise<void> | void;
  /** Omit to hide the close button (e.g. when the panel is the whole page). */
  onClose?: () => void;
  initialQuery?: string;
  /** Focus the search box on mount (off on the standalone page, so phones don't pop the keyboard). */
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const { toast } = useDialogs();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  /** Full record (with photo) of the picked item while its details are being edited. */
  const [editing, setEditing] = useState<InventoryItemDetail | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const matches = useMemo(() => {
    const list = q.trim() ? items.filter((i) => matchesSearch(i, q)) : items;
    return list.slice(0, 8);
  }, [items, q]);
  // 選項：符合的現有物品 + 最後一個「新增」
  const optionCount = matches.length + 1;

  function pickExisting(item: InventoryItem) {
    setEditing(null);
    setMode({ kind: "existing", item });
    setQ(item.name);
    setOpen(false);
  }

  function pickNew() {
    setMode({ kind: "new", name: q.trim() });
    setOpen(false);
  }

  function choose(index: number) {
    if (index < matches.length) pickExisting(matches[index]);
    else pickNew();
  }

  function reset() {
    setEditing(null);
    setMode({ kind: "idle" });
    setQ("");
    setActive(0);
    setOpen(true);
    inputRef.current?.focus();
  }

  async function startEdit(item: InventoryItem) {
    setLoadingEdit(true);
    try {
      const res = await api<{ item: InventoryItemDetail }>(`/api/inventory/${item.id}`);
      setEditing(res.item);
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setLoadingEdit(false);
    }
  }

  async function saveDetails(v: ItemFormValue) {
    if (!editing) return;
    setBusy(true);
    try {
      const { status: _status, ...rest } = v;
      void _status;
      await api(`/api/inventory/${editing.id}`, { method: "PATCH", body: JSON.stringify({ ...rest, unit_price: Number(rest.unit_price) }) });
      toast(tt(`已儲存「${v.name}」`, `Saved ${v.name}`));
      await onChanged();
      reset();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setBusy(false);
    }
  }

  async function create(v: ItemFormValue) {
    setBusy(true);
    try {
      const res = await api<{ restock?: { created: boolean } | null }>("/api/inventory", { method: "POST", body: JSON.stringify({ ...v, unit_price: Number(v.unit_price) }) });
      toast(
        res.restock?.created
          ? tt(`已新增「${v.name}」，並自動送出採購申請`, `Added ${v.name}. A purchase request was sent automatically.`)
          : tt(`已新增「${v.name}」`, `Added ${v.name}`)
      );
      await onChanged();
      reset();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[16px] border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{tt("新增或放置物品", "Add or place an item")}</h2>
          <p className="text-sm text-muted-foreground">
            {tt("先搜尋看看有沒有這個物品。有的話直接設定位置或編輯資料，沒有就新增。", "Search first. If the item already exists, set where it is or edit its details. If not, add it.")}
          </p>
        </div>
        {onClose && (
          <button type="button" aria-label={t("取消")} className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={onClose}>
            <XIcon className="size-5" />
          </button>
        )}
      </div>

      {/* 搜尋 + 下拉選單 */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id="panel-search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          autoComplete="off"
          className="h-10 w-full rounded-[6px] border border-input bg-background pr-9 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder={tt("輸入物品名稱，例如：M3 螺絲", "Type an item name, e.g. M3 screw")}
          value={q}
          onFocus={() => mode.kind === "idle" && setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
            if (mode.kind !== "idle") setMode({ kind: "idle" });
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, optionCount - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              choose(active);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {q && (
          <button type="button" aria-label={tt("清除", "Clear")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted" onClick={reset}>
            <XIcon className="size-4" />
          </button>
        )}

        {open && (
          <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-[6px] border border-border bg-card py-1 shadow-lg">
            {matches.length === 0 && q.trim() && (
              <li className="px-3 py-2 text-xs text-muted-foreground">{tt("沒有符合的物品", "No matching items")}</li>
            )}
            {matches.map((i, idx) => (
              <li
                key={i.id}
                id={`${listId}-${idx}`}
                role="option"
                aria-selected={active === idx}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${active === idx ? "bg-muted" : ""}`}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => { e.preventDefault(); pickExisting(i); }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.name}</p>
                  {i.spec && <p className="truncate text-xs text-muted-foreground">{i.spec}</p>}
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {i.locations.length ? i.locations.join(", ") : tt("未指定位置", "no location")}
                </span>
              </li>
            ))}
            <li
              id={`${listId}-${matches.length}`}
              role="option"
              aria-selected={active === matches.length}
              className={`flex cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-sm font-medium text-primary ${active === matches.length ? "bg-muted" : ""}`}
              onMouseEnter={() => setActive(matches.length)}
              onMouseDown={(e) => { e.preventDefault(); pickNew(); }}
            >
              <PlusIcon className="size-4" />
              {q.trim() ? tt(`新增物品「${q.trim()}」`, `Add new item "${q.trim()}"`) : tt("新增物品", "Add a new item")}
            </li>
          </ul>
        )}
      </div>

      {/* 現有物品：設定位置，或編輯完整資料 */}
      {mode.kind === "existing" && (
        <div className="space-y-3 rounded-[8px] border border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/inventory/${mode.item.id}`} className="font-semibold hover:underline">{mode.item.name}</Link>
            {mode.item.spec && <span className="text-sm text-muted-foreground">{mode.item.spec}</span>}
            <StatusPill status={mode.item.status} />
            {!editing && (
              <button
                type="button"
                disabled={loadingEdit}
                className="ml-auto inline-flex h-7 items-center gap-1 rounded-[4px] border border-border px-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                onClick={() => startEdit(mode.item)}
              >
                <PencilIcon className="size-3.5" /> {loadingEdit ? tt("載入中…", "Loading…") : tt("編輯資料", "Edit details")}
              </button>
            )}
          </div>
          {editing ? (
            <ItemForm
              key={`edit-${editing.id}`}
              initial={{
                name: editing.name,
                spec: editing.spec,
                tags: editing.tags,
                note: editing.note,
                buy_link: editing.buy_link,
                unit_price: editing.unit_price ? String(editing.unit_price) : "",
                locations: editing.locations,
                status: editing.status,
              }}
              initialPhoto={editing.photo}
              submitLabel={tt("儲存", "Save")}
              busy={busy}
              onSubmit={saveDetails}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <LocationEditor
              key={mode.item.id}
              item={mode.item}
              onCancel={reset}
              onSaved={async () => {
                await onChanged();
                reset();
              }}
            />
          )}
        </div>
      )}

      {/* 新物品 */}
      {mode.kind === "new" && (
        <div className="rounded-[8px] border border-border p-4">
          <ItemForm
            key={mode.name}
            initial={{ ...EMPTY_ITEM, name: mode.name }}
            showStatus
            submitLabel={tt("新增物品", "Add item")}
            busy={busy}
            onSubmit={create}
            onCancel={reset}
          />
        </div>
      )}
    </section>
  );
}
