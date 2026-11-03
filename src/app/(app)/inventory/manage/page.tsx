"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPinOffIcon, PencilIcon, QrCodeIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { api } from "@/lib/api-client";
import { BTN_GHOST } from "@/lib/ui";
import type { InventoryItem } from "@/lib/inventory";
import { PageError, PageLoading } from "@/components/PageState";
import { BoardGroup } from "@/components/board/BoardGroup";
import { BoardHeader } from "@/components/board/BoardHeader";
import InventoryTabs from "@/components/inventory/InventoryTabs";
import ItemPanel from "@/components/inventory/ItemPanel";
import LocationEditor from "@/components/inventory/LocationEditor";
import { StatusPill } from "@/components/inventory/shared";

/** Second inventory page: add new items and set where existing ones are stored. */
export default function InventoryManagePage() {
  const { t } = useI18n();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState("");
  const [initialQuery, setInitialQuery] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

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
        // ?q= comes from "Add it as a new item" on the Find page
        setInitialQuery(new URLSearchParams(window.location.search).get("q") ?? "");
      })
      .catch((err: Error) => alive && setError(err.message));
    return () => { alive = false; };
  }, []);

  if (error) return <PageError message={t(error)} />;
  if (!items || initialQuery == null) return <PageLoading label={t("載入中…")} />;

  const unplaced = items.filter((i) => i.locations.length === 0);

  return (
    <div className="space-y-4">
      <BoardHeader
        title={tt("新增 / 放置物品", "Add & place items")}
        subtitle={tt("新增物品，或設定現有物品放在哪裡", "Add new items or set where existing ones are stored")}
        action={
          <Link href="/inventory/qr" className={`${BTN_GHOST} gap-1.5 border border-border`}>
            <QrCodeIcon className="size-4" /> {tt("QR 標籤", "QR labels")}
          </Link>
        }
      />
      <InventoryTabs />

      <ItemPanel items={items} onChanged={load} initialQuery={initialQuery} autoFocus={initialQuery !== ""} />

      {unplaced.length > 0 && (
        <BoardGroup title={tt("還沒指定位置", "Needs a location")} color="#fdab3d" count={unplaced.length}>
          <ul className="divide-y divide-border">
            {unplaced.map((i) => (
              <li key={i.id} className="space-y-2 px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <MapPinOffIcon className="size-4 shrink-0 text-[#fdab3d]" />
                  <Link href={`/inventory/${i.id}`} className="font-medium hover:underline">{i.name}</Link>
                  {i.spec && <span className="text-xs text-muted-foreground">{i.spec}</span>}
                  <StatusPill status={i.status} />
                  {editingId !== i.id && (
                    <button
                      type="button"
                      className="ml-auto inline-flex h-7 items-center gap-1 rounded-[4px] border border-border px-2 text-xs font-medium hover:bg-muted"
                      onClick={() => setEditingId(i.id)}
                    >
                      <PencilIcon className="size-3.5" /> {tt("加上位置", "Add location")}
                    </button>
                  )}
                </div>
                {editingId === i.id && (
                  <LocationEditor
                    item={i}
                    onCancel={() => setEditingId(null)}
                    onSaved={async () => {
                      setEditingId(null);
                      await load();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </BoardGroup>
      )}
    </div>
  );
}
