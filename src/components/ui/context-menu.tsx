"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type ContextMenuItem =
  | { type?: "item"; label: string; icon?: ReactNode; hint?: string; danger?: boolean; disabled?: boolean; onSelect: () => void }
  | { type: "separator" }
  | { type: "label"; label: string };

export type ContextMenuState = { x: number; y: number; items: ContextMenuItem[] } | null;

/** A right-click menu at the cursor. Closes on outside click, Escape, scroll or resize. Arrow keys move focus. */
export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(menu.x, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(menu.y, window.innerHeight - height - 8));
    setPos({ left, top });
    ref.current.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: Event) => {
      if (event.type === "mousedown" && ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-56 rounded-[10px] border border-border bg-popover p-1 text-sm text-popover-foreground shadow-xl"
      style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? "visible" : "hidden" }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.items.map((item, index) => {
        if (item.type === "separator") return <div key={index} className="my-1 h-px bg-border" />;
        if (item.type === "label") {
          return (
            <p key={index} className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
              {item.label}
            </p>
          );
        }
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left outline-none hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 ${
              item.danger ? "text-destructive" : ""
            }`}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.icon && <span className={item.danger ? "" : "text-muted-foreground"}>{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
