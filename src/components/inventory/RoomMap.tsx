"use client";

import { cabinetById, GRID_COLS, parseLocation } from "@/lib/inventory";
import { tt } from "@/lib/i18n-core";

/**
 * 社辦平面圖（俯視）。座標依隊上手繪的平面圖整理：房間 1000 × 600，
 * 上方牆面由左到右是 1–6 號櫃（平均分配寬度），右上角是門；
 * 7 號為 L 形抽屜櫃，沿左牆（1–3，由上往下）與下牆（4–18，由左到右）。
 */
const ROOM = { w: 1000, h: 600 };
const PAD = 24;
const DEPTH = 90;

type Rect = { x: number; y: number; w: number; h: number };

const TOP_RUN = 860; // 1–6 號櫃佔用的上牆寬度（右邊是門）
const CABINET_RECTS: Record<string, Rect> = Object.fromEntries(
  ["1", "2", "3", "4", "5", "6"].map((id, i) => [
    id,
    { x: (TOP_RUN / 6) * i, y: 0, w: TOP_RUN / 6, h: DEPTH },
  ])
);

const SEVEN_LEG: Rect = { x: 0, y: 400, w: DEPTH, h: 200 };
const SEVEN_RUN: Rect = { x: DEPTH, y: ROOM.h - DEPTH, w: ROOM.w - DEPTH, h: DEPTH };

function sevenDrawer(n: number): Rect {
  if (n <= 3) {
    const h = SEVEN_LEG.h / 3;
    return { x: SEVEN_LEG.x, y: SEVEN_LEG.y + h * (n - 1), w: SEVEN_LEG.w, h };
  }
  const w = SEVEN_RUN.w / 15;
  return { x: SEVEN_RUN.x + w * (n - 4), y: SEVEN_RUN.y, w, h: SEVEN_RUN.h };
}

// 8、9、10、11 號放在 7 號櫃「上面」：俯視圖畫成虛線半透明方塊疊在 7 號上，
// 底下的抽屜編號仍看得到（9/10/11 寬度依 4:2:4 比例）
const ON_TOP_OF_7 = ["8", "9", "10", "11"];
const SMALL_RECTS: Record<string, Rect> = {
  "8": { x: 6, y: 530, w: 78, h: 64 },
  "9": { x: 98, y: 516, w: 104, h: 78 },
  "10": { x: 206, y: 516, w: 54, h: 78 },
  "11": { x: 264, y: 516, w: 104, h: 78 },
};

const DOORS = [
  { x1: TOP_RUN, y1: 0, x2: ROOM.w, y2: 0 },
  { x1: 0, y1: 110, x2: 0, y2: 340 },
];
const WINDOWS = [
  { x1: 80, y1: ROOM.h, x2: 400, y2: ROOM.h },
  { x1: 600, y1: ROOM.h, x2: 920, y2: ROOM.h },
  { x1: ROOM.w, y1: 120, x2: ROOM.w, y2: 460 },
];
const TABLE: Rect = { x: 160, y: 200, w: 680, h: 190 };

export type CabinetBadge = { low: number; empty: number };

const HL = "#0073ea";

