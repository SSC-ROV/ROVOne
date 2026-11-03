"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, PencilIcon, QrCodeIcon, Trash2Icon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { api } from "@/lib/api-client";
import { BTN_GHOST, INPUT_CLS } from "@/lib/ui";
import {
  INVENTORY_STATUSES,
  describeLocation,
  parseLocation,
  restockRequestHref,
  type InventoryItemDetail,
  type InventoryStatus,
} from "@/lib/inventory";
import type { Me } from "@/lib/types";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageError, PageLoading } from "@/components/PageState";
import RoomMap, { CabinetFrontView } from "@/components/inventory/RoomMap";
import ItemForm, { type ItemFormValue } from "@/components/inventory/ItemForm";
import LocationEditor from "@/components/inventory/LocationEditor";
import { StatusPill, TagList, reportToast, timeAgo, type ReportResponse } from "@/components/inventory/shared";

export default function InventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { confirm, toast } = useDialogs();
  const [item, setItem] = useState<InventoryItemDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editingLoc, setEditingLoc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const fetchAll = (itemId: string) =>
    Promise.all([
      api<{ item: InventoryItemDetail }>(`/api/inventory/${itemId}`),
      api<{ user: Me | null }>("/api/auth/me"),
    ]);

  async function load() {
    const [r, u] = await fetchAll(id);
    setItem(r.item);
    setMe(u.user);
  }

  useEffect(() => {
    let alive = true;
    fetchAll(id)
      .then(([r, u]) => {
        if (!alive) return;
        setItem(r.item);
        setMe(u.user);
      })
      .catch((err: Error) => alive && setError(err.message));
    return () => { alive = false; };
  }, [id]);

  if (error) {
    return (
      <div className="space-y-3">
        <PageError message={t(error)} />
        <Link href="/inventory" className="text-sm text-primary hover:underline">{tt("← 回到庫存", "← Back to inventory")}</Link>
      </div>
    );
  }
  if (!item || !me) return <PageLoading label={t("載入中…")} />;

  // 正面圖：7 號抽屜在平面圖上就看得到，不另外畫
  const cabinets = [...new Set(item.locations.map((l) => parseLocation(l)?.cabinet).filter(Boolean) as string[])].filter((c) => c !== "7");

  async function report(status: InventoryStatus) {
    if (!item) return;
    setBusy(true);
    try {
      const res = await api<ReportResponse>(`/api/inventory/${item.id}/report`, { method: "POST", body: JSON.stringify({ status, note }) });
      setNote("");
      const label = INVENTORY_STATUSES.find((s) => s.key === status)!.label;
      toast(reportToast(item.name, label, res));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setBusy(false);
    }
  }

  async function save(v: ItemFormValue) {
    if (!item) return;
    setBusy(true);
    try {
      const { status: _status, ...rest } = v;
      void _status;
      await api(`/api/inventory/${item.id}`, { method: "PATCH", body: JSON.stringify({ ...rest, unit_price: Number(rest.unit_price) }) });
      toast(tt("已儲存", "Saved"));
      setEditing(false);
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item) return;
    const ok = await confirm({
      title: tt(`刪除「${item.name}」？`, `Delete ${item.name}?`),
      message: tt("位置和回報紀錄也會一起刪除，無法復原。", "Its locations and report history are deleted too. This can't be undone."),
      confirmText: t("刪除"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/inventory/${item.id}`, { method: "DELETE" });
      toast(t("已刪除"));
      router.push("/inventory");
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {tt("庫存", "Inventory")}
      </Link>

      {/* 標題 */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <h1 className="board-title min-w-0 flex-1 !text-3xl !leading-tight text-foreground [overflow-wrap:anywhere] sm:!text-4xl" style={{ wordBreak: "normal" }}>{item.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/inventory/qr?ids=${item.id}`} className={`${BTN_GHOST} gap-1.5 border border-border`}>
            <QrCodeIcon className="size-4" /> {tt("QR 標籤", "QR label")}
          </Link>
          <button type="button" className={`${BTN_GHOST} gap-1.5 border border-border`} onClick={() => setEditing((v) => !v)}>
            <PencilIcon className="size-4" /> {editing ? t("取消") : tt("編輯", "Edit")}
          </button>
          <button type="button" className={`${BTN_GHOST} gap-1.5 border border-[#df2f4a]/60 text-[#c0233b] hover:bg-[#df2f4a]/10 dark:text-[#ff8597]`} onClick={remove}>
            <Trash2Icon className="size-4" /> {tt("刪除", "Delete")}
          </button>
        </div>
      </header>

      {/* 位置：整頁最大的字，一眼就看到 */}
      <section className="rounded-[16px] border border-border bg-card px-5 py-8 text-center sm:py-10" aria-label={tt("位置", "Location")}>
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">{tt("放在", "Location")}</p>
        {item.locations.length === 0 ? (
          <p className="mt-3 text-4xl font-bold text-muted-foreground sm:text-5xl">{tt("還沒指定位置", "No location yet")}</p>
        ) : (
          <ul className="mt-2 flex flex-col items-center gap-5">
            {item.locations.map((l) => (
              <li key={l}>
                <p
                  className={`font-mono leading-none font-black tracking-tight text-[var(--c-blue)] ${
                    item.locations.length > 1 ? "text-[clamp(3rem,12vw,6.5rem)]" : "text-[clamp(4.5rem,20vw,11rem)]"
                  }`}
                >
                  {l}
                </p>
                <p className="mt-3 text-base text-muted-foreground sm:text-lg">{describeLocation(l)}</p>
              </li>
            ))}
          </ul>
        )}
        {item.locations.length > 1 && (
          <p className="mx-auto mt-4 max-w-md text-sm text-[#b86e00] dark:text-[#ffc56b]">
            {tt("這個物品分散在多個位置，整理時建議集中到一處。", "This item is stored in more than one place. Move it to a single spot when you can.")}
          </p>
        )}
        {editingLoc ? (
          <div className="mx-auto mt-6 max-w-xl text-left">
            <LocationEditor
              item={item}
              onCancel={() => setEditingLoc(false)}
              onSaved={async () => {
                setEditingLoc(false);
                await load();
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="mt-6 inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-border px-3 text-sm font-medium hover:bg-muted"
            onClick={() => setEditingLoc(true)}
          >
            <PencilIcon className="size-3.5" />
            {item.locations.length === 0 ? tt("加上位置", "Add location") : tt("不在這裡？編輯位置", "Not here? Edit location")}
          </button>
        )}
      </section>

      {/* 狀態與其他資料 */}
      <section className="space-y-4 rounded-[16px] border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-semibold text-muted-foreground">{tt("狀態", "Status")}</span>
          <StatusPill status={item.status} />
          {item.status_at && (
            <span className="text-xs text-muted-foreground">
              {tt("最後回報", "Last report")}: {item.status_by_name ?? "—"} · {timeAgo(item.status_at)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-5">
          {item.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photo} alt="" className="size-28 rounded-[8px] border border-border object-cover" />
          )}
          <dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">{tt("規格 / 型號", "Spec / model")}</dt>
            <dd className="break-words">{item.spec || <span className="text-muted-foreground">—</span>}</dd>
            <dt className="text-muted-foreground">{tt("分類", "Category")}</dt>
            <dd>{item.tags.length ? <TagList tags={item.tags} /> : <span className="text-muted-foreground">—</span>}</dd>
            <dt className="text-muted-foreground">{tt("預估單價", "Est. unit price")}</dt>
            <dd className="tabular-nums">{item.unit_price > 0 ? `$${item.unit_price}` : <span className="text-muted-foreground">—</span>}</dd>
            <dt className="text-muted-foreground">{tt("購買連結", "Buy link")}</dt>
            <dd className="min-w-0 truncate">
              {item.buy_link ? (
                <a href={item.buy_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {item.buy_link.replace(/^https?:\/\//, "")} ↗
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
            <dt className="text-muted-foreground">{tt("備註", "Note")}</dt>
            <dd className="break-words whitespace-pre-wrap">{item.note || <span className="text-muted-foreground">—</span>}</dd>
          </dl>
        </div>
      </section>

      {editing && (
        <section className="rounded-[16px] border border-border bg-card p-5">
          <ItemForm
            initial={{ name: item.name, spec: item.spec, tags: item.tags, note: item.note, buy_link: item.buy_link, unit_price: item.unit_price ? String(item.unit_price) : "", locations: item.locations, status: item.status }}
            initialPhoto={item.photo}
            submitLabel={tt("儲存", "Save")}
            busy={busy}
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 地圖 */}
        <section className="min-w-0 space-y-3 rounded-[16px] border border-border bg-card p-4">
          <h2 className="font-semibold">{tt("在地圖上", "On the map")}</h2>
          <RoomMap highlight={item.locations} />
          {cabinets.length > 0 && (
            <div className="flex flex-wrap gap-6 border-t border-border pt-3">
              {cabinets.map((c) => (
                <figure key={c} className="min-w-0 flex-1 basis-56 space-y-1.5">
                  <figcaption className="text-xs font-semibold text-muted-foreground">
                    {tt(`${c} 號櫃正面`, `Cabinet ${c}, front view`)}
                  </figcaption>
                  <CabinetFrontView cabinetId={c} highlight={item.locations} />
                </figure>
              ))}
            </div>
          )}
        </section>

        {/* 回報 */}
        <aside className="space-y-4">
          <section className="space-y-3 rounded-[16px] border border-border bg-card p-4">
            <h2 className="font-semibold">{tt("回報庫存", "Report stock")}</h2>
            <div className="grid grid-cols-3 gap-2">
              {INVENTORY_STATUSES.map((s) => {
                const on = item.status === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={busy}
                    aria-pressed={on}
                    onClick={() => report(s.key)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                    style={
                      on
                        ? {
                            background: `color-mix(in srgb, ${s.color} 14%, transparent)`,
                            borderColor: `color-mix(in srgb, ${s.color} 45%, transparent)`,
                            color: `color-mix(in srgb, ${s.color} 82%, var(--foreground))`,
                          }
                        : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                    }
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.label}
                  </button>
                );
              })}
            </div>
            <input
              id="inv-report-note"
              className={INPUT_CLS}
              placeholder={tt("備註（選填，例如：只剩 3 顆）", "Note (optional, e.g. only 3 left)")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {item.status !== "in_stock" && (
              <Link href={restockRequestHref(item)} className="flex h-10 w-full items-center justify-center rounded-[6px] bg-primary text-sm font-semibold text-primary-foreground hover:bg-[#0060b9]">
                {tt("到零件採買申請補貨 →", "Request restock on Parts →")}
              </Link>
            )}
            {item.status_at && (
              <p className="text-xs text-muted-foreground">
                {tt("最後回報", "Last report")}: {item.status_by_name ?? "—"} · {timeAgo(item.status_at)}
                {item.status_note && <> · “{item.status_note}”</>}
              </p>
            )}
          </section>

          <section className="space-y-2 rounded-[16px] border border-border bg-card p-4">
            <h2 className="font-semibold">{tt("回報紀錄", "Report history")}</h2>
            {item.reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tt("還沒有紀錄", "Nothing yet")}</p>
            ) : (
              <ol className="space-y-2">
                {item.reports.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 text-sm">
                    <StatusPill status={r.status} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {r.user_name ?? "—"} · <span title={new Date(r.created_at).toLocaleString()}>{timeAgo(r.created_at)}</span>
                      </p>
                      {r.note && <p className="break-words">{r.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
