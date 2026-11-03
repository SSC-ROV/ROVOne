"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { tt } from "@/lib/i18n-core";
import { describeLocation, inventoryStatus, inventoryTag, type InventoryStatus } from "@/lib/inventory";

export function StatusPill({ status }: { status: InventoryStatus }) {
  const s = inventoryStatus(status);
  return (
    <span className="gh-label shrink-0" style={{ "--label": s.color } as CSSProperties}>
      {s.label}
    </span>
  );
}

export function LocationChip({ code, href, size = "sm" }: { code: string; href?: string; size?: "sm" | "lg" }) {
  const cls = `inline-flex items-center rounded-[4px] bg-[#cce5ff] font-mono font-semibold text-[#0060b9] dark:bg-[#0073ea]/25 dark:text-[#cce5ff] ${
    size === "lg" ? "px-2.5 py-1 text-lg leading-none" : "px-1.5 py-0.5 text-[13px]"
  }`;
  return href ? (
    <Link href={href} className={`${cls} hover:underline`} title={describeLocation(code)}>{code}</Link>
  ) : (
    <span className={cls} title={describeLocation(code)}>{code}</span>
  );
}

export function MultiLocationFlag({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-[4px] border border-[#fdab3d]/60 bg-[#fdab3d]/15 px-1.5 py-0.5 text-[11px] font-semibold text-[#b86e00] dark:text-[#ffc56b]"
      title={tt("建議集中放在一個位置", "Best kept in a single place")}
    >
      {tt(`⚠ 分散 ${count} 處`, `⚠ In ${count} places`)}
    </span>
  );
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return tt("剛剛", "just now");
  if (diff < 3600) return tt(`${Math.floor(diff / 60)} 分鐘前`, `${Math.floor(diff / 60)} min ago`);
  if (diff < 86400) return tt(`${Math.floor(diff / 3600)} 小時前`, `${Math.floor(diff / 3600)} h ago`);
  const days = Math.floor(diff / 86400);
  if (days < 30) return tt(`${days} 天前`, `${days} d ago`);
  return new Date(iso).toLocaleDateString();
}

export type ReportResponse = { ok: boolean; restock: { created: boolean; partId: number | null } | null };

/** 回報後的提示文字；回報「沒有了」時說明採購申請已自動送出 */
export function reportToast(name: string, statusLabel: string, res: ReportResponse | null): string {
  if (res?.restock?.created) {
    return tt(`已回報「${name}」沒有了，已自動送出採購申請`, `Reported ${name} empty. A purchase request was sent automatically.`);
  }
  if (res?.restock && !res.restock.created) {
    return tt(`已回報「${name}」沒有了（已經有一筆補貨申請在處理中）`, `Reported ${name} empty. A restock request is already in progress.`);
  }
  return tt(`已回報「${name}」${statusLabel}`, `Reported ${name} as ${statusLabel.toLowerCase()}`);
}

/** 分類標籤（小圓角標籤，顏色點區分） */
export function TagList({ tags, className = "" }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {tags.map((k) => {
        const t = inventoryTag(k);
        if (!t) return null;
        return (
          <span key={k} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-px text-xs text-muted-foreground">
            <i className="size-1.5 rounded-full" style={{ background: t.color }} />
            {tt(t.zh, t.en)}
          </span>
        );
      })}
    </span>
  );
}
