"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

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
    <section
      className="mb-5 border-l-[6px] bg-card"
      style={{ borderLeftColor: color }}
      data-open={open ? "true" : "false"}
    >
      <button
        type="button"
        className="flex h-11 w-full items-center gap-2 px-3 text-left"
        style={open ? undefined : { boxShadow: `inset 0 -3px 0 ${color}` }}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <ChevronRight
          className="size-4 shrink-0 transition-transform duration-150"
          style={{ color, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          aria-hidden
        />
        <span className="group-title" style={{ color }}>
          {title}
        </span>
        {count != null ? (
          <span className="rounded-[4px] bg-muted px-1.5 text-sm tabular-nums text-muted-foreground">{count}</span>
        ) : null}
        {meta ? <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">{meta}</span> : null}
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
