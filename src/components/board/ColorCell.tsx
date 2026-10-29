"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ColorOption = { value: string; label: string; color: string };

function labelColor(color: string) {
  return color.toLowerCase() === "#c4c4c4" ? "#323338" : "#ffffff";
}

export function ColorCell({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: ColorOption[];
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  const color = current?.color ?? "#c4c4c4";
  const label = current?.label ?? value;
  const face = (
    <span
      className="flex h-9 w-full min-w-[8.5rem] items-center justify-center px-2 text-sm"
      style={{ background: color, color: labelColor(color) }}
    >
      {label}
    </span>
  );

  if (!onChange || disabled) return face;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className="block w-full cursor-pointer border-0 bg-transparent p-0"
        disabled={disabled}
      >
        {face}
      </PopoverTrigger>
      <PopoverContent
        className="gap-1 rounded-[4px] p-1"
        style={{ width: "max(var(--anchor-width), 8.5rem)" }}
        align="start"
        sideOffset={2}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="flex h-8 w-full items-center justify-center text-sm"
            style={{
              background: option.color,
              color: labelColor(option.color),
              outline: option.value === value ? "2px solid #323338" : undefined,
              outlineOffset: -2,
            }}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            {option.label}
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
  return <ColorCell {...props} />;
}

export function PriorityCell(props: {
  value: string;
  options: ColorOption[];
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return <ColorCell {...props} />;
}
