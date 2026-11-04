"use client";

// Small hand-drawn SVG charts for dashboard widgets. They size themselves to the widget with a
// ResizeObserver, keep grid and axes recessive, and show a tooltip on hover/tap.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type Series = { key: string; label: string; color: string; dashed?: boolean };

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Rounded-up "nice" axis maximum and its tick step. */
function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: 1, step: 1 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return { max: Math.ceil(max / step) * step, step };
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          {s.dashed ? (
            <svg width="14" height="4" aria-hidden><path d="M0 2h14" stroke={s.color} strokeWidth="2" strokeDasharray="4 3" /></svg>
          ) : (
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
          )}
          <span className="truncate">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 70), Math.max(width - 70, 70));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-28 -translate-x-1/2 -translate-y-full rounded-[6px] border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
      style={{ left, top: Math.max(y - 6, 0) }}
    >
      {children}
    </div>
  );
}

function TipRow({ color, label, value, dashed }: { color: string; label: string; value: ReactNode; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {dashed ? (
        <svg width="10" height="4" aria-hidden><path d="M0 2h10" stroke={color} strokeWidth="2" strokeDasharray="3 2" /></svg>
      ) : (
        <span className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} />
      )}
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-2 font-medium tabular-nums">{value}</span>
    </div>
  );
}

const PAD = { top: 8, right: 8, bottom: 22, left: 28 };

/** Vertical bars, stacked by series, one per category. */
export function StackedBars({
  categories,
  series,
  values,
  tooltipTitle,
  maxLabels = 12,
}: {
  categories: string[];
  series: Series[];
  /** values[categoryIndex][seriesKey] */
  values: Record<string, number>[];
  tooltipTitle?: (index: number) => string;
  maxLabels?: number;
}) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const totals = values.map((v) => series.reduce((a, s) => a + (v[s.key] ?? 0), 0));
  const { max, step } = niceScale(Math.max(0, ...totals));
  const plotW = Math.max(w - PAD.left - PAD.right, 0);
  const plotH = Math.max(h - PAD.top - PAD.bottom, 0);
  const band = categories.length ? plotW / categories.length : 0;
  const barW = Math.max(Math.min(band * 0.6, 40), 2);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  // Skip labels so they never collide: estimate each label's width from its length (~6px a character).
  const labelW = Math.max(...categories.map((c) => c.length), 1) * 6 + 10;
  const fit = Math.max(1, Math.min(maxLabels, Math.floor(plotW / labelW)));
  const labelEvery = Math.max(1, Math.ceil(categories.length / fit));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div ref={ref} className="relative min-h-0 flex-1" onMouseLeave={() => setHover(null)}>
        {w > 0 && h > 0 && (
          <svg width={w} height={h} className="block overflow-visible" role="img" aria-label={series.map((s) => s.label).join(", ")}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" opacity={t === 0 ? 1 : 0.5} />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">{t}</text>
              </g>
            ))}
            {categories.map((c, i) => {
              const cx = PAD.left + band * i + band / 2;
              let acc = 0;
              const segs = series
                .map((s) => ({ s, v: values[i]?.[s.key] ?? 0 }))
                .filter((x) => x.v > 0);
              return (
                <g key={c + i}>
                  {hover === i && <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="var(--muted)" opacity="0.6" />}
                  {segs.map(({ s, v }, k) => {
                    const y0 = y(acc);
                    acc += v;
                    const y1 = y(acc);
                    const top = k === segs.length - 1;
                    const hgt = Math.max(y0 - y1 - (k > 0 ? 2 : 0), 1);
                    const r = top ? Math.min(4, barW / 2, hgt) : 0;
                    const x0 = cx - barW / 2;
                    const yTop = y1;
                    const yBot = yTop + hgt;
                    const d = `M${x0},${yBot} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${yBot} Z`;
                    return <path key={s.key} d={d} fill={s.color} />;
                  })}
                  {i % labelEvery === 0 && (
                    <text x={cx} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{c}</text>
                  )}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotH + PAD.bottom}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {hover != null && w > 0 && (
          <Tooltip x={PAD.left + band * hover + band / 2} y={y(totals[hover] ?? 0)} width={w}>
            <p className="mb-1 font-medium">{tooltipTitle ? tooltipTitle(hover) : categories[hover]}</p>
            {series.map((s) => (
              <TipRow key={s.key} color={s.color} label={s.label} value={values[hover]?.[s.key] ?? 0} />
            ))}
          </Tooltip>
        )}
      </div>
      <Legend series={series} />
    </div>
  );
}

/** Lines over a shared x axis (one point per index). A null value ends the line there. */
export function Lines({
  labels,
  series,
  values,
  tickLabels,
}: {
  labels: string[];
  series: Series[];
  /** values[seriesKey][index] */
  values: Record<string, (number | null)[]>;
  /** Indexes to label on the x axis, with their text. */
  tickLabels: { index: number; text: string }[];
}) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const all = series.flatMap((s) => values[s.key] ?? []).filter((v): v is number => v != null);
  const { max, step } = niceScale(Math.max(0, ...all));
  const plotW = Math.max(w - PAD.left - PAD.right, 0);
  const plotH = Math.max(h - PAD.top - PAD.bottom, 0);
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const minGap = 56;
  const shownTicks = tickLabels.filter((t, i, arr) => i === 0 || x(t.index) - x(arr[i - 1].index) >= minGap);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    if (n === 0) return;
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / Math.max(box.width, 1);
    setHover(Math.min(n - 1, Math.max(0, Math.round(rel * (n - 1)))));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div ref={ref} className="relative min-h-0 flex-1" onMouseLeave={() => setHover(null)}>
        {w > 0 && h > 0 && (
          <svg width={w} height={h} className="block overflow-visible" role="img" aria-label={series.map((s) => s.label).join(", ")}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" opacity={t === 0 ? 1 : 0.5} />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">{t}</text>
              </g>
            ))}
            {shownTicks.map((t) => (
              <text key={t.index} x={x(t.index)} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{t.text}</text>
            ))}
            {series.map((s) => {
              const pts = (values[s.key] ?? []).map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean);
              if (pts.length === 0) return null;
              return (
                <polyline
                  key={s.key}
                  points={pts.join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? "6 4" : undefined}
                />
              );
            })}
            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--muted-foreground)" strokeWidth="1" opacity="0.5" />
                {series.map((s) => {
                  const v = values[s.key]?.[hover];
                  return v == null ? null : <circle key={s.key} cx={x(hover)} cy={y(v)} r="4" fill={s.color} stroke="var(--card)" strokeWidth="2" />;
                })}
              </g>
            )}
            <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent" onMouseMove={onMove} onClick={onMove} />
          </svg>
        )}
        {hover != null && w > 0 && (
          <Tooltip x={x(hover)} y={PAD.top + 8} width={w}>
            <p className="mb-1 font-medium">{labels[hover]}</p>
            {series.map((s) => {
              const v = values[s.key]?.[hover];
              return <TipRow key={s.key} color={s.color} label={s.label} value={v ?? "—"} dashed={s.dashed} />;
            })}
          </Tooltip>
        )}
      </div>
      <Legend series={series} />
    </div>
  );
}

