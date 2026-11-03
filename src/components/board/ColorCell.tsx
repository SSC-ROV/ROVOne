"use client";

import { useState, type CSSProperties } from "react";
import { CheckIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ColorOption = { value: string; label: string; color: string };

const STATUS_COLOR: Record<string, string> = { todo: "var(--c-green)", doing: "var(--c-yellow)", done: "var(--c-purple)" };

/** Task state icon: open ring (todo), half-filled ring (in progress), filled check (done). */
export function StatusIcon({ status, size = 16, className = "" }: { status: string; size?: number; className?: string }) {
  const color = STATUS_COLOR[status] ?? "var(--c-gray)";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={`shrink-0 ${className}`} aria-hidden style={{ color }}>
      {status === "done" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5 8.2 7.1 10.3 11 6.2" fill="none" stroke="var(--card)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {status === "doing" ? <path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" /> : <circle cx="8" cy="8" r="1.6" fill="currentColor" />}
        </>
      )}
    </svg>
  );
}

/** Outlined, tinted pill coloured by `color`. */
export function Label({ color, children, className = "" }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={`gh-label ${className}`} style={{ "--label": color } as CSSProperties}>
      {children}
    </span>
  );
}

/** Status or priority shown as a label pill that opens a picker. */
export function ColorCell({
  value,
  options,
  disabled,
  onChange,
  kind = "status",
}: {
  value: string;
  options: ColorOption[];
  disabled?: boolean;
  onChange?: (value: string) => void;
  kind?: "status" | "priority";
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value) ?? { value, label: value, color: "var(--c-gray)" };
  const face = <Label color={current.color}>{current.label}</Label>;

  if (!onChange || disabled) return face;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className="inline-flex max-w-full cursor-pointer rounded-full border-0 bg-transparent p-0 hover:brightness-125 focus-visible:ring-2 focus-visible:ring-ring"
        disabled={disabled}
      >
        {face}
      </PopoverTrigger>
      <PopoverContent className="w-48 gap-0.5 p-1" align="start" sideOffset={4}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            {kind === "status" ? (
              <StatusIcon status={option.value} />
            ) : (
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: option.color }} aria-hidden />
            )}
            <span className="flex-1">{option.label}</span>
            {option.value === value && <CheckIcon className="size-4 text-muted-foreground" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function StatusCell(props: {
  value: string;
  options: ColorOption[];
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return <ColorCell {...props} kind="status" />;
}

export function PriorityCell(props: {
  value: string;
  options: ColorOption[];
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return <ColorCell {...props} kind="priority" />;
}
