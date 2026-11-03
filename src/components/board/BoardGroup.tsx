"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** A collapsible group of rows: icon (or colour dot), bold title, count pill, optional description and meta. */
export function BoardGroup({
  title,
  color,
  icon,
  count,
  description,
  children,
  footer,
  meta,
  actions,
  defaultOpen = true,
}: {
  title: string;
  color: string;
  /** Replaces the colour dot, e.g. a status icon. */
  icon?: ReactNode;
  count?: number;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra info shown at the right of the group header (e.g. progress). */
  meta?: ReactNode;
  /** Buttons shown at the far right of the header, outside the collapse toggle. */
  actions?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-4 overflow-hidden rounded-[6px] border border-border bg-card" data-open={open ? "true" : "false"}>
      <div className={`flex items-center ${open ? "border-b border-border" : ""}`}>
      <button
        type="button"
        className="flex h-11 min-w-0 flex-1 items-center gap-2.5 px-3 text-left hover:bg-muted/60"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          aria-hidden
        />
        {icon ?? <span className="size-3 shrink-0 rounded-full border-2" style={{ borderColor: color }} aria-hidden />}
        <span className="min-w-0 truncate text-[15px] font-semibold text-foreground">{title}</span>
        {count != null ? (
          <span className="rounded-full bg-muted px-2 text-xs leading-5 font-medium tabular-nums text-muted-foreground">{count}</span>
        ) : null}
        {description ? <span className="hidden truncate text-sm text-muted-foreground sm:inline">{description}</span> : null}
        {meta ? <span className="ml-auto flex shrink-0 items-center gap-2 text-sm text-muted-foreground">{meta}</span> : null}
      </button>
      {actions ? <div className="flex shrink-0 items-center gap-1 pr-2">{actions}</div> : null}
      </div>
      {open ? (
        <>
          <div className="overflow-x-auto">{children}</div>
          {footer}
        </>
      ) : null}
    </section>
  );
}
