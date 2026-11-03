"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { tt } from "@/lib/i18n-core";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api-client";
import { BTN, BTN_GHOST } from "@/lib/ui";
import { matchesSearch, type InventoryItem } from "@/lib/inventory";
import { useDialogs } from "@/components/ui/Dialogs";
import ItemForm, { EMPTY_ITEM, LocationPicker, type ItemFormValue } from "./ItemForm";
import { LocationChip, StatusPill } from "./shared";

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
}: {
  items: InventoryItem[];
  onChanged: () => Promise<void> | void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useDialogs();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [locs, setLocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    const list = q.trim() ? items.filter((i) => matchesSearch(i, q)) : items;
    return list.slice(0, 8);
  }, [items, q]);
  // 選項：符合的現有物品 + 最後一個「新增」
  const optionCount = matches.length + 1;

  function pickExisting(item: InventoryItem) {
    setMode({ kind: "existing", item });
    setLocs(item.locations);
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
    setMode({ kind: "idle" });
    setQ("");
    setLocs([]);
    setActive(0);
    setOpen(true);
    inputRef.current?.focus();
  }

  async function saveLocations() {
    if (mode.kind !== "existing") return;
    setBusy(true);
    try {
      await api(`/api/inventory/${mode.item.id}`, { method: "PATCH", body: JSON.stringify({ locations: locs }) });
      toast(tt(`已更新「${mode.item.name}」的位置`, `Updated where ${mode.item.name} is`));
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
      await api("/api/inventory", { method: "POST", body: JSON.stringify(v) });
      toast(tt(`已新增「${v.name}」`, `Added ${v.name}`));
      await onChanged();
      reset();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setBusy(false);
    }
  }

  const locsChanged =
    mode.kind === "existing" &&
    (locs.length !== mode.item.locations.length || locs.some((l) => !mode.item.locations.includes(l)));

  return (
    <section className="space-y-4 rounded-[16px] border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{tt("新增或放置物品", "Add or place an item")}</h2>
          <p className="text-sm text-muted-foreground">
            {tt("先搜尋看看有沒有這個物品。有的話直接設定位置，沒有就新增。", "Search first. If the item already exists, just set where it is. If not, add it.")}
          </p>
        </div>
        <button type="button" aria-label={t("取消")} className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={onClose}>
          <XIcon className="size-5" />
        </button>
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

      {/* 現有物品：設定位置 */}
      {mode.kind === "existing" && (
        <div className="space-y-3 rounded-[8px] border border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/inventory/${mode.item.id}`} className="font-semibold hover:underline">{mode.item.name}</Link>
            {mode.item.spec && <span className="text-sm text-muted-foreground">{mode.item.spec}</span>}
            <StatusPill status={mode.item.status} />
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {tt("目前位置：", "Currently at:")}
            {mode.item.locations.length ? mode.item.locations.map((l) => <LocationChip key={l} code={l} />) : tt("未指定", "not set")}
          </p>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">{tt("放在哪裡", "Where it's stored")}</span>
            <LocationPicker value={locs} onChange={setLocs} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={BTN} disabled={busy || !locsChanged} onClick={saveLocations}>
              {busy ? tt("儲存中…", "Saving…") : tt("儲存位置", "Save location")}
            </button>
            <button type="button" className={BTN_GHOST} onClick={reset}>{tt("選別的物品", "Pick another item")}</button>
          </div>
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
