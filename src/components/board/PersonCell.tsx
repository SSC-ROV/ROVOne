"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { tt } from "@/lib/i18n-core";

const COLORS = ["var(--c-blue)", "var(--c-green)", "var(--c-purple)", "var(--c-orange)", "var(--c-pink)", "var(--c-teal)", "var(--c-yellow)"];

export function personColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % COLORS.length;
  return COLORS[hash];
}

/**
 * "Jude (Liu Pak Hei Jude Asher)" → "Jude".
 * "(Teacher) Mr CHAN Yuk Wang, Eric" → "Mr CHAN Yuk Wang, Eric" (leading role tag dropped).
 * Other names are returned as is.
 */
export function shortName(name: string) {
  const trimmed = name.trim();
  const withoutPrefix = trimmed.replace(/^\([^)]*\)\s*/, "") || trimmed;
  const match = /^(.+?)\s*\(.+\)$/.exec(withoutPrefix);
  return match ? match[1] : withoutPrefix;
}

export function initials(name: string) {
  const parts = shortName(name)
    .split(/[\s,]+/)
    .map((part) => part.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
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
        background: color,
        color: "#fff",
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
  emptyLabel,
}: {
  name: string | null;
  options?: { value: string; label: string }[];
  disabled?: boolean;
  onChange?: (value: string) => void;
  /** Label for the "—" option (defaults to "Unassigned"). */
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const face = (
    <span className="flex min-w-0 max-w-full items-center gap-2" title={name ?? undefined}>
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
            <span className="min-w-0 flex-1 truncate">{option.label === "—" ? emptyLabel ?? tt("未指派", "Unassigned") : option.label}</span>
            {option.label === name && <CheckIcon className="size-4 text-muted-foreground" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Overlapping avatars for several people (shows "+N" past `max`). */
export function AvatarStack({ names, size = 24, max = 3 }: { names: string[]; size?: number; max?: number }) {
  if (names.length === 0) return <Avatar name={null} size={size} />;
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="inline-flex shrink-0 items-center" title={names.join(", ")}>
      {shown.map((name, i) => (
        <span key={`${name}-${i}`} className="rounded-full ring-2 ring-card" style={{ marginLeft: i ? -Math.round(size * 0.3) : 0 }}>
          <Avatar name={name} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-card"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.4), marginLeft: -Math.round(size * 0.3) }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/** "Jude" for one person, "Jude, Amy" for two, "Jude +2" for more. */
export function peopleSummary(names: string[]) {
  if (names.length === 0) return "";
  if (names.length <= 2) return names.map(shortName).join(", ");
  return `${shortName(names[0])} +${names.length - 1}`;
}

/** Checkbox list of people; toggling keeps the list open so several can be picked. */
export function PeopleChecklist({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const list = options.filter((option) => option.value !== "none" && (!needle || option.label.toLowerCase().includes(needle)));
  return (
    <>
      {options.length > 7 && (
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={tt("搜尋成員…", "Search people…")}
          className="mb-1 h-8 w-full shrink-0 rounded-[4px] border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
        />
      )}
      {list.map((option) => {
        const id = Number(option.value);
        const checked = value.includes(id);
        return (
          <button
            key={option.value}
            type="button"
            role="menuitemcheckbox"
            aria-checked={checked}
            className="flex min-h-8 w-full shrink-0 items-center gap-2 rounded-[6px] px-2 py-1 text-left text-sm hover:bg-muted"
            onClick={() => onChange(checked ? value.filter((item) => item !== id) : [...value, id])}
          >
            <span
              className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${
                checked ? "border-[var(--c-blue)] bg-[var(--c-blue)] text-white" : "border-input bg-background"
              }`}
              aria-hidden
            >
              {checked && <CheckIcon className="size-3" strokeWidth={3} />}
            </span>
            <Avatar name={option.label} size={22} />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
          </button>
        );
      })}
      {list.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{tt("找不到成員", "No matching people")}</p>}
      {value.length > 0 && (
        <>
          <div className="my-1 h-px shrink-0 bg-border" />
          <button type="button" className="h-8 w-full shrink-0 rounded-[6px] px-2 text-left text-sm text-muted-foreground hover:bg-muted" onClick={() => onChange([])}>
            {tt("清除負責人", "Clear assignees")}
          </button>
        </>
      )}
    </>
  );
}

/** Table cell for a task's assignees: stacked avatars + names; opens a multi-select list. */
export function PeopleCell({
  names,
  value,
  options,
  disabled,
  onChange,
}: {
  names: string[];
  value: number[];
  options?: { value: string; label: string }[];
  disabled?: boolean;
  onChange?: (ids: number[]) => void;
}) {
  const face = (
    <span className="flex min-w-0 max-w-full items-center gap-2" title={names.join(", ") || undefined}>
      <AvatarStack names={names} />
      <span className={`truncate text-sm ${names.length ? "" : "text-muted-foreground"}`}>{names.length ? peopleSummary(names) : "—"}</span>
    </span>
  );
  if (!onChange || disabled || !options) return face;
  return (
    <Popover>
      <PopoverTrigger type="button" className="inline-flex h-7 max-w-full min-w-0 cursor-pointer items-center rounded-[6px] border-0 bg-transparent px-1 hover:bg-muted">
        {face}
      </PopoverTrigger>
      <PopoverContent className="max-h-80 w-64 max-w-[calc(100vw-2rem)] gap-0.5 overflow-y-auto p-1" align="start">
        <PeopleChecklist options={options} value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
