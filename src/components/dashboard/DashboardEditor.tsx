"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  LayoutTemplateIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
import { tt } from "@/lib/i18n-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Choice } from "@/components/tasks/shared";
import {
  TEMPLATES,
  WIDGETS,
  WIDGET_CATEGORIES,
  WIDGET_SIZES,
  findFloatKey,
  sizeDef,
  widgetDef,
  widgetSpan,
  type TemplateKey,
  type WidgetCategory,
  type WidgetConfig,
  type WidgetDef,
  type WidgetSettings,
  type WidgetSize,
} from "@/lib/dashboard/catalog";

/**
 * Grid placement per size. Narrow containers use a 2-column grid (small = half, everything else full
 * width); wide ones use 12 columns and the widget's span (see widgetSpan) through --span.
 */
export const SIZE_CLASS: Record<WidgetSize, string> = {
  s: "col-span-1 row-span-1",
  m: "col-span-2 row-span-1",
  l: "col-span-2 row-span-2",
  xl: "col-span-2 row-span-2",
};
const WIDE_SPAN = "@3xl:[grid-column:span_var(--span)/span_var(--span)]";

const label = (x: { zh: string; en: string }) => tt(x.zh, x.en);

// ---------- Widget frame ----------

export function WidgetFrame({
  widget,
  title,
  chips,
  editing,
  index,
  count,
  subteams,
  dragging,
  onRemove,
  onChange,
  onMove,
  dragProps,
  children,
}: {
  widget: WidgetConfig;
  title: string;
  chips: string[];
  editing: boolean;
  index: number;
  count: number;
  subteams: { key: string; label: string }[];
  dragging: boolean;
  onRemove: () => void;
  onChange: (next: WidgetConfig) => void;
  onMove: (delta: number) => void;
  dragProps: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  children: ReactNode;
}) {
  return (
    <div
      id={`w-${widget.id}`}
      className={`${SIZE_CLASS[widget.size]} ${WIDE_SPAN} relative min-w-0 ${editing ? "widget-wiggle" : ""} ${dragging ? "opacity-40" : ""}`}
      style={{ "--span": widgetSpan(widget), ...(editing ? { animationDelay: `${(index % 5) * -0.13}s` } : {}) } as React.CSSProperties}
      {...(editing ? dragProps : {})}
    >
      <section
        className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border bg-card transition-shadow duration-200 ${
          editing ? "cursor-grab border-border shadow-sm active:cursor-grabbing" : "border-border"
        }`}
      >
        <header className="flex min-w-0 items-center gap-2 px-3.5 pt-3 pb-1.5">
          <h2 className="truncate text-[13px] font-semibold text-foreground" title={title}>{title}</h2>
          {chips.map((c) => (
            <span key={c} className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] leading-[18px] text-muted-foreground">{c}</span>
          ))}
          {editing && (
            <WidgetSettingsButton widget={widget} subteams={subteams} index={index} count={count} onChange={onChange} onMove={onMove} />
          )}
        </header>
        <div className={`relative min-h-0 flex-1 px-3.5 pb-3 ${widget.size === "s" ? "" : "overflow-auto"}`}>
          {children}
          {/* While editing, block clicks on links inside so the widget can be dragged. */}
          {editing && <div className="absolute inset-0" aria-hidden />}
        </div>
      </section>
      {editing && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={tt(`移除「${title}」`, `Remove ${title}`)}
          title={tt("移除", "Remove")}
          className="group/remove absolute -top-3.5 -left-3.5 z-10 flex size-9 items-center justify-center"
        >
          <span className="flex size-6 items-center justify-center rounded-full border border-border bg-popover text-foreground shadow-md transition-colors group-hover/remove:bg-[var(--c-red)] group-hover/remove:text-white">
            <MinusIcon className="size-3.5" strokeWidth={3} />
          </span>
        </button>
      )}
    </div>
  );
}

function WidgetSettingsButton({
  widget,
  subteams,
  index,
  count,
  onChange,
  onMove,
}: {
  widget: WidgetConfig;
  subteams: { key: string; label: string }[];
  index: number;
  count: number;
  onChange: (next: WidgetConfig) => void;
  onMove: (delta: number) => void;
}) {
  const def = widgetDef(widget.type)!;
  const set = (patch: Partial<WidgetSettings>) => onChange({ ...widget, settings: { ...widget.settings, ...patch } });
  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="icon-xs" className="ml-auto shrink-0" aria-label={tt("元件設定", "Widget settings")} title={tt("元件設定", "Widget settings")} />}
      >
        <Settings2Icon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3 p-3">
        <p className="text-sm font-semibold">{label(def)}</p>
        <Field label={tt("標題", "Title")}>
          <Input
            className="h-8"
            placeholder={label(def)}
            value={widget.settings.title ?? ""}
            maxLength={80}
            onChange={(e) => set({ title: e.target.value || undefined })}
          />
        </Field>
        <Field label={tt("大小", "Size")}>
          <SizePicker sizes={def.sizes} value={widget.size} onPick={(size) => onChange({ ...widget, size, w: undefined })} compact />
        </Field>
        {def.settings.includes("subteam") && (
          <Field label={tt("組別", "Subteam")}>
            <Choice
              value={widget.settings.subteam ?? ""}
              onChange={(v) => set({ subteam: v || undefined })}
              options={[{ value: "", label: tt("全部組別", "All subteams") }, ...subteams.map((s) => ({ value: s.key, label: s.label }))]}
              className="w-full"
              ariaLabel={tt("組別", "Subteam")}
            />
          </Field>
        )}
        {def.settings.includes("groupBy") && (
          <Field label={tt("分組方式", "Group by")}>
            <Choice
              value={widget.settings.groupBy ?? "subteam"}
              onChange={(v) => set({ groupBy: v === "person" ? "person" : "subteam" })}
              options={[
                { value: "subteam", label: tt("組別", "Subteam") },
                { value: "person", label: tt("成員", "Person") },
              ]}
              className="w-full"
              ariaLabel={tt("分組方式", "Group by")}
            />
          </Field>
        )}
        {def.settings.includes("mine") && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--c-blue)]"
              checked={!!widget.settings.mine}
              onChange={(e) => set({ mine: e.target.checked || undefined })}
            />
            {tt("只看指派給我的任務", "Only tasks assigned to me")}
          </label>
        )}
        <div className="flex items-center gap-2 border-t border-border pt-2.5">
          <span className="text-xs text-muted-foreground">{tt("位置", "Position")}</span>
          <Button type="button" variant="outline" size="icon-sm" className="ml-auto" disabled={index === 0} onClick={() => onMove(-1)} aria-label={tt("往前移", "Move earlier")}>
            <ArrowLeftIcon />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={tt("往後移", "Move later")}>
            <ArrowRightIcon />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Field({ label: text, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{text}</span>
      {children}
    </div>
  );
}

// ---------- Size picker (Apple-widget shaped buttons) ----------

const SHAPE: Record<WidgetSize, { w: number; h: number }> = {
  s: { w: 30, h: 30 },
  m: { w: 64, h: 30 },
  l: { w: 64, h: 64 },
  xl: { w: 132, h: 64 },
};

export function SizePicker({
  sizes,
  value,
  onPick,
  compact,
}: {
  sizes: readonly WidgetSize[];
  value?: WidgetSize;
  onPick: (size: WidgetSize) => void;
  compact?: boolean;
}) {
  const scale = compact ? 0.6 : 1;
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      {WIDGET_SIZES.filter((s) => sizes.includes(s.key)).map((s) => {
        const shape = SHAPE[s.key];
        const active = value === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onPick(s.key)}
            aria-pressed={value ? active : undefined}
            aria-label={tt(`${s.zh}（${s.cols}×${s.rows}）`, `${s.en} (${s.cols}×${s.rows})`)}
            title={tt(`${s.zh}（${s.cols}×${s.rows}）`, `${s.en} (${s.cols}×${s.rows})`)}
            className="group flex flex-col items-center gap-1 rounded-[8px] p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span
              className={`block rounded-[8px] border transition-colors duration-150 ${
                active
                  ? "border-[var(--c-blue)] bg-primary-soft"
                  : "border-border bg-muted group-hover:border-[var(--c-blue)] group-hover:bg-primary-soft"
              }`}
              style={{ width: shape.w * scale, height: shape.h * scale }}
            />
            <span className={`text-[11px] ${active ? "text-[var(--c-blue)]" : "text-muted-foreground"}`}>{label(s)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Component library ----------

export function WidgetLibrary({ onAdd, onClose }: { onAdd: (type: string, size: WidgetSize) => void; onClose?: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = (WIDGETS as readonly WidgetDef[]).filter(
    (w) => !needle || [w.zh, w.en, w.descZh, w.descEn].some((s) => s.toLowerCase().includes(needle))
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h2 className="text-[15px] font-semibold">{tt("元件庫", "Components")}</h2>
        {onClose && (
          <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} aria-label={tt("關閉", "Close")}>
            <XIcon />
          </Button>
        )}
      </div>
      <div className="relative px-3 pb-2">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-5.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-8 pl-7" placeholder={tt("搜尋元件", "Search components")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {WIDGET_CATEGORIES.map((cat) => {
          const items = list.filter((w) => w.category === cat.key);
          if (items.length === 0) return null;
          return (
            <section key={cat.key} className="mt-2">
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{label(cat)}</h3>
              <ul className="flex flex-col gap-1.5">
                {items.map((w) => {
                  const expanded = open === w.type;
                  return (
                    <li key={w.type} className={`rounded-[10px] border transition-colors duration-150 ${expanded ? "border-[var(--c-blue)] bg-card" : "border-border bg-card"}`}>
                      <div className="flex items-start gap-2.5 p-2.5">
                        <CategoryGlyph category={w.category} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-5">{label(w)}</p>
                          <p className="text-xs leading-4 text-muted-foreground">{tt(w.descZh, w.descEn)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : w.type)}
                          aria-expanded={expanded}
                          aria-label={tt(`新增「${w.zh}」`, `Add ${w.en}`)}
                          title={tt("新增", "Add")}
                          className="group/add -my-1 -mr-1 flex size-9 shrink-0 items-center justify-center"
                        >
                          <span
                            className={`flex size-7 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ${
                              expanded ? "rotate-45 bg-muted text-foreground" : "bg-[var(--c-blue)] text-white group-hover/add:brightness-110"
                            }`}
                          >
                            <PlusIcon className="size-4" strokeWidth={2.5} />
                          </span>
                        </button>
                      </div>
                      {expanded && (
                        <div className="widget-sizes-in border-t border-border px-2.5 pt-2 pb-2.5">
                          <p className="mb-1.5 text-xs text-muted-foreground">{tt("選擇大小", "Pick a size")}</p>
                          <SizePicker
                            sizes={w.sizes}
                            onPick={(size) => {
                              onAdd(w.type, size);
                              setOpen(null);
                            }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{tt("找不到元件", "No matching components")}</p>}
      </div>
    </div>
  );
}

const CATEGORY_COLOR: Record<WidgetCategory, string> = {
  numbers: "var(--c-blue)",
  tables: "var(--c-green)",
  charts: "var(--c-purple)",
  team: "var(--c-orange)",
};

function CategoryGlyph({ category }: { category: WidgetCategory }) {
  const color = CATEGORY_COLOR[category];
  return (
    <span
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[8px]"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
      aria-hidden
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        {category === "numbers" && <path d="M4 3v10M8 6v7M12 9v4" />}
        {category === "tables" && <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />}
        {category === "charts" && <path d="M2.5 12.5 6 8l3 2.5L13.5 4" />}
        {category === "team" && (
          <>
            <circle cx="6" cy="6" r="2.2" />
            <path d="M2.5 13c.5-2.2 1.9-3.3 3.5-3.3S9 10.8 9.5 13M10.5 4.2a2 2 0 0 1 0 3.6M11.5 9.9c1 .4 1.7 1.4 2 3.1" />
          </>
        )}
      </svg>
    </span>
  );
}

// ---------- Templates popup ----------

export function TemplatesDialog({
  open,
  onOpenChange,
  current,
  subteams,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: TemplateKey | null;
  subteams: { key: string; zh: string; en: string }[];
  onPick: (key: TemplateKey) => void;
}) {
  const floatKey = findFloatKey(subteams);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[12px] border border-border bg-popover text-popover-foreground shadow-xl transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">{tt("範本", "Templates")}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {tt("選一個做為起點，之後還可以自由增減元件。", "Pick a starting point. You can still add, remove and resize widgets afterwards.")}
              </Dialog.Description>
            </div>
            <Dialog.Close render={<Button type="button" variant="ghost" size="icon-sm" className="ml-auto" aria-label={tt("關閉", "Close")} />}>
              <XIcon />
            </Dialog.Close>
          </div>
          <div className="grid gap-4 overflow-y-auto p-5 md:grid-cols-3">
            {TEMPLATES.map((tpl) => {
              const seeds = tpl.build({ floatKey });
              const active = current === tpl.key;
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => onPick(tpl.key)}
                  className={`group flex flex-col overflow-hidden rounded-[12px] border text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
                    active ? "border-[var(--c-blue)]" : "border-border hover:border-[var(--c-blue)]"
                  }`}
                >
                  <div className="bg-muted p-3">
                    <div className="grid grid-cols-12 gap-1 [grid-auto-flow:dense] [grid-auto-rows:14px]">
                      {seeds.map(([type, size, , w], i) => {
                        const def = widgetDef(type)!;
                        const s = sizeDef(size);
                        return (
                          <span
                            key={i}
                            className="rounded-[3px] border border-border/60"
                            style={{
                              gridColumn: `span ${widgetSpan({ size, w })}`,
                              gridRow: `span ${s.rows}`,
                              background: `color-mix(in srgb, ${CATEGORY_COLOR[def.category]} 22%, var(--card))`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 bg-card p-3.5">
                    <p className="flex items-center gap-2 font-semibold">
                      {label(tpl)}
                      {active && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-1.5 text-[11px] font-medium leading-[18px] text-primary-soft-foreground">
                          <CheckIcon className="size-3" /> {tt("目前", "Current")}
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] text-muted-foreground">{tt(tpl.descZh, tpl.descEn)}</p>
                    <p className="mt-auto pt-2 text-xs text-muted-foreground">{tt(`${seeds.length} 個元件`, `${seeds.length} widgets`)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const TemplatesIcon = LayoutTemplateIcon;
