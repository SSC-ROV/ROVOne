"use client";
import { useI18n } from "@/lib/i18n";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { BTN, EQUIPMENT_CATEGORIES, INPUT_CLS, SELECT_CLS } from "@/lib/ui";
import { fmtMD, todayStr } from "@/lib/date";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageEmpty, PageError, PageLoading } from "@/components/PageState";
import { BoardGroup } from "@/components/board/BoardGroup";
import { StatusCell } from "@/components/board/ColorCell";
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
  const [fStatus, setFStatus] = useState("all");
  const [fCategory, setFCategory] = useState("all");

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
  const visible = equipment.filter(
    (e) => (fStatus === "all" || e.status === fStatus) && (fCategory === "all" || e.category === fCategory)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="board-title">{t("設備借用")}</h1>
        <span className="text-sm text-ink-tertiary">
          {t("目前借出")} {borrowed.length} {t("項；借用請登記，歸還請按「歸還」")}
        </span>
        <select className={`${SELECT_CLS} ml-auto w-32`} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">{t("全部狀態")}</option>
          <option value="available">{t("可借用")}</option>
          <option value="borrowed">{t("借出中")}</option>
          <option value="maintenance">{t("維修中")}</option>
        </select>
        <select className={`${SELECT_CLS} w-32`} value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
          <option value="all">{t("全部分類")}</option>
          {EQUIPMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(c)}</option>
          ))}
        </select>
      </div>

      <BoardGroup title={t("設備")} color="#579bfc" count={visible.length}>
        <table className="board-table">
          <thead>
            <tr>
              <th>{t("設備")}</th>
              <th>{t("分類")}</th>
              <th className="color-cell">{t("狀態")}</th>
              <th>{t("借用人")}</th>
              <th>{t("應還日")}</th>
              <th>{t("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => {
              const overdue =
                e.status === "borrowed" && e.due_return && e.due_return < todayStr();
              return (
                <tr key={e.id}>
                  <td>
                    <div className="whitespace-normal py-1">
                      <div>{e.name}</div>
                      {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                    </div>
                  </td>
                  <td>{t(e.category)}</td>
                  <td className="color-cell">
                    <StatusCell
                      value={e.status}
                      options={statusOptions}
                      disabled={!canEditStatus(e)}
                      onChange={(value) => onEquipmentStatus(e, value)}
                    />
                  </td>
                  <td>
                    <PersonCell name={e.borrower_name} />
                  </td>
                  <td className={`tabular-nums ${overdue ? "text-rose-400" : ""}`}>
                    {e.due_return ? (overdue ? t("逾期 ") : "") + fmtMD(e.due_return) : "—"}
                  </td>
                  <td>
                    <div className="flex gap-3 text-xs">
                      {e.status === "available" && (
                        <button type="button" className="text-primary hover:underline" onClick={() => act(e, "borrow")}>
                          {t("借用")}
                        </button>
                      )}
                      {e.status === "borrowed" && (isStaff(me.role) || e.borrower_id === me.id) && (
                        <button type="button" className="text-emerald-600 hover:underline" onClick={() => act(e, "return")}>
                          {t("歸還")}
                        </button>
                      )}
                      {isStaff(me.role) && e.status !== "borrowed" && (
                        <button type="button" className="text-muted-foreground hover:underline" onClick={() => act(e, "maintenance")}>
                          {e.status === "maintenance" ? t("修好了") : t("送修")}
                        </button>
                      )}
                      {isStaff(me.role) && (
                        <button type="button" className="text-muted-foreground hover:text-rose-400" onClick={() => remove(e)}>
                          {t("刪除")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4">
                  <PageEmpty>
                    {equipment.length === 0 ? t("還沒有登記設備") : t("沒有符合的結果")}
                  </PageEmpty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </BoardGroup>

      {isStaff(me.role) && (
        <form onSubmit={addEquipment} className="grid gap-3 rounded-xl border border-hairline bg-surface-1 p-5 sm:grid-cols-[1fr_10rem_1fr_auto]">
          <input className={INPUT_CLS} placeholder={t("設備名稱，例如：T200 備用推進器")} value={name} onChange={(e) => setName(e.target.value)} />
          <select className={INPUT_CLS} value={category} onChange={(e) => setCategory(e.target.value)}>
            {EQUIPMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(c)}</option>
            ))}
          </select>
          <input className={INPUT_CLS} placeholder={t("備註（序號、位置…選填）")} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={BTN} disabled={!name.trim()}>{t("新增設備")}</button>
        </form>
      )}
    </div>
  );
}
