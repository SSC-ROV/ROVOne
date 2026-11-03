"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { api } from "@/lib/api-client";
import { BTN, BTN_GHOST } from "@/lib/ui";
import { matchesSearch, type InventoryItem } from "@/lib/inventory";
import { PageEmpty, PageError, PageLoading } from "@/components/PageState";

type Size = "small" | "large";

/** 產生物品 QR 標籤：掃描後直接打開該物品頁（位置地圖 + 回報按鈕） */
export default function InventoryQrPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [size, setSize] = useState<Size>("small");
  const [svgs, setSvgs] = useState<Record<number, string>>({});

  useEffect(() => {
    api<{ items: InventoryItem[] }>("/api/inventory")
      .then((r) => {
        setItems(r.items);
        const ids = new URLSearchParams(window.location.search).get("ids");
        if (ids) setSelected(new Set(ids.split(",").map(Number).filter((n) => r.items.some((i) => i.id === n))));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const chosen = useMemo(() => (items ?? []).filter((i) => selected.has(i.id)), [items, selected]);

  useEffect(() => {
    let cancelled = false;
    const origin = window.location.origin;
    Promise.all(
      chosen.map(async (i) => [i.id, await QRCode.toString(`${origin}/inventory/${i.id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" })] as const)
    ).then((pairs) => {
      if (!cancelled) setSvgs(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [chosen]);

  if (error) return <PageError message={t(error)} />;
  if (!items) return <PageLoading label={t("載入中…")} />;

  const listed = items.filter((i) => matchesSearch(i, q));
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allListedOn = listed.length > 0 && listed.every((i) => selected.has(i.id));

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { margin: 10mm; }
          body * { visibility: hidden !important; }
          .qr-sheet, .qr-sheet * { visibility: visible !important; }
          .qr-sheet { position: absolute; inset: 0 auto auto 0; width: 100%; }
          .qr-label { break-inside: avoid; border-color: #999 !important; background: #fff !important; color: #000 !important; }
          .qr-label * { color: #000 !important; }
        }
      `}</style>

      <div className="print:hidden space-y-4">
        <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> {tt("庫存", "Inventory")}
        </Link>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="board-title text-foreground">{tt("QR 標籤", "QR labels")}</h1>
            <p className="text-sm text-muted-foreground">
              {tt("選物品 → 列印 → 貼在盒子或抽屜上。掃描後會打開物品頁，可看位置並回報庫存。", "Pick items, print, stick the labels on bins or drawers. Scanning opens the item page with its location and stock buttons.")}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-[4px] border border-border p-0.5" role="group" aria-label={tt("標籤大小", "Label size")}>
              {(["small", "large"] as Size[]).map((s) => (
                <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)}
                  className={`h-7 rounded-[3px] px-2.5 text-sm ${size === s ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                  {s === "small" ? tt("小（每頁多張）", "Small") : tt("大", "Large")}
                </button>
              ))}
            </div>
            <button type="button" className={`${BTN} gap-1.5`} disabled={chosen.length === 0} onClick={() => window.print()}>
              <PrinterIcon className="size-4" /> {tt(`列印 ${chosen.length} 張`, `Print ${chosen.length}`)}
            </button>
          </div>
        </div>

        <section className="rounded-[16px] border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              id="qr-search"
              type="search"
              className="h-9 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder={tt("篩選物品…", "Filter items…")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="button" className={`${BTN_GHOST} border border-border`} onClick={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                listed.forEach((i) => (allListedOn ? next.delete(i.id) : next.add(i.id)));
                return next;
              })
            }>
              {allListedOn ? tt("取消全選", "Deselect all") : tt(`全選（${listed.length}）`, `Select all (${listed.length})`)}
            </button>
            {selected.size > 0 && (
              <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => setSelected(new Set())}>
                {tt("清除", "Clear")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <PageEmpty>{tt("先到庫存頁新增物品", "Add items on the Inventory page first")}</PageEmpty>
          ) : (
            <ul className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {listed.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm hover:bg-muted">
                    <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                    <span className="truncate">{i.name}</span>
                    {i.locations[0] && <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{i.locations.join(", ")}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {chosen.length > 0 && (
        <div className={`qr-sheet grid gap-3 ${size === "small" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
          {chosen.map((i) => (
            <div key={i.id} className={`qr-label flex items-center gap-3 rounded-[6px] border border-dashed border-border bg-card ${size === "small" ? "p-2.5" : "p-4"}`}>
              <div
                className={`shrink-0 rounded-[2px] bg-white p-1 ${size === "small" ? "size-20" : "size-32"} [&_svg]:size-full`}
                aria-label={tt(`${i.name} 的 QR code`, `QR code for ${i.name}`)}
                role="img"
                dangerouslySetInnerHTML={{ __html: svgs[i.id] ?? "" }}
              />
              <div className="min-w-0">
                <p className={`font-semibold leading-tight ${size === "small" ? "text-sm" : "text-lg"}`}>{i.name}</p>
                {i.spec && <p className="text-xs text-muted-foreground">{i.spec}</p>}
                {i.locations.length > 0 && <p className={`mt-1 font-mono font-bold ${size === "small" ? "text-sm" : "text-xl"}`}>{i.locations.join(" · ")}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
