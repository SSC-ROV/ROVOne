"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const COLORS = ["#579bfc", "#00c875", "#a25ddc", "#ff642e", "#fdab3d", "#5559df", "#ffcb00"];

export function personColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % COLORS.length;
  return COLORS[hash];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.trim().slice(0, 1) || "?";
}

function Avatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-[#c4c4c4] text-[10px] text-muted-foreground">
        ?
      </span>
    );
  }
  return (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full text-[11px] font-medium text-white"
      style={{ background: personColor(name) }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function PersonCell({
  name,
  options,
  disabled,
  onChange,
}: {
  name: string | null;
  options?: { value: string; label: string }[];
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const face = (
    <span className="inline-flex items-center gap-2">
      <Avatar name={name} />
      <span className="max-w-32 truncate">{name ?? "—"}</span>
    </span>
  );
  if (!onChange || disabled || !options) return face;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger type="button" className="inline-flex cursor-pointer items-center border-0 bg-transparent p-0">
        {face}
      </PopoverTrigger>
      <PopoverContent className="max-h-72 w-56 gap-0.5 overflow-y-auto rounded-[4px] p-1" align="start">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm hover:bg-muted"
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            <Avatar name={option.label === "—" ? null : option.label} />
            <span className="truncate">{option.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
