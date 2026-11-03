"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapIcon, MapPinIcon, PencilIcon, QrCodeIcon, SearchIcon, XIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { api } from "@/lib/api-client";
import { BTN_GHOST, SELECT_CLS } from "@/lib/ui";
import {
  CABINETS,
  INVENTORY_STATUSES,
  describeLocation,
  matchesSearch,
  parseLocation,
  restockRequestHref,
  type InventoryItem,
  type InventoryStatus,
} from "@/lib/inventory";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageEmpty, PageError, PageLoading } from "@/components/PageState";
import { BoardGroup } from "@/components/board/BoardGroup";
import { BoardHeader } from "@/components/board/BoardHeader";
import RoomMap, { type CabinetBadge } from "@/components/inventory/RoomMap";
import InventoryTabs from "@/components/inventory/InventoryTabs";
import LocationEditor from "@/components/inventory/LocationEditor";
import LocationDiagram from "@/components/inventory/LocationDiagram";
import { LocationChip, MultiLocationFlag, StatusPill, timeAgo } from "@/components/inventory/shared";

type Filter = "all" | InventoryStatus | "multi";

export default function InventoryPage() {
  const { t } = useI18n();
  const { toast } = useDialogs();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [cabinet, setCabinet] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [showMap, setShowMap] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await api<{ items: InventoryItem[] }>("/api/inventory");
    setItems(res.items);
  }

  useEffect(() => {
    let alive = true;
    api<{ items: InventoryItem[] }>("/api/inventory")
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        // 網址參數（?q=M3&status=low）與地圖顯示偏好在資料載入後套用
        const params = new URLSearchParams(window.location.search);
        const initialQ = params.get("q");
        if (initialQ) setQ(initialQ);
        const f = params.get("status");
        if (f === "low" || f === "empty" || f === "in_stock" || f === "multi") setFilter(f);
        try {
          if (localStorage.getItem("rov_inv_map") === "0") setShowMap(false);
        } catch { /* ignore */ }
      })
      .catch((err: Error) => alive && setError(err.message));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const categories = useMemo(
    () => [...new Set((items ?? []).map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );

  const visible = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (filter === "multi" ? i.locations.length < 2 : filter !== "all" && i.status !== filter) return false;
      if (category !== "all" && i.category !== category) return false;
      if (cabinet && !i.locations.some((l) => parseLocation(l)?.cabinet === cabinet)) return false;
      return matchesSearch(i, q);
    });
  }, [items, filter, category, cabinet, q]);

  const badges = useMemo(() => {
    const out: Record<string, CabinetBadge> = {};
    for (const i of items ?? []) {
      if (i.status === "in_stock") continue;
      const cabs = new Set(i.locations.map((l) => parseLocation(l)?.cabinet).filter(Boolean) as string[]);
      for (const c of cabs) {
        out[c] ??= { low: 0, empty: 0 };
        out[c][i.status === "low" ? "low" : "empty"]++;
      }
    }
    return out;
  }, [items]);

  if (error) return <PageError message={t(error)} />;
  if (!items) return <PageLoading label={t("載入中…")} />;

  const counts = {
    all: items.length,
    in_stock: items.filter((i) => i.status === "in_stock").length,
    low: items.filter((i) => i.status === "low").length,
    empty: items.filter((i) => i.status === "empty").length,
    multi: items.filter((i) => i.locations.length > 1).length,
  };
  const searching = q.trim().length > 0 || filter !== "all" || category !== "all";
  const highlight = searching ? visible.slice(0, 40).flatMap((i) => i.locations) : [];

  function toggleMap() {
    setShowMap((v) => {
      try { localStorage.setItem("rov_inv_map", v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  }

  async function report(item: InventoryItem, status: InventoryStatus) {
    if (status === item.status) return;
    const snapshot = items;
    setItems((prev) => prev!.map((x) => (x.id === item.id ? { ...x, status, status_at: new Date().toISOString(), status_by_name: tt("你", "You") } : x)));
    try {
      await api(`/api/inventory/${item.id}/report`, { method: "POST", body: JSON.stringify({ status }) });
      const label = INVENTORY_STATUSES.find((s) => s.key === status)!.label;
      toast(tt(`已回報「${item.name}」${label}`, `Reported ${item.name} as ${label.toLowerCase()}`));
      load().catch(() => {});
    } catch (err) {
      setItems(snapshot);
      toast(t((err as Error).message), "err");
    }
  }

  const filterChips: { key: Filter; label: string; color?: string }[] = [
    { key: "all", label: tt("全部", "All") },
    ...INVENTORY_STATUSES.map((s) => ({ key: s.key as Filter, label: s.label, color: s.color })),
    { key: "multi", label: tt("分散多處", "In several places"), color: "#ff642e" },
  ];

  return (
    <div className="space-y-4">
      <BoardHeader
        title={tt("庫存", "Inventory")}
        subtitle={tt("找東西放哪、回報快用完或沒有了", "Find where things are, report what's low or out")}
        action={
          <>
            <Link href="/inventory/qr" className={`${BTN_GHOST} gap-1.5 border border-border`}>
              <QrCodeIcon className="size-4" /> {tt("QR 標籤", "QR labels")}
            </Link>
            <button type="button" className={`${BTN_GHOST} gap-1.5 border border-border`} onClick={toggleMap} aria-pressed={showMap}>
              <MapIcon className="size-4" /> {showMap ? tt("隱藏地圖", "Hide map") : tt("顯示地圖", "Show map")}
            </button>
          </>
        }
      />

      <InventoryTabs />

      {/* 搜尋 + 篩選 */}
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            id="inv-search"
            type="search"
            className="h-12 w-full rounded-full border [&::-webkit-search-cancel-button]:hidden border-border bg-card pr-11 pl-11 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={tt("搜尋名稱、規格或位置，例如：M3、熱縮管、4-A-14", "Search name, size or location, e.g. M3, heat shrink, 4-A-14")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={tt("搜尋庫存", "Search inventory")}
          />
          {q && (
            <button type="button" aria-label={tt("清除搜尋", "Clear search")} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted" onClick={() => setQ("")}>
              <XIcon className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((c) => {
            const on = filter === c.key;
            const n = counts[c.key];
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(c.key)}
                className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted"}`}
              >
                {c.color && <span className="size-2.5 rounded-full" style={{ background: c.color }} />}
                {c.label}
                <span className={`tabular-nums text-xs ${on ? "opacity-80" : "text-muted-foreground"}`}>{n}</span>
              </button>
            );
          })}
          <select aria-label={tt("櫃號", "Cabinet")} className={`${SELECT_CLS} ml-auto w-32`} value={cabinet ?? ""} onChange={(e) => setCabinet(e.target.value || null)}>
            <option value="">{tt("全部櫃子", "All cabinets")}</option>
            {CABINETS.map((c) => (
              <option key={c.id} value={c.id}>{tt(`${c.id} 號櫃`, `Cabinet ${c.id}`)}</option>
            ))}
          </select>
          <select aria-label={tt("分類", "Category")} className={`${SELECT_CLS} w-36`} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">{t("全部分類")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {showMap && (
        <section className="rounded-[16px] border border-border bg-card p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{searching ? tt("藍色＝搜尋結果的位置", "Blue = where your results are") : tt("點櫃子可只看那一櫃", "Tap a cabinet to show only what's in it")}</span>
            <span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-[#df2f4a]" />{tt("沒有了", "Empty")}</span>
            <span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-[#fdab3d]" />{tt("快用完", "Low")}</span>
            <span className="inline-flex items-center gap-1"><i className="h-1 w-3 bg-[#ff642e]" />{tt("櫃門方向", "Cabinet front")}</span>
            {cabinet && (
              <button type="button" className="ml-auto text-primary hover:underline" onClick={() => setCabinet(null)}>
                {tt(`清除 ${cabinet} 號櫃篩選`, `Clear cabinet ${cabinet} filter`)}
              </button>
            )}
          </div>
          <div className="mx-auto max-w-4xl">
            <RoomMap highlight={highlight} badges={badges} selectedCabinet={cabinet} onCabinetClick={(id) => setCabinet((c) => (c === id ? null : id))} />
          </div>
        </section>
      )}

      <BoardGroup title={searching ? tt("搜尋結果", "Results") : tt("庫存物品", "Items")} color="#579bfc" count={visible.length}>
        {visible.length === 0 ? (
          <div className="p-4">
            <PageEmpty>
              {items.length === 0 ? (
                <>
                  {tt("還沒有任何物品。", "No items yet.")}{" "}
                  <Link href="/inventory/manage" className="text-primary hover:underline">
                    {tt("新增第一個", "Add the first one")}
                  </Link>
                </>
              ) : (
                <>
                  {tt("沒有符合的物品。", "Nothing matches.")}{" "}
                  <Link href={`/inventory/manage${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`} className="text-primary hover:underline">
                    {tt("新增這個物品", "Add it as a new item")}
                  </Link>
                </>
              )}
            </PageEmpty>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((i) => {
              const editing = editingId === i.id;
              return (
                <li key={i.id} className="flex flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-start lg:gap-6">
                  {/* What */}
                  <div className="min-w-0 lg:w-64 lg:shrink-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/inventory/${i.id}`} className="font-medium hover:underline">{i.name}</Link>
                      <StatusPill status={i.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {i.spec && <span>{i.spec}</span>}
                      {i.category && <span>· {i.category}</span>}
                    </div>
                  </div>

                  {/* Where */}
                  <div className="min-w-0 flex-1 space-y-2">
                    {editing ? (
                      <LocationEditor
                        item={i}
                        onCancel={() => setEditingId(null)}
                        onSaved={async (locations) => {
                          setItems((prev) => prev!.map((x) => (x.id === i.id ? { ...x, locations } : x)));
                          setEditingId(null);
                          load().catch(() => {});
                        }}
                      />
                    ) : (
                      <>
                        {i.locations.length === 0 ? (
                          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPinIcon className="size-4 shrink-0" /> {tt("還沒指定位置", "No location set yet")}
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                          <ul className="min-w-0 flex-1 space-y-1">
                            {i.locations.map((l) => (
                              <li key={l} className="flex flex-wrap items-center gap-2 text-sm">
                                <MapPinIcon className="size-4 shrink-0 text-[#0073ea]" />
                                <LocationChip code={l} />
                                <span className="text-muted-foreground">{describeLocation(l)}</span>
                              </li>
                            ))}
                          </ul>
                          <LocationDiagram locations={i.locations} className="w-fit max-w-full sm:shrink-0" />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <MultiLocationFlag count={i.locations.length} />
                          <span className="text-xs text-muted-foreground">
                            {i.locations.length === 0 ? tt("知道它在哪？", "Know where it is?") : tt("不在這裡？", "Not here?")}
                          </span>
                          <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1 rounded-[4px] border border-border px-2 text-xs font-medium hover:bg-muted"
                            onClick={() => setEditingId(i.id)}
                          >
                            <PencilIcon className="size-3.5" />
                            {i.locations.length === 0 ? tt("加上位置", "Add location") : tt("編輯位置", "Edit location")}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Stock */}
                  <div className="flex flex-wrap items-center gap-2 text-xs lg:w-60 lg:shrink-0 lg:justify-end">
                    {i.status === "in_stock" ? (
                      <>
                        <button type="button" className="rounded-[4px] border border-[#fdab3d]/60 px-2 py-1 font-medium text-[#b86e00] hover:bg-[#fdab3d]/15 dark:text-[#ffc56b]" onClick={() => report(i, "low")}>
                          {tt("回報快用完", "Report low")}
                        </button>
                        <button type="button" className="rounded-[4px] border border-[#df2f4a]/60 px-2 py-1 font-medium text-[#c0233b] hover:bg-[#df2f4a]/10 dark:text-[#ff8597]" onClick={() => report(i, "empty")}>
                          {tt("回報沒有了", "Report empty")}
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href={restockRequestHref(i)} className="rounded-[4px] bg-primary px-2 py-1 font-medium text-primary-foreground hover:bg-[#0060b9]">
                          {tt("申請補貨 →", "Request restock →")}
                        </Link>
                        <button type="button" className="text-muted-foreground hover:text-foreground hover:underline" onClick={() => report(i, "in_stock")}>
                          {tt("已補貨", "Restocked")}
                        </button>
                      </>
                    )}
                    {i.status_at && (
                      <span className="w-full text-muted-foreground lg:text-right" title={new Date(i.status_at).toLocaleString()}>
                        {tt("最後回報", "Last report")}: {i.status_by_name ?? "—"} · {timeAgo(i.status_at)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </BoardGroup>
    </div>
  );
}
