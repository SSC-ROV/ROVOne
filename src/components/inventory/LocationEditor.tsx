"use client";

import { useState } from "react";
import { ArrowRightIcon, PlusIcon, XIcon } from "lucide-react";
import { tt } from "@/lib/i18n-core";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api-client";
import { BTN, BTN_GHOST } from "@/lib/ui";
import { compareLocations, describeLocation, type InventoryItem } from "@/lib/inventory";
import { useDialogs } from "@/components/ui/Dialogs";
import { LocationPicker } from "./ItemForm";
import LocationDiagram from "./LocationDiagram";

/**
 * Inline editor for where an item is stored.
 * Picking a spot in the dropdowns is enough: "Move it here" replaces the old
 * location(s), "Also here" keeps them and adds the new spot. Nothing depends
 * on a separate "+ Add" step.
 */
export default function LocationEditor({
  item,
  onSaved,
  onCancel,
}: {
  item: Pick<InventoryItem, "id" | "name" | "locations">;
  onSaved: (locations: string[]) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useDialogs();
  const [kept, setKept] = useState<string[]>(item.locations);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const removedSome = kept.length !== item.locations.length;
  const hasOld = item.locations.length > 0;

  async function save(locations: string[]) {
    setBusy(true);
    try {
      await api(`/api/inventory/${item.id}`, { method: "PATCH", body: JSON.stringify({ locations }) });
      toast(tt(`已更新「${item.name}」的位置`, `Updated where ${item.name} is`));
      await onSaved(locations);
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setBusy(false);
    }
  }

  const preview = pending ? [pending] : kept;

  return (
    <div className="space-y-3">
      {hasOld && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{tt("目前記錄的位置", "Currently recorded at")}</p>
          <div className="flex flex-wrap gap-1.5">
            {kept.length === 0 && <span className="text-xs text-muted-foreground">{tt("（全部移除）", "(all removed)")}</span>}
            {kept.map((code) => (
              <span key={code} className="inline-flex items-center gap-1 rounded-[4px] bg-card px-2 py-0.5 text-sm ring-1 ring-border" title={describeLocation(code)}>
                <b className="font-mono">{code}</b>
                <button type="button" aria-label={tt(`移除 ${code}`, `Remove ${code}`)} className="rounded text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setKept(kept.filter((c) => c !== code))}>
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-sm font-medium">{hasOld ? tt("它實際放在哪裡？", "Where is it actually?") : tt("它放在哪裡？", "Where is it stored?")}</p>
        <LocationPicker value={[]} onChange={() => {}} onPendingChange={setPending} hideAddButton />
        {pending ? (
          <p className="text-sm">
            <b className="font-mono">{pending}</b> <span className="text-muted-foreground">· {describeLocation(pending)}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{tt("選櫃子和格位，或直接輸入代碼。", "Pick the cabinet and spot, or type the code.")}</p>
        )}
      </div>

      <LocationDiagram locations={preview} />

      <div className="flex flex-wrap items-center gap-2">
        {pending ? (
          <>
            <button type="button" className={`${BTN} gap-1.5`} disabled={busy} onClick={() => save([pending])}>
              <ArrowRightIcon className="size-4" />
              {hasOld ? tt(`移到 ${pending}`, `Move it to ${pending}`) : tt(`儲存：在 ${pending}`, `Save: it's at ${pending}`)}
            </button>
            {kept.length > 0 && !kept.includes(pending) && (
              <button
                type="button"
                className={`${BTN_GHOST} gap-1.5 border border-border`}
                disabled={busy}
                onClick={() => save([...kept, pending].sort(compareLocations))}
              >
                <PlusIcon className="size-4" /> {tt(`這裡也有（保留 ${kept.join("、")}）`, `Also here (keep ${kept.join(", ")})`)}
              </button>
            )}
          </>
        ) : (
          removedSome && (
            <button type="button" className={BTN} disabled={busy} onClick={() => save(kept)}>
              {tt("儲存", "Save")}
            </button>
          )
        )}
        <button type="button" className={BTN_GHOST} onClick={onCancel}>{t("取消")}</button>
      </div>
    </div>
  );
}
