"use client";

import { useState, type ReactNode } from "react";
import { CheckIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { tt } from "@/lib/i18n-core";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, shortName } from "@/components/board/PersonCell";

/** "Jude (Liu Pak Hei Jude Asher)" → "Liu Pak Hei Jude Asher"; "" when there is no full name. */
function fullName(name: string) {
  const match = /^.+?\s*\((.+)\)$/.exec(name.trim());
  return match ? match[1] : "";
}

/** Hover style shared by clickable sidebar rows: the whole row lights up. */
export const ROW_HOVER = "rounded-[6px] transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none data-popup-open:bg-muted";

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
        checked ? "border-[var(--c-blue)] bg-[var(--c-blue)] text-white" : "border-input bg-background"
      }`}
      aria-hidden
    >
      {checked && <CheckIcon className="size-3" strokeWidth={3} />}
    </span>
  );
}

function PickerShell({
  title,
  search,
  onSearch,
  placeholder,
  children,
}: {
  title: string;
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="border-b border-border px-3 py-2.5 text-sm font-semibold">{title}</div>
      <div className="border-b border-border p-2">
        <label className="flex h-8 items-center gap-2 rounded-[6px] border border-input bg-background px-2 focus-within:border-[var(--c-blue)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--c-blue)_35%,transparent)]">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <div className="flex max-h-80 flex-col overflow-y-auto py-1">{children}</div>
    </>
  );
}

/** Sidebar section whose whole area opens a picker (GitHub-style: header + current value). */
export function SidebarPicker({
  title,
  disabled,
  face,
  open,
  onOpenChange,
  children,
  width = "w-80",
}: {
  title: string;
  disabled?: boolean;
  face: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  width?: string;
}) {
  const header = (
    <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
      {title}
      {!disabled && <SettingsIcon className="size-3.5 opacity-70" aria-hidden />}
    </span>
  );
  if (disabled) {
    return (
      <div className="px-2 py-1.5">
        {header}
        {face}
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger type="button" className={`block w-full cursor-pointer px-2 py-1.5 text-left ${ROW_HOVER}`}>
        {header}
        {face}
      </PopoverTrigger>
      <PopoverContent className={`${width} gap-0 overflow-hidden p-0`} align="end" sideOffset={6}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** "Select assignees" list: checkbox, avatar, nickname in bold, full name muted. */
export function AssigneeList({
  people,
  value,
  onChange,
}: {
  people: { value: string; label: string }[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const list = people
    .filter((person) => person.value !== "none")
    .filter((person) => !needle || person.label.toLowerCase().includes(needle))
    .sort((a, b) => Number(value.includes(Number(b.value))) - Number(value.includes(Number(a.value))));
  return (
    <PickerShell title={tt("選擇負責人", "Select assignees")} search={search} onSearch={setSearch} placeholder={tt("篩選負責人", "Filter assignees")}>
      {list.map((person) => {
        const id = Number(person.value);
        const checked = value.includes(id);
        const full = fullName(person.label);
        return (
          <button
            key={person.value}
            type="button"
            role="menuitemcheckbox"
            aria-checked={checked}
            onClick={() => onChange(checked ? value.filter((item) => item !== id) : [...value, id])}
            className="mx-1 flex min-h-10 items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
          >
            <Checkbox checked={checked} />
            <Avatar name={person.label} size={22} />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{shortName(person.label)}</span>
              {full && <span className="ml-1.5 text-muted-foreground">{full}</span>}
            </span>
          </button>
        );
      })}
      {list.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">{tt("找不到成員", "No matching people")}</p>}
    </PickerShell>
  );
}

export type LabelGroup = {
  key: string;
  title: string;
  value: string;
  options: { value: string; label: string; color: string; hint?: string }[];
  onChange: (value: string) => void;
};

/** "Apply labels" list: one section per label group, a single pick per group. */
export function LabelList({ groups }: { groups: LabelGroup[] }) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const shown = groups
    .map((group) => ({ ...group, options: group.options.filter((option) => !needle || option.label.toLowerCase().includes(needle)) }))
    .filter((group) => group.options.length > 0);
  return (
    <PickerShell title={tt("套用標籤", "Apply labels")} search={search} onSearch={setSearch} placeholder={tt("篩選標籤", "Filter labels")}>
      {shown.map((group) => (
        <div key={group.key} className="py-1">
          <div className="px-3 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{group.title}</div>
          {group.options.map((option) => {
            const checked = option.value === group.value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => group.onChange(option.value)}
                className="mx-1 flex min-h-9 w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-[6px] px-2 py-1 text-left text-sm transition-colors hover:bg-muted"
              >
                <Checkbox checked={checked} />
                <span className="size-3 shrink-0 rounded-full" style={{ background: option.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
      ))}
      {shown.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">{tt("找不到標籤", "No matching labels")}</p>}
    </PickerShell>
  );
}

/** A "Label   value" field row that lights up on hover and opens a picker (GitHub project fields). */
export function FieldRow({
  label,
  face,
  disabled,
  children,
}: {
  label: string;
  face: ReactNode;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const inner = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0">{face}</span>
    </>
  );
  const cls = "grid min-h-9 w-full grid-cols-[5.5rem_1fr] items-center gap-x-2 px-2 text-left text-sm";
  if (disabled) return <div className={cls}>{inner}</div>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger type="button" className={`${cls} cursor-pointer ${ROW_HOVER}`}>
        {inner}
      </PopoverTrigger>
      <PopoverContent className="w-56 gap-0.5 p-1" align="start" sideOffset={4}>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** Plain option list used inside a FieldRow popover. */
export function OptionList({
  value,
  options,
  icon,
  onPick,
}: {
  value: string;
  options: { value: string; label: string; color: string }[];
  icon?: (option: { value: string; color: string }) => ReactNode;
  onPick: (value: string) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-left text-sm hover:bg-muted"
          onClick={() => onPick(option.value)}
        >
          {icon ? icon(option) : <span className="size-2.5 shrink-0 rounded-full" style={{ background: option.color }} aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          {option.value === value && <CheckIcon className="size-4 text-muted-foreground" />}
        </button>
      ))}
    </>
  );
}
