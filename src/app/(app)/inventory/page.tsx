"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveIcon, CircleDotIcon, MapIcon, MapPinIcon, PanelRightOpenIcon, PlusIcon, QrCodeIcon, SearchIcon, TagIcon, Trash2Icon, XIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { api } from "@/lib/api-client";
import {
  CABINETS,
  INVENTORY_STATUSES,
  INVENTORY_TAGS,
  tagLabel,
  matchesSearch,
  parseLocation,
  type InventoryItem,
  type InventoryStatus,
} from "@/lib/inventory";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageError, PageLoading } from "@/components/PageState";
import { Button } from "@/components/ui/button";
import { MultiFilter } from "@/components/tasks/shared";
import { Label, StatusCell } from "@/components/board/ColorCell";
import { RowActions, StatusDot, TableEmpty, TitleCell } from "@/components/board/BoardTable";
import { BoardGroup } from "@/components/board/BoardGroup";
import { BoardHeader } from "@/components/board/BoardHeader";
import RoomMap, { type CabinetBadge } from "@/components/inventory/RoomMap";
import InventoryTabs from "@/components/inventory/InventoryTabs";
import LocationEditor from "@/components/inventory/LocationEditor";
import { LocationChip, MultiLocationFlag, StatusPill, reportToast, timeAgo, type ReportResponse } from "@/components/inventory/shared";


