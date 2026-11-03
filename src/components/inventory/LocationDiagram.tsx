"use client";

import { parseLocation } from "@/lib/inventory";
import RoomMap, { CabinetFrontView } from "./RoomMap";

/**
 * Small "where is it" picture: the room plan with the cabinet highlighted,
 * plus the front of each cabinet with the exact shelf / box lit up.
 */
export default function LocationDiagram({ locations, className = "" }: { locations: string[]; className?: string }) {
  if (locations.length === 0) return null;
  // Cabinet 7's drawers already show on the floor plan, so it has no front view.
  const cabinets = [...new Set(locations.map((l) => parseLocation(l)?.cabinet).filter(Boolean) as string[])].filter((c) => c !== "7");
  return (
    <div className={`flex items-start gap-3 rounded-[8px] border border-border bg-background p-2 ${className}`}>
      <div className="w-full max-w-[420px] min-w-0 flex-1">
        <RoomMap highlight={locations} />
      </div>
      {cabinets.slice(0, 2).map((c) => (
        <div key={c} className="w-[72px] shrink-0 sm:w-[110px] [&_svg]:max-h-[160px] sm:[&_svg]:max-h-[260px]">
          <CabinetFrontView cabinetId={c} highlight={locations} />
        </div>
      ))}
    </div>
  );
}
