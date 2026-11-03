"use client";

import { useState, type ReactNode } from "react";
import { CalendarIcon, CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { tt } from "@/lib/i18n-core";
import { addDaysStr, daysBetween, fmtMD } from "@/lib/date";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task } from "@/lib/types";
import { Label } from "@/components/board/ColorCell";

export const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export type DueState = "overdue" | "today" | "soon" | "later" | "none" | "done";

/** Where a task's due date sits relative to today. Done tasks are never overdue. */
export function dueState(task: Pick<Task, "due_date" | "status">, today: string): DueState {
  if (task.status === "done") return "done";
  if (!task.due_date) return "none";
  const diff = daysBetween(today, task.due_date);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "soon";
  return "later";
}

export function dueText(due: string | null, today: string): string {
  if (!due) return tt("無截止日", "No date");
  const diff = daysBetween(today, due);
  if (diff === 0) return tt("今天", "Today");
  if (diff === 1) return tt("明天", "Tomorrow");
  if (diff === -1) return tt("昨天", "Yesterday");
  if (diff < 0) return tt(`逾期 ${-diff} 天`, `${-diff}d overdue`);
  if (diff <= 7) return tt(`${diff} 天後`, `In ${diff}d`);
  return fmtMD(due);
}

const DUE_TONE: Record<DueState, string> = {
  overdue: "text-destructive font-medium",
  today: "text-warning font-medium",
  soon: "text-foreground",
  later: "text-foreground",
  none: "text-muted-foreground",
  done: "text-muted-foreground",
};

/** Due date label with a quick-pick popover (today, tomorrow, next week, custom, clear). */
export function DueCell({
  task,
  today,
  disabled,
  onChange,
  className = "",
}: {
  task: Pick<Task, "due_date" | "status">;
  today: string;
  disabled?: boolean;
  onChange?: (value: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const state = dueState(task, today);
  const face = (
    <span className={`inline-flex items-center gap-1.5 text-sm tabular-nums ${DUE_TONE[state]}`}>
      <CalendarIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
      <span>{state === "done" && task.due_date ? fmtMD(task.due_date) : dueText(task.due_date, today)}</span>
      {task.due_date && state !== "later" && state !== "done" && (
        <span className="text-xs font-normal text-muted-foreground no-underline">{fmtMD(task.due_date)}</span>
      )}
    </span>
  );
  if (disabled || !onChange) return <span className={className}>{face}</span>;
  const pick = (value: string | null) => {
    onChange(value);
    setOpen(false);
  };
  const quick = [
    { label: tt("今天", "Today"), value: today },
    { label: tt("明天", "Tomorrow"), value: addDaysStr(today, 1) },
    { label: tt("下週", "Next week"), value: addDaysStr(today, 7) },
    { label: tt("兩週後", "In 2 weeks"), value: addDaysStr(today, 14) },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={`inline-flex h-7 items-center rounded-[4px] px-1.5 hover:bg-muted ${className}`}
        aria-label={tt("截止日", "Due date")}
      >
        {face}
      </PopoverTrigger>
      <PopoverContent className="w-56 gap-1 p-1.5" align="start">
        {quick.map((option) => (
          <button
            key={option.label}
            type="button"
            className="flex h-8 items-center justify-between rounded-[4px] px-2 text-sm hover:bg-muted"
            onClick={() => pick(option.value)}
          >
            <span>{option.label}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{fmtMD(option.value)}</span>
          </button>
        ))}
        <div className="my-1 h-px bg-border" />
        <input
          type="date"
          value={task.due_date ?? ""}
          onChange={(event) => pick(event.target.value || null)}
          className="h-8 rounded-[4px] border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
          aria-label={tt("自訂日期", "Custom date")}
        />
        {task.due_date && (
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-[4px] px-2 text-sm text-muted-foreground hover:bg-muted"
            onClick={() => pick(null)}
          >
            <XIcon className="size-3.5" /> {tt("清除截止日", "Clear date")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Thin progress bar with an optional "3/5" label. */
export function Progress({ done, total, label = true, className = "" }: { done: number; total: number; label?: boolean; className?: string }) {
  if (total === 0) return label ? <span className="text-xs text-muted-foreground">—</span> : null;
  const pct = Math.round((done / total) * 100);
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} title={`${done}/${total}`}>
      <span className="h-1.5 w-full min-w-12 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: "var(--c-purple)" }} />
      </span>
      {label && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{done}/{total}</span>}
    </span>
  );
}

export function Choice({
  value,
  options,
  disabled,
  onChange,
  className,
  ariaLabel,
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <Select value={value} onValueChange={(next) => next != null && onChange(String(next))} disabled={disabled}>
      <SelectTrigger size="sm" className={className} aria-label={ariaLabel}>
        <SelectValue>{current?.label ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export type FilterOption = { value: string; label: string; color?: string; hint?: ReactNode };

/** A filter pill that opens a checkbox list. Shows the picked labels (or a count) when active. */
export function MultiFilter({
  label,
  icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  options: FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const active = value.length > 0;
  const picked = options.filter((option) => value.includes(option.value));
  const summary = picked.length === 1 ? picked[0].label : picked.length > 1 ? `${picked.length}` : "";
  const needle = search.trim().toLowerCase();
  const shown = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  return (
    <Popover onOpenChange={(open) => { if (!open) setSearch(""); }}>
      <PopoverTrigger
        type="button"
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
          active
            ? "border-transparent bg-primary-soft text-primary-soft-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {icon}
        <span>{label}</span>
        {summary && <span className="max-w-28 truncate font-medium">: {summary}</span>}
        <ChevronDownIcon className="size-3.5 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-60 gap-1 p-1.5" align="start">
        {options.length > 7 && (
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tt("搜尋…", "Search…")}
            className="mb-1 h-8 rounded-[4px] border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
          />
        )}
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {shown.map((option) => {
            const checked = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                className="flex h-8 shrink-0 items-center gap-2 rounded-[4px] px-2 text-left text-sm hover:bg-muted"
                onClick={() => onChange(checked ? value.filter((item) => item !== option.value) : [...value, option.value])}
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border ${
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  }`}
                >
                  {checked && <CheckIcon className="size-3" />}
                </span>
                {option.color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: option.color }} />}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint != null && <span className="text-xs tabular-nums text-muted-foreground">{option.hint}</span>}
              </button>
            );
          })}
          {shown.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{tt("沒有選項", "No options")}</p>}
        </div>
        {active && (
          <>
            <div className="my-1 h-px bg-border" />
            <button type="button" className="h-8 rounded-[4px] px-2 text-left text-sm text-muted-foreground hover:bg-muted" onClick={() => onChange([])}>
              {tt("清除", "Clear")}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Small coloured label used on cards (priority, subteam). */
export function Pill({ color, children }: { color: string; children: ReactNode }) {
  return <Label color={color}>{children}</Label>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="hidden h-5 min-w-5 items-center justify-center rounded-[4px] border border-border bg-muted px-1 font-sans text-[11px] text-muted-foreground sm:inline-flex">
      {children}
    </kbd>
  );
}