/** Ring chart with a total in the middle and a legend beside (or below) it. */
export function Donut({ slices, centerLabel }: { slices: { key: string; label: string; color: string; value: number }[]; centerLabel: string }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const size = Math.max(Math.min(w, h), 0);
  const r = size / 2 - 4;
  const thick = Math.max(Math.min(r * 0.32, 26), 8);
  const c = size / 2;
  const gap = total > 0 && slices.filter((s) => s.value > 0).length > 1 ? 0.03 : 0;
  const visible = slices.filter((s) => s.value > 0);
  const arcs = visible.map((s, i) => {
    const before = visible.slice(0, i).reduce((a, x) => a + x.value, 0);
    const start = -Math.PI / 2 + (before / total) * Math.PI * 2;
    const sweep = (s.value / total) * Math.PI * 2;
    const a0 = start + gap / 2;
    const a1 = start + sweep - gap / 2;
    return { ...s, a0, a1: Math.max(a1, a0 + 0.001) };
  });
  const ro = r;
  const ri = r - thick;
  const arcPath = (a0: number, a1: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`;
    if (a1 - a0 >= Math.PI * 2 - 0.01) {
      return `M${p(ro, 0)} A${ro},${ro} 0 1 1 ${p(ro, Math.PI)} A${ro},${ro} 0 1 1 ${p(ro, 0)} M${p(ri, 0)} A${ri},${ri} 0 1 0 ${p(ri, Math.PI)} A${ri},${ri} 0 1 0 ${p(ri, 0)} Z`;
    }
    return `M${p(ro, a0)} A${ro},${ro} 0 ${large} 1 ${p(ro, a1)} L${p(ri, a1)} A${ri},${ri} 0 ${large} 0 ${p(ri, a0)} Z`;
  };
  const focus = slices.find((s) => s.key === hover);

  return (
    // Legend beside the ring when the widget is wide enough, underneath (two columns) when it isn't.
    <div className="@container h-full min-h-0">
    <div className="flex h-full min-h-0 flex-col gap-3 @xs:flex-row @xs:items-center @xs:gap-4">
      <div ref={ref} className="relative min-h-0 w-full min-w-0 flex-1 @xs:h-full">
        {size > 0 && (
          <svg width={size} height={size} className="mx-auto block" role="img" aria-label={slices.map((s) => `${s.label} ${s.value}`).join(", ")}>
            {total === 0 && <circle cx={c} cy={c} r={r - thick / 2} fill="none" stroke="var(--muted)" strokeWidth={thick} />}
            {arcs.map((a) => (
              <path
                key={a.key}
                d={arcPath(a.a0, a.a1)}
                fill={a.color}
                fillRule="evenodd"
                opacity={hover && hover !== a.key ? 0.35 : 1}
                onMouseEnter={() => setHover(a.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(a.key)}
                className="transition-opacity duration-150"
              />
            ))}
            <text x={c} y={c - 4} textAnchor="middle" className="fill-foreground text-xl font-medium tabular-nums">{focus ? focus.value : total}</text>
            <text x={c} y={c + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">{focus ? focus.label : centerLabel}</text>
          </svg>
        )}
      </div>
      <ul className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1 text-xs @xs:flex @xs:flex-col">
        {slices.map((s) => (
          <li
            key={s.key}
            className="flex items-center gap-2"
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto pl-2 font-medium tabular-nums text-foreground">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}
