"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/** A collapsible group of rows: neutral title with a small colour dot, count and optional meta on the right. */
export function BoardGroup({
  title,
  color,
  count,
  children,
  footer,
  meta,
  defaultOpen = true,
}: {
  title: string;
  color: string;
  count?: number;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra info shown at the right of the group header (e.g. progress). */
  meta?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-4 overflow-hidden rounded-[10px] border border-border bg-card" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className={`flex h-11 w-full items-center gap-2.5 bg-muted/40 px-3 text-left transition-colors hover:bg-muted/70 ${open ? "border-b border-border" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          aria-hidden
        />
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="min-w-0 truncate text-[15px] font-semibold text-foreground">{title}</span>
        {count != null ? <span className="text-sm tabular-nums text-muted-foreground">{count}</span> : null}
        {meta ? <span className="ml-auto flex shrink-0 items-center gap-2 text-sm text-muted-foreground">{meta}</span> : null}
      </button>
      {open ? (
        <>
          <div className="overflow-x-auto">{children}</div>
          {footer}
        </>
      ) : null}
    </section>
  );
}