export default function RoomMap({
  highlight = [],
  badges,
  selectedCabinet,
  onCabinetClick,
  className = "",
}: {
  highlight?: string[];
  badges?: Record<string, CabinetBadge>;
  selectedCabinet?: string | null;
  onCabinetClick?: (id: string) => void;
  className?: string;
}) {
  const parsed = highlight.map(parseLocation).filter((p): p is NonNullable<typeof p> => !!p);
  const hlCabinets = new Set(parsed.map((p) => p.cabinet));
  const hlDrawers7 = parsed.filter((p) => p.cabinet === "7" && p.slot).map((p) => p.slot!);
  const slotText = (id: string) =>
    parsed
      .filter((p) => p.cabinet === id)
      .map((p) => (p.col ? `${p.col}${p.row}` : cabinetById(id)!.slots > 1 ? `#${p.slot}` : ""))
      .filter(Boolean)
      .join(" ");

  const clickable = (id: string) =>
    onCabinetClick
      ? {
          role: "button" as const,
          tabIndex: 0,
          "aria-label": tt(`${id} 號櫃`, `Cabinet ${id}`),
          "aria-pressed": selectedCabinet === id,
          onClick: () => onCabinetClick(id),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCabinetClick(id);
            }
          },
          style: { cursor: "pointer" },
        }
      : {};

  const fillFor = (id: string) =>
    hlCabinets.has(id) || selectedCabinet === id ? "rgba(0,115,234,0.16)" : "var(--card)";
  const strokeFor = (id: string) => (hlCabinets.has(id) || selectedCabinet === id ? HL : "var(--muted-foreground)");

  function badge(id: string, r: Rect) {
    const b = badges?.[id];
    if (!b || (b.low === 0 && b.empty === 0)) return null;
    const items = [
      b.empty > 0 ? { n: b.empty, c: "#df2f4a" } : null,
      b.low > 0 ? { n: b.low, c: "#fdab3d" } : null,
    ].filter(Boolean) as { n: number; c: string }[];
    return items.map((it, i) => (
      <g key={it.c} transform={`translate(${r.x + r.w - 14 - i * 26}, ${r.y + 14})`} pointerEvents="none">
        <circle r="11" fill={it.c} />
        <text textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="700" fill="#fff">
          {it.n}
        </text>
      </g>
    ));
  }

  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${ROOM.w + PAD * 2} ${ROOM.h + PAD * 2}`}
      className={`block h-auto w-full select-none ${className}`}
      role="img"
      aria-label={tt("社辦平面圖", "Workshop floor plan")}
    >
      {/* 地板與工作桌 */}
      <rect x={0} y={0} width={ROOM.w} height={ROOM.h} fill="var(--muted)" />
      <rect x={TABLE.x} y={TABLE.y} width={TABLE.w} height={TABLE.h} rx={6} fill="var(--card)" stroke="var(--border)" strokeWidth={2} />
      <text x={TABLE.x + TABLE.w / 2} y={TABLE.y + TABLE.h / 2} textAnchor="middle" dominantBaseline="central" fontSize="22" fill="var(--muted-foreground)">
        {tt("工作桌", "Work table")}
      </text>

      {/* 1–6 號櫃 */}
      {Object.entries(CABINET_RECTS).map(([id, r]) => (
        <g key={id} {...clickable(id)}>
          <rect x={r.x + 2} y={r.y + 2} width={r.w - 4} height={r.h - 4} rx={3} fill={fillFor(id)} stroke={strokeFor(id)} strokeWidth={hlCabinets.has(id) ? 4 : 2} />
          <line x1={r.x + 2} y1={r.y + r.h - 2} x2={r.x + r.w - 2} y2={r.y + r.h - 2} stroke="#ff642e" strokeWidth={4} />
          <text x={r.x + r.w / 2} y={r.y + (slotText(id) ? 34 : r.h / 2)} textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="700" fill={hlCabinets.has(id) ? HL : "var(--foreground)"}>
            {id}
          </text>
          {slotText(id) && (
            <text x={r.x + r.w / 2} y={r.y + 66} textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="600" fill={HL}>
              {slotText(id)}
            </text>
          )}
          {badge(id, r)}
        </g>
      ))}

      {/* 7 號 L 形抽屜櫃 */}
      <g {...clickable("7")}>
        <path
          d={`M0 ${SEVEN_LEG.y} H${DEPTH} V${SEVEN_RUN.y} H${ROOM.w} V${ROOM.h} H0 Z`}
          fill={fillFor("7")}
          stroke={strokeFor("7")}
          strokeWidth={hlCabinets.has("7") ? 4 : 2}
        />
        {Array.from({ length: 18 }, (_, i) => {
          const n = i + 1;
          const r = sevenDrawer(n);
          const on = hlDrawers7.includes(n);
          return (
            <g key={n}>
              <rect x={r.x + 3} y={r.y + 3} width={r.w - 6} height={r.h - 6} rx={2} fill={on ? HL : "transparent"} stroke="var(--border)" strokeWidth={1.5} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + (n <= 3 ? 0 : 14)} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight={on ? 700 : 500} fill={on ? "#fff" : "var(--muted-foreground)"}>
                {n}
              </text>
            </g>
          );
        })}
        <text x={SMALL_RECTS["11"].x + SMALL_RECTS["11"].w + 14} y={SEVEN_RUN.y + 22} fontSize="18" fontWeight="700" fill={hlCabinets.has("7") ? HL : "var(--foreground)"} pointerEvents="none">
          7
        </text>
        {badge("7", { x: SEVEN_RUN.x, y: SEVEN_RUN.y, w: SEVEN_RUN.w, h: SEVEN_RUN.h })}
      </g>

      {/* 8–11 號（放在 7 號上面） */}
      {Object.entries(SMALL_RECTS).map(([id, r]) => {
        const on = hlCabinets.has(id) || selectedCabinet === id;
        // 7 號抽屜被標示時，上面的櫃子變得更透明，讓底下的抽屜看得見
        const opacity = on ? 0.9 : hlDrawers7.length ? 0.3 : 0.8;
        return (
          <g key={id} {...clickable(id)}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={4} fill={on ? HL : "var(--card)"} fillOpacity={opacity} stroke={on ? HL : "var(--foreground)"} strokeWidth={2.5} strokeDasharray="7 4" />
            <text x={r.x + r.w / 2} y={r.y + (slotText(id) ? 22 : r.h / 2)} textAnchor="middle" dominantBaseline="central" fontSize={slotText(id) ? 18 : 22} fontWeight="700" fill={on ? "#fff" : "var(--foreground)"}>
              {id}
            </text>
            {slotText(id) && (
              <text x={r.x + r.w / 2} y={r.y + r.h - 16} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="600" fill="#fff">
                {slotText(id)}
              </text>
            )}
            {badge(id, r)}
          </g>
        );
      })}
      <text x={SMALL_RECTS["11"].x + SMALL_RECTS["11"].w + 10} y={SEVEN_RUN.y - 10} fontSize="13" fill="var(--muted-foreground)" pointerEvents="none">
        {tt(`虛線：${ON_TOP_OF_7.join("、")} 號放在 7 號上面`, `Dashed: ${ON_TOP_OF_7.join(", ")} sit on top of 7`)}
      </text>

      {/* 牆、門、窗 */}
      <rect x={0} y={0} width={ROOM.w} height={ROOM.h} fill="none" stroke="var(--foreground)" strokeWidth={8} />
      {WINDOWS.map((w, i) => (
        <line key={`w${i}`} {...w} stroke="#579bfc" strokeWidth={8} />
      ))}
      {DOORS.map((d, i) => (
        <g key={`d${i}`}>
          <line {...d} stroke="var(--muted)" strokeWidth={10} />
          <line {...d} stroke="#00c875" strokeWidth={6} strokeDasharray="14 6" />
        </g>
      ))}
      <text x={TOP_RUN + 70} y={-8} textAnchor="middle" fontSize="15" fontWeight="600" fill="#00a35e">{tt("門", "Door")}</text>
      <text x={-8} y={225} textAnchor="middle" fontSize="15" fontWeight="600" fill="#00a35e" transform="rotate(-90 -8 225)">{tt("門", "Door")}</text>
    </svg>
  );
}

/** 單一櫃子的正面圖：層架由上往下、收納盒格（4/9/10/11）。7 號只看平面圖。 */
export function CabinetFrontView({ cabinetId, highlight = [] }: { cabinetId: string; highlight?: string[] }) {
  const cab = cabinetById(cabinetId);
  if (!cab) return null;
  const hits = highlight.map(parseLocation).filter((p) => p?.cabinet === cabinetId);

  if (cab.grid) {
    const cell = 22, gap = 3, left = 26, top = 22;
    const w = left + cab.grid.cols * (cell * 2 + gap);
    const h = top + cab.grid.rows * (cell + gap);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" style={{ maxWidth: Math.min(260, w * 1.1) }} role="img" aria-label={tt(`${cab.id} 號櫃正面`, `Cabinet ${cab.id} front`)}>
        {GRID_COLS.slice(0, cab.grid.cols).map((c, ci) => (
          <text key={c} x={left + ci * (cell * 2 + gap) + cell} y={12} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--muted-foreground)">{c}</text>
        ))}
        {Array.from({ length: cab.grid.rows }, (_, ri) => (
          <g key={ri}>
            <text x={left - 6} y={top + ri * (cell + gap) + cell / 2} textAnchor="end" dominantBaseline="central" fontSize="10" fill="var(--muted-foreground)">{ri + 1}</text>
            {GRID_COLS.slice(0, cab.grid!.cols).map((c, ci) => {
              const on = hits.some((p) => p?.col === c && p?.row === ri + 1);
              return (
                <rect key={c} x={left + ci * (cell * 2 + gap)} y={top + ri * (cell + gap)} width={cell * 2} height={cell} rx={2}
                  fill={on ? HL : "var(--muted)"} stroke={on ? HL : "var(--border)"} strokeWidth={1} />
              );
            })}
          </g>
        ))}
      </svg>
    );
  }

  // 7 號抽屜已在平面圖上標示，不另外畫
  if (cab.id === "7") return null;

  // 層架 / 單格
  const rowH = 30, w = 160;
  return (
    <svg viewBox={`0 0 ${w} ${cab.slots * rowH + 8}`} className="block h-auto w-full max-w-[160px]" role="img" aria-label={tt(`${cab.id} 號櫃正面`, `Cabinet ${cab.id} front`)}>
      <rect x={1} y={1} width={w - 2} height={cab.slots * rowH + 6} rx={4} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} />
      {Array.from({ length: cab.slots }, (_, i) => {
        const on = hits.some((p) => p?.slot === i + 1);
        return (
          <g key={i}>
            <rect x={6} y={4 + i * rowH} width={w - 12} height={rowH - 4} rx={2} fill={on ? HL : "var(--muted)"} />
            <text x={w / 2} y={4 + i * rowH + (rowH - 4) / 2} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight={on ? 700 : 500} fill={on ? "#fff" : "var(--muted-foreground)"}>
              {cab.slots === 1 ? tt(`${cab.id} 號`, `#${cab.id}`) : `${i + 1}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
