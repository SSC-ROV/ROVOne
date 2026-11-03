"use client";

import { useState, type ReactNode } from "react";
import { CheckIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ColorOption = { value: string; label: string; color: string };

/** Three signal bars; `level` of them are filled with `color`. Used for priority. */
export function PriorityBars({ level, color }: { level: number; color: string }) {
  return (
    <span className="inline-flex h-3 shrink-0 items-end gap-[2px]" aria-hidden>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className="w-[3px] rounded-[1px]"
          style={{ height: `${bar * 4}px`, background: bar <= level ? color : "color-mix(in oklch, currentColor 22%, transparent)" }}
        />
      ))}
    </span>
  );
}

const PRIORITY_LEVEL: Record<string, number> = { high: 3, medium: 2, low: 1 };

function Marker({ kind, option }: { kind: "status" | "priority"; option: { value: string; color: string } }) {
  if (kind === "priority") return <PriorityBars level={PRIORITY_LEVEL[option.value] ?? 0} color={option.color} />;
  return <span className="size-2 shrink-0 rounded-full" style={{ background: option.color }} aria-hidden />;
}

/** A soft pill (dot or bars + label) that opens a picker. Colour marks meaning; the text stays readable. */
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
  const current = options.find((option) => option.value === value) ?? { value, label: value, color: "#8f94a3" };
  const tint = kind === "status" ? `color-mix(in oklch, ${current.color} 16%, transparent)` : "transparent";
  const face: ReactNode = (
    <span
      className="inline-flex h-7 max-w-full items-center gap-2 rounded-full px-2.5 text-[13px] font-medium text-foreground"
      style={{ background: tint }}
    >
      <Marker kind={kind} option={current} />
      <span className="truncate">{current.label}</span>
    </span>
  );

  if (!onChange || disabled) return face;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className="inline-flex max-w-full cursor-pointer rounded-full border-0 bg-transparent p-0 transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        disabled={disabled}
      >
        {face}
      </PopoverTrigger>
      <PopoverContent className="w-44 gap-0.5 p-1" align="start" sideOffset={4}>
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
            <Marker kind={kind} option={option} />
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
