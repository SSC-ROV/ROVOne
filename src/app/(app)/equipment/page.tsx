"use client";
import { useI18n } from "@/lib/i18n";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { EQUIPMENT_CATEGORIES, groupColor } from "@/lib/ui";
import { fmtMD, todayStr } from "@/lib/date";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageError, PageLoading } from "@/components/PageState";
import { CircleDotIcon, HandIcon, PlusIcon, TagIcon, Trash2Icon, Undo2Icon, WrenchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Choice, MultiFilter } from "@/components/tasks/shared";
import { BoardHeader } from "@/components/board/BoardHeader";
import { FormField, RowActions, StatusDot, TableEmpty, TableToolbar, TitleCell } from "@/components/board/BoardTable";
import { BoardGroup } from "@/components/board/BoardGroup";
import { Label, StatusCell } from "@/components/board/ColorCell";
import { PersonCell } from "@/components/board/PersonCell";
import { tt } from "@/lib/i18n-core";
import type { Equipment, Me } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "available", label: "可借用", color: "#00c875" },
  { value: "borrowed", label: "借出中", color: "#fdab3d" },
  { value: "maintenance", label: "維修中", color: "#df2f4a" },
] as const;

export default function EquipmentPage() {
  const { t } = useI18n();
  const { confirm, prompt, toast } = useDialogs();
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("其他");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [fCategory, setFCategory] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  async function load() {
    const [e, u] = await Promise.all([
      api<{ equipment: Equipment[] }>("/api/equipment"),
      api<{ user: Me | null }>("/api/auth/me"),
    ]);
    setEquipment(e.equipment);
    setMe(u.user);
  }

  const bgReload = () => { load().catch(() => {}); };
  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <PageError message={error} />;
  if (!equipment || !me) return <PageLoading label={t("載入中…")} />;
  const meId = me.id;
  const meName = me.display_name;
  const staff = isStaff(me.role);

  async function act(item: Equipment, action: string) {
    const snapshot = equipment;
    const patchRow = (patch: Partial<Equipment>) =>
      setEquipment((prev) => prev!.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
    try {
      if (action === "borrow") {
        const due = await prompt({
          title: `${t("借用「")}${item.name}${t("」")}`,
          label: t("預計歸還日（留空表示未定）"),
          type: "date",
        });
        if (due === null) return;
        patchRow({ status: "borrowed", borrower_id: meId, borrower_name: meName, borrowed_at: null, due_return: due || null });
        await api(`/api/equipment/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "borrow", due_return: due || undefined }),
        });
        toast(t("已登記借用") + `「${item.name}」` + t("，記得按時歸還！"));
      } else if (action === "return") {
        const ok = await confirm({
          title: `${t("歸還「")}${item.name}${t("」？")}`,
          confirmText: t("歸還"),
        });
        if (!ok) return;
        patchRow({ status: "available", borrower_id: null, borrower_name: null, borrowed_at: null, due_return: null });
        await api(`/api/equipment/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "return" }),
        });
        toast(t("已歸還，謝謝！"));
      } else if (action === "maintenance") {
        const goingFix = item.status === "maintenance";
        patchRow({
          status: goingFix ? "available" : "maintenance",
          borrower_id: null,
          borrower_name: null,
          borrowed_at: null,
          due_return: null,
        });
        await api(`/api/equipment/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "maintenance" }),
        });
        toast(goingFix ? t("已標記為可借用") : t("已標記為維修中"));
      }
      await load();
    } catch (err) {
      setEquipment(snapshot);
      toast(t((err as Error).message), "err");
    }
  }

  async function addEquipment(ev: React.FormEvent) {
    ev.preventDefault();
    if (!name.trim()) return;
    try {
      await api("/api/equipment", { method: "POST", body: JSON.stringify({ name, category, note }) });
      setName("");
      setNote("");
      setAdding(false);
      toast(t("設備已新增"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function remove(e: Equipment) {
    const ok = await confirm({
      title: `${t("刪除設備")}「${e.name}」？`,
      message: t("刪除後無法復原。"),
      confirmText: t("刪除"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/equipment/${e.id}`, { method: "DELETE" });
      toast(t("已刪除"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  function onEquipmentStatus(item: Equipment, next: string) {
    if (next === item.status) return;
    if (next === "borrowed") {
      if (item.status === "available") {
        act(item, "borrow");
        return;
      }
      toast(tt("設備目前無法借用", "This item can't be borrowed right now"), "err");
      return;
    }
    if (next === "available" && item.status === "borrowed") {
      act(item, "return");
      return;
    }
    if (next === "maintenance" || (next === "available" && item.status === "maintenance")) {
      if (!staff) {
        toast(tt("只有隊長或老師可以調整維修狀態", "Only a leader or teacher can change repair status"), "err");
        return;
      }
      if (item.status === "borrowed") {
        toast(tt("先歸還再標記維修", "Return it before sending it for repair"), "err");
        return;
      }
      act(item, "maintenance");
      return;
    }
    toast(tt("這個狀態現在不能改", "That status can't be set from here"), "err");
  }

  function canEditStatus(item: Equipment) {
    if (item.status === "available") return true;
    if (item.status === "borrowed") return staff || item.borrower_id === meId;
    return staff;
  }

  const borrowed = equipment.filter((e) => e.status === "borrowed");
  const statusOptions = STATUS_OPTIONS.map((item) => ({ ...item, label: t(item.label) }));
  const needle = q.trim().toLowerCase();
  const visible = equipment.filter(
    (e) =>
      (fStatus.length === 0 || fStatus.includes(e.status)) &&
      (fCategory.length === 0 || fCategory.includes(e.category)) &&
      (!needle || [e.name, e.note, t(e.category), e.borrower_name ?? ""].join(" ").toLowerCase().includes(needle))
  );
  const narrowing = needle.length > 0 || fStatus.length > 0 || fCategory.length > 0;
  const categoryColor = (c: string) => groupColor(Math.max(0, EQUIPMENT_CATEGORIES.indexOf(c)));
  const categoryOptions = EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: t(c), color: categoryColor(c) }));

  return (
    <div className="space-y-4">
      <BoardHeader
        title={t("設備借用")}
        subtitle={tt(`目前借出 ${borrowed.length} 項`, `${borrowed.length} out on loan`)}
        action={
          staff ? (
            <Button onClick={() => setAdding(true)}>
              <PlusIcon /> {tt("新設備", "New equipment")}
            </Button>
          ) : null
        }
      />

      <TableToolbar
        query={q}
        onQuery={setQ}
        placeholder={tt("搜尋設備、備註、借用人…", "Search equipment, notes, borrowers…")}
        narrowing={narrowing}
        onClear={() => {
          setQ("");
          setFStatus([]);
          setFCategory([]);
        }}
        shown={visible.length}
        total={equipment.length}
        noun={["項", "items"]}
        filters={
          <>
            <MultiFilter label={tt("狀態", "Status")} icon={<CircleDotIcon className="size-3.5" />} value={fStatus} onChange={setFStatus} options={statusOptions} />
            <MultiFilter label={tt("分類", "Category")} icon={<TagIcon className="size-3.5" />} value={fCategory} onChange={setFCategory} options={categoryOptions} />
          </>
        }
      />

      {visible.length === 0 && (
        <div className="rounded-[8px] border border-dashed border-border bg-card">
          <TableEmpty>{equipment.length === 0 ? t("還沒有登記設備") : t("沒有符合的結果")}</TableEmpty>
        </div>
      )}
      {statusOptions.map((status) => {
        const rows = visible.filter((e) => e.status === status.value);
        if (rows.length === 0) return null;
        return (
          <BoardGroup key={status.value} title={status.label} color={status.color} icon={<StatusDot color={status.color} />} count={rows.length}>
            <table className="board-table is-interactive table-fixed" style={{ minWidth: 920 }}>
              <colgroup>
                <col />
                <col style={{ width: 130 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr>
                  <th><span className="pl-8">{t("設備")}</span></th>
                  <th>{t("分類")}</th>
                  <th className="color-cell">{t("狀態")}</th>
                  <th>{t("借用人")}</th>
                  <th>{t("應還日")}</th>
                  <th aria-label={tt("動作", "Actions")} />
                </tr>
              </thead>
              <tbody>
                {rows.map((e, index) => {
                  const overdue = e.status === "borrowed" && !!e.due_return && e.due_return < todayStr();
                  const canReturn = e.status === "borrowed" && (staff || e.borrower_id === meId);
                  return (
                    <tr key={e.id} className="group/row">
                      <td><TitleCell index={index} title={e.name} sub={e.note} /></td>
                      <td><Label color={categoryColor(e.category)}>{t(e.category)}</Label></td>
                      <td className="color-cell">
                        <StatusCell value={e.status} options={statusOptions} disabled={!canEditStatus(e)} onChange={(value) => onEquipmentStatus(e, value)} />
                      </td>
                      <td><PersonCell name={e.borrower_name} /></td>
                      <td className={`tabular-nums ${overdue ? "font-medium text-[var(--c-red)]" : e.due_return ? "" : "text-muted-foreground"}`}>
                        {e.due_return ? (overdue ? t("逾期 ") : "") + fmtMD(e.due_return) : "—"}
                      </td>
                      <td>
                        <RowActions
                          label={e.name}
                          actions={[
                            { label: t("借用"), icon: <HandIcon />, onSelect: () => act(e, "borrow"), hidden: e.status !== "available" },
                            { label: t("歸還"), icon: <Undo2Icon />, onSelect: () => act(e, "return"), hidden: !canReturn },
                            {
                              label: e.status === "maintenance" ? t("修好了") : t("送修"),
                              icon: <WrenchIcon />,
                              onSelect: () => act(e, "maintenance"),
                              hidden: !staff || e.status === "borrowed",
                            },
                            { label: t("刪除"), icon: <Trash2Icon />, onSelect: () => remove(e), destructive: true, separator: true, hidden: !staff },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </BoardGroup>
        );
      })}

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent className="w-full gap-0 sm:max-w-[520px]" style={{ width: "min(520px, 100%)", maxWidth: 520 }}>
          <form onSubmit={addEquipment} className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b border-border px-5">
              <SheetTitle className="text-lg">{tt("新設備", "New equipment")}</SheetTitle>
              <SheetDescription>{tt("登記後隊員就能借用", "Once added, team members can borrow it")}</SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 text-sm">
              <FormField label={tt("名稱", "Name")}>
                <Input autoFocus className="h-9" placeholder={t("設備名稱，例如：T200 備用推進器")} value={name} onChange={(ev) => setName(ev.target.value)} />
              </FormField>
              <FormField label={t("分類")}>
                <Choice value={category} onChange={setCategory} options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: t(c) }))} className="w-full" ariaLabel={t("分類")} />
              </FormField>
              <FormField label={tt("備註", "Note")}>
                <Input className="h-9" placeholder={t("備註（序號、位置…選填）")} value={note} onChange={(ev) => setNote(ev.target.value)} />
              </FormField>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-5 py-3">
              <Button type="button" variant="ghost" className="ml-auto" onClick={() => setAdding(false)}>{t("取消")}</Button>
              <Button type="submit" disabled={!name.trim()}>{t("新增設備")}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