export default function InventoryPage() {
  const { t } = useI18n();
  const { confirm, toast } = useDialogs();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [cabinet, setCabinet] = useState<string | null>(null);
  const [fCategory, setFCategory] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pickedId, setPickedId] = useState<number | null>(null);

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
        if (f === "low" || f === "empty" || f === "in_stock" || f === "multi") setFStatus([f]);
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


  const visible = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (fStatus.length && !fStatus.some((f) => (f === "multi" ? i.locations.length > 1 : i.status === f))) return false;
      if (fCategory.length && !i.tags.some((tag) => fCategory.includes(tag))) return false;
      if (cabinet && !i.locations.some((l) => parseLocation(l)?.cabinet === cabinet)) return false;
      return matchesSearch(i, q);
    });
  }, [items, fStatus, fCategory, cabinet, q]);

  // 搜尋框下拉建議：輸入 M3 → M3 螺絲、M3 螺帽…
  const suggestions = useMemo(() => {
    if (!items || !q.trim()) return [];
    return items.filter((i) => matchesSearch(i, q)).slice(0, 8);
  }, [items, q]);
  const showSuggest = suggestOpen && suggestions.length > 0;

  function pickSuggestion(item: InventoryItem) {
    setQ(item.name);
    setSuggestOpen(false);
    setActive(-1);
    setPickedId(item.id);
    requestAnimationFrame(() => {
      document.getElementById(`inv-item-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    setTimeout(() => setPickedId((id) => (id === item.id ? null : id)), 2000);
  }

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
  const searching = q.trim().length > 0 || fStatus.length > 0 || fCategory.length > 0;
  const narrowing = searching || cabinet != null;
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
      const res = await api<ReportResponse>(`/api/inventory/${item.id}/report`, { method: "POST", body: JSON.stringify({ status }) });
      const label = INVENTORY_STATUSES.find((s) => s.key === status)!.label;
      toast(reportToast(item.name, label, res));
      load().catch(() => {});
    } catch (err) {
      setItems(snapshot);
      toast(t((err as Error).message), "err");
    }
  }

  async function remove(item: InventoryItem) {
    const ok = await confirm({
      title: tt(`刪除「${item.name}」？`, `Delete ${item.name}?`),
      message: tt("位置和回報紀錄也會一起刪除，無法復原。", "Its locations and report history are deleted too. This can't be undone."),
      confirmText: t("刪除"),
      danger: true,
    });
    if (!ok) return;
    const snapshot = items;
    setItems((prev) => prev!.filter((x) => x.id !== item.id));
    try {
      await api(`/api/inventory/${item.id}`, { method: "DELETE" });
      toast(tt(`已刪除「${item.name}」`, `Deleted ${item.name}`));
    } catch (err) {
      setItems(snapshot);
      toast(t((err as Error).message), "err");
    }
  }

  const statusFilter = [
    ...INVENTORY_STATUSES.map((st) => ({ value: st.key, label: st.label, color: st.color, hint: counts[st.key] })),
    { value: "multi", label: tt("分散多處", "In several places"), color: "#ff642e", hint: counts.multi },
  ];
  const statusOptions = INVENTORY_STATUSES.map((st) => ({ value: st.key, label: st.label, color: st.color }));
  const cabinetFilter = CABINETS.map((c) => ({ value: c.id, label: tt(`${c.id} 號櫃`, `Cabinet ${c.id}`) }));
  const categoryFilter = INVENTORY_TAGS.map((tag) => ({ value: tag.key, label: tt(tag.zh, tag.en), color: tag.color }));
  // Empty and low first: those are the ones that need attention.
  const groupOrder: InventoryStatus[] = ["empty", "low", "in_stock"];

  return (
    <div className="space-y-4">
      <BoardHeader
        title={tt("庫存", "Inventory")}
        subtitle={tt("找東西放哪、回報快用完或沒有了", "Find where things are, report what's low or out")}
        action={
          <>
            <Button variant="outline" render={<Link href="/inventory/qr" />} nativeButton={false}>
              <QrCodeIcon /> {tt("QR 標籤", "QR labels")}
            </Button>
            <Button variant="outline" onClick={toggleMap} aria-pressed={showMap}>
              <MapIcon /> {showMap ? tt("隱藏地圖", "Hide map") : tt("顯示地圖", "Show map")}
            </Button>
            <Button render={<Link href="/inventory/manage" />} nativeButton={false}>
              <PlusIcon /> {tt("新物品", "New item")}
            </Button>
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
            role="combobox"
            aria-expanded={showSuggest}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showSuggest && active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            className="h-12 w-full rounded-full border [&::-webkit-search-cancel-button]:hidden border-border bg-card pr-11 pl-11 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={tt("搜尋名稱、規格或位置，例如：M3、熱縮管、4-A-14", "Search name, size or location, e.g. M3, heat shrink, 4-A-14")}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(-1);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSuggestOpen(true);
                setActive((i) => Math.min(i + 1, suggestions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, -1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (showSuggest && active >= 0) pickSuggestion(suggestions[active]);
                else setSuggestOpen(false);
              } else if (e.key === "Escape") {
                setSuggestOpen(false);
              }
            }}
            aria-label={tt("搜尋庫存", "Search inventory")}
          />
          {q && (
            <button type="button" aria-label={tt("清除搜尋", "Clear search")} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted" onClick={() => { setQ(""); searchRef.current?.focus(); }}>
              <XIcon className="size-4" />
            </button>
          )}
          {showSuggest && (
            <ul
              id={listId}
              role="listbox"
              aria-label={tt("搜尋建議", "Suggestions")}
              className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-[12px] border border-border bg-popover p-1 text-popover-foreground shadow-lg"
            >
              {suggestions.map((s, idx) => {
                const sub = [s.spec, ...s.tags.map(tagLabel)].filter(Boolean).join(" · ");
                return (
                  <li
                    key={s.id}
                    id={`${listId}-${idx}`}
                    role="option"
                    aria-selected={idx === active}
                    className={`flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2 ${idx === active ? "bg-muted" : "hover:bg-muted/60"}`}
                    onMouseEnter={() => setActive(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickSuggestion(s);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
                    </div>
                    {s.locations[0] && <LocationChip code={s.locations[0]} />}
                    {s.locations.length > 1 && (
                      <span className="text-xs text-muted-foreground">+{s.locations.length - 1}</span>
                    )}
                    <StatusPill status={s.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <MultiFilter label={tt("狀態", "Status")} icon={<CircleDotIcon className="size-3.5" />} value={fStatus} onChange={setFStatus} options={statusFilter} />
          <MultiFilter label={tt("櫃號", "Cabinet")} icon={<ArchiveIcon className="size-3.5" />} value={cabinet ? [cabinet] : []} onChange={(v) => setCabinet(v.length ? v[v.length - 1] : null)} options={cabinetFilter} />
          <MultiFilter label={tt("分類", "Category")} icon={<TagIcon className="size-3.5" />} value={fCategory} onChange={setFCategory} options={categoryFilter} />
          {narrowing && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setFStatus([]); setFCategory([]); setCabinet(null); }}>
              <XIcon /> {tt("清除篩選", "Clear filters")}
            </Button>
          )}
          <span className="ml-auto pr-1 text-xs text-muted-foreground tabular-nums">
            {tt(`顯示 ${visible.length} / ${items.length} 項`, `${visible.length} of ${items.length} items`)}
          </span>
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

      {visible.length === 0 && (
        <div className="rounded-[8px] border border-dashed border-border bg-card">
          <TableEmpty>
            {items.length === 0 ? (
              <>
                {tt("還沒有任何物品。", "No items yet.")}{" "}
                <Link href="/inventory/manage" className="text-primary hover:underline">{tt("新增第一個", "Add the first one")}</Link>
              </>
            ) : (
              <>
                {tt("沒有符合的物品。", "Nothing matches.")}{" "}
                <Link href={`/inventory/manage${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`} className="text-primary hover:underline">
                  {tt("新增這個物品", "Add it as a new item")}
                </Link>
              </>
            )}
          </TableEmpty>
        </div>
      )}
      {groupOrder.map((statusKey) => {
        const st = INVENTORY_STATUSES.find((x) => x.key === statusKey)!;
        const rows = visible.filter((i) => i.status === statusKey);
        if (rows.length === 0) return null;
        return (
          <BoardGroup key={statusKey} title={st.label} color={st.color} icon={<StatusDot color={st.color} />} count={rows.length}>
            <table className="board-table is-interactive table-fixed" style={{ minWidth: 1080 }}>
              <colgroup>
                <col />
                <col style={{ width: 130 }} />
                <col style={{ width: 230 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr>
                  <th><span className="pl-8">{tt("物品", "Item")}</span></th>
                  <th className="color-cell">{tt("狀態", "Status")}</th>
                  <th>{tt("位置", "Location")}</th>
                  <th>{tt("分類", "Category")}</th>
                  <th>{tt("最後回報", "Last report")}</th>
                  <th aria-label={tt("動作", "Actions")} />
                </tr>
              </thead>
              <tbody>
                {rows.map((i, index) => {
                  const editing = editingId === i.id;
                  return (
                    <Fragment key={i.id}>
                      <tr id={`inv-item-${i.id}`} className="group/row scroll-mt-24" data-selected={pickedId === i.id || editing ? "true" : undefined}>
                        <td><TitleCell index={index} title={i.name} sub={i.spec} href={`/inventory/${i.id}`} /></td>
                        <td className="color-cell">
                          <StatusCell value={i.status} options={statusOptions} onChange={(value) => report(i, value as InventoryStatus)} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-[4px] text-left"
                            onClick={() => setEditingId(editing ? null : i.id)}
                            title={i.locations.length ? tt("編輯位置", "Edit location") : tt("加上位置", "Add location")}
                          >
                            {i.locations.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                                <MapPinIcon className="size-3.5" /> {tt("加上位置", "Add location")}
                              </span>
                            ) : (
                              <>
                                <LocationChip code={i.locations[0]} />
                                {i.locations.length > 1 && <MultiLocationFlag count={i.locations.length} />}
                              </>
                            )}
                          </button>
                        </td>
                        <td>
                          <span className="flex min-w-0 gap-1 overflow-hidden">
                            {i.tags.map((k) => {
                              const tag = INVENTORY_TAGS.find((x) => x.key === k);
                              return tag ? <Label key={k} color={tag.color}>{tt(tag.zh, tag.en)}</Label> : null;
                            })}
                            {i.tags.length === 0 && <span className="text-muted-foreground">—</span>}
                          </span>
                        </td>
                        <td className="truncate text-xs text-muted-foreground" title={i.status_at ? new Date(i.status_at).toLocaleString() : undefined}>
                          {i.status_at ? `${i.status_by_name ?? "—"} · ${timeAgo(i.status_at)}` : "—"}
                        </td>
                        <td>
                          <RowActions
                            label={i.name}
                            actions={[
                              { label: tt("開啟詳情", "Open details"), icon: <PanelRightOpenIcon />, onSelect: () => router.push(`/inventory/${i.id}`) },
                              { label: i.locations.length ? tt("編輯位置", "Edit location") : tt("加上位置", "Add location"), icon: <MapPinIcon />, onSelect: () => setEditingId(i.id) },
                              { label: tt("回報快用完", "Report low"), icon: <CircleDotIcon />, onSelect: () => report(i, "low"), hidden: i.status === "low", separator: true },
                              { label: tt("回報沒有了", "Report empty"), icon: <CircleDotIcon />, onSelect: () => report(i, "empty"), hidden: i.status === "empty" },
                              { label: tt("已補貨", "Restocked"), icon: <CircleDotIcon />, onSelect: () => report(i, "in_stock"), hidden: i.status === "in_stock" },
                              { label: tt("刪除", "Delete"), icon: <Trash2Icon />, onSelect: () => remove(i), destructive: true, separator: true },
                            ]}
                          />
                        </td>
                      </tr>
                      {editing && (
                        <tr>
                          <td colSpan={6} className="!h-auto !whitespace-normal !p-4">
                            <LocationEditor
                              item={i}
                              onCancel={() => setEditingId(null)}
                              onSaved={async (locations) => {
                                setItems((prev) => prev!.map((x) => (x.id === i.id ? { ...x, locations } : x)));
                                setEditingId(null);
                                load().catch(() => {});
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </BoardGroup>
        );
      })}
    </div>
  );
}
