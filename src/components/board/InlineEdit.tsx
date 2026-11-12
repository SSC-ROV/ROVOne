"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PencilIcon } from "lucide-react";

type InlineEditProps = {
  value: string;
  onCommit: (next: string) => void;
  /** What to show when not editing; defaults to the raw value. */
  display?: ReactNode;
  disabled?: boolean;
  type?: "text" | "number" | "url";
  min?: number;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
};

/** Text that turns into an input on click. Enter or blur saves, Escape cancels. */
export function InlineEdit({
  value,
  onCommit,
  display,
  disabled,
  type = "text",
  min,
  placeholder,
  ariaLabel,
  className = "",
  inputClassName = "",
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const shown = display ?? (value || <span className="text-muted-foreground">{placeholder ?? "—"}</span>);
  if (disabled) return <span className={className}>{shown}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`group/edit inline-flex max-w-full min-w-0 cursor-text items-center gap-1 rounded-[6px] px-1 -mx-1 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        onClick={() => {
          cancelled.current = false;
          setDraft(value);
          setEditing(true);
        }}
      >
        <span className="min-w-0 truncate">{shown}</span>
        <PencilIcon className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover/edit:opacity-100" aria-hidden />
      </button>
    );
  }

  const finish = () => {
    setEditing(false);
    if (!cancelled.current && draft !== value) onCommit(draft);
  };

  return (
    <input
      ref={inputRef}
      type={type}
      min={min}
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={`h-7 min-w-0 rounded-[6px] border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${inputClassName}`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
