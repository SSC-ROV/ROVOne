"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function BoardGroup({
  title,
  color,
  count,
  children,
  footer,
  defaultOpen = true,
}: {
  title: string;
  color: string;
  count?: number;
  children: ReactNode;
  footer?: ReactNode;
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
