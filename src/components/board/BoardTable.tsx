"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { MoreHorizontalIcon, PanelRightOpenIcon, SearchIcon, XIcon } from "lucide-react";
import { tt } from "@/lib/i18n-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Building blocks shared by the board tables (Tasks, Purchase requests, Inventory, Equipment, Test dives)
 * so every list has the same toolbar, row numbers, title cell and "…" menu.
 */

/** Search box + filter pills + "x of y" count, laid out like the Tasks toolbar. */
export function TableToolbar({
  query,
  onQuery,
  placeholder,
  filters,
  narrowing,
  onClear,
  shown,
  total,
  noun,
  right,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  /** MultiFilter pills. */
  filters?: ReactNode;
  narrowing: boolean;
  onClear: () => void;
  shown: number;
  total: number;
  /** e.g. ["項", "items"] → "3 of 10 items". */
  noun: [string, string];
  /** Extra controls at the right of the search row. */
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-border bg-card px-3 text-muted-foreground focus-within:border-ring sm:max-w-sm">
          <SearchIcon className="size-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onQuery("");
                event.currentTarget.blur();
              }
            }}
            placeholder={placeholder}
            aria-label={tt("搜尋", "Search")}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => onQuery("")} aria-label={tt("清除", "Clear")}>
              <XIcon className="size-3.5" />
            </button>
          )}
        </label>
        {right ? <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {filters}
        {narrowing && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <XIcon /> {tt("清除篩選", "Clear filters")}
          </Button>
        )}
        <span className="ml-auto pr-1 text-xs text-muted-foreground tabular-nums">
          {tt(`顯示 ${shown} / ${total} ${noun[0]}`, `${shown} of ${total} ${noun[1]}`)}
        </span>
      </div>
    </div>
  );
}

/**
 * First column: row number, optional icon, the title (truncated, one line), a muted second part,
 * and an "Open" button that slides in on hover.
 */
export function TitleCell({
  index,
  icon,
  title,
  sub,
  muted,
  onOpen,
  href,
  openLabel,
}: {
  /** Row position; omit to hide the number column (e.g. when another cell already shows it). */
  index?: number;
  icon?: ReactNode;
  title: string;
  sub?: string;
  muted?: boolean;
  onOpen?: () => void;
  href?: string;
  openLabel?: string;
}) {
  const titleCls = `min-w-0 truncate text-left ${muted ? "text-muted-foreground" : "text-foreground"} ${
    onOpen || href ? "hover:text-[var(--c-blue)] hover:underline hover:underline-offset-4" : ""
  }`;
  const openCls =
    "ml-auto flex h-6 shrink-0 translate-x-1 items-center gap-1 rounded-[6px] border border-border bg-card px-1.5 text-xs text-muted-foreground opacity-0 transition-all duration-150 group-hover/row:translate-x-0 group-hover/row:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100";
  const openText = (
    <>
      <PanelRightOpenIcon className="size-3.5" /> {openLabel ?? tt("開啟", "Open")}
    </>
  );
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {index != null && <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>}
      {icon}
      <span className="flex min-w-0 items-baseline gap-2">
        {href ? (
          <Link href={href} className={titleCls} title={title}>{title}</Link>
        ) : onOpen ? (
          <button type="button" className={titleCls} onClick={onOpen} title={title}>{title}</button>
        ) : (
          <span className={titleCls} title={title}>{title}</span>
        )}
        {sub ? <span className="min-w-0 truncate text-xs text-muted-foreground" title={sub}>{sub}</span> : null}
      </span>
      {href ? (
        <Link href={href} className={openCls}>{openText}</Link>
      ) : onOpen ? (
        <button type="button" onClick={onOpen} className={openCls}>{openText}</button>
      ) : null}
    </span>
  );
}

export type RowAction = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  /** Draws a divider above this item. */
  separator?: boolean;
  hidden?: boolean;
};

/** The "…" menu at the end of a row. Renders nothing when no action applies. */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  const shown = actions.filter((action) => !action.hidden);
  if (shown.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-7 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted"
        aria-label={tt(`「${label}」的更多動作`, `More actions for "${label}"`)}
      >
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {shown.map((action, i) => (
          <Fragment key={action.label}>
            {action.separator && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem variant={action.destructive ? "destructive" : "default"} onClick={action.onSelect}>
              {action.icon} {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Message shown inside an empty group or when filters hide everything. */
export function TableEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-sm text-muted-foreground">{children}</p>;
}

/** Group header colour dot replacement: a filled circle in the status colour. */
export function StatusDot({ color }: { color: string }) {
  return <span className="size-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

/** One "label: value" line in a detail sheet; hidden when the value is empty. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-3">
      <dt className="pt-0.5 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Labelled field in a "New …" sheet, matching the New task form. */
export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
