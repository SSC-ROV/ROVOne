"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { tt } from "@/lib/i18n-core";

const COLORS = ["#6b95ee", "#4cb784", "#9b8cec", "#e38a5d", "#d4ad48", "#5fb3c4", "#d77aa6"];

export function personColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % COLORS.length;
  return COLORS[hash];
}

/** "Jude (Liu Pak Hei Jude Asher)" → "Jude". Names without a nickname are returned as is. */
export function shortName(name: string) {
  const match = /^(.+?)\s*\(.+\)$/.exec(name.trim());
  return match ? match[1] : name.trim();
}

export function initials(name: string) {
  const parts = shortName(name).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0]?.slice(0, 1).toUpperCase() || "?";
}

export function Avatar({ name, size = 24 }: { name: string | null; size?: number }) {
  if (!name) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-input text-[10px] text-muted-foreground"
        style={{ width: size, height: size }}
      >
        ?
      </span>
    );
  }
  const color = personColor(name);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `color-mix(in oklch, ${color} 26%, transparent)`,
        color: `color-mix(in oklch, ${color} 55%, var(--foreground))`,
      }}
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
    <span className="inline-flex min-w-0 items-center gap-2" title={name ?? undefined}>
      <Avatar name={name} />
      <span className={`truncate text-sm ${name ? "" : "text-muted-foreground"}`}>{name ? shortName(name) : "—"}</span>
    </span>
  );
  if (!onChange || disabled || !options) return face;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger type="button" className="inline-flex h-7 max-w-full min-w-0 cursor-pointer items-center rounded-[6px] border-0 bg-transparent px-1 hover:bg-muted">
        {face}
      </PopoverTrigger>
      <PopoverContent className="max-h-72 w-64 gap-0.5 overflow-y-auto p-1" align="start">
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
            <Avatar name={option.label === "—" ? null : option.label} />
            <span className="min-w-0 flex-1 truncate">{option.label === "—" ? tt("未指派", "Unassigned") : option.label}</span>
            {option.label === name && <CheckIcon className="size-4 text-muted-foreground" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
