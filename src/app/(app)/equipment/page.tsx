"use client";
import { useI18n } from "@/lib/i18n";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { BTN, EQUIPMENT_CATEGORIES, INPUT_CLS } from "@/lib/ui";
import { fmtMD, todayStr } from "@/lib/date";
import { useDialogs } from "@/components/ui/Dialogs";
import type { Equipment, Me } from "@/lib/types";

const STATUS_STYLE: Record<string, { label: string; chip: string }> = {
  available: { label: "可借用", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  borrowed: { label: "借出中", chip: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  maintenance: { label: "維修中", chip: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
};

export default function EquipmentPage() {
  const { t } = useI18n();
  const { confirm, prompt, toast } = useDialogs();
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("其他");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

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

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p>
    );
  }
  if (!equipment || !me) {
    return <p className="py-20 text-center text-sm text-slate-500">{t("載入中…")}</p>;
  }
  const meId = me.id;
  const meName = me.display_name;

  async function act(e: Equipment, action: string) {
    const apply = (patch: Partial<Equipment>) =>
      setEquipment((prev) => prev!.map((x) => (x.id === e.id ? { ...x, ...patch } : x)));
    // 樂觀：先改畫面
    if (action === "borrow") apply({ status: "borrowed", borrower_id: meId, borrower_name: meName, borrowed_at: null, due_return: null });
    if (action === "return") apply({ status: "available", borrower_id: null, borrower_name: null, borrowed_at: null, due_return: null });
    if (action === "maintenance") apply({ status: e.status === "maintenance" ? "available" : "maintenance", borrower_id: null, borrower_name: null, borrowed_at: null, due_return: null });
    try {
      if (action === "borrow") {
        const due = await prompt({
          title: `借用「${e.name}」`,
          label: t("預計歸還日（留空表示未定）"),
          type: "date",
        });
        if (due === null) return;
        await api(`/api/equipment/${e.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "borrow", due_return: due || undefined }),
        });
        toast(t("已登記借用") + `「${e.name}」` + t("，記得按時歸還！"));
      } else if (action === "return") {
        const ok = await confirm({
          title: `歸還「${e.name}」？`,
          confirmText: "歸還",
        });
        if (!ok) return;
        await api(`/api/equipment/${e.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "return" }),
        });
        toast(t("已歸還，謝謝！"));
      } else if (action === "maintenance") {
        const goingFix = e.status === "maintenance";
        await api(`/api/equipment/${e.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "maintenance" }),
        });
        toast(goingFix ? t("已標記為可借用") : t("已標記為維修中"));
      }
      await load();
    } catch (err) {
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
      message: "刪除後無法復原。",
      confirmText: "刪除",
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

  const borrowed = equipment.filter((e) => e.status === "borrowed");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{t("設備借用")}</h1>
        <span className="text-sm text-slate-500">
          {t("目前借出")} {borrowed.length} {t("項；借用請登記，歸還請按「歸還」")}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">{t("設備")}</th>
              <th className="px-4 py-3 font-medium">{t("分類")}</th>
              <th className="px-4 py-3 font-medium">{t("狀態")}</th>
              <th className="px-4 py-3 font-medium">{t("借用人")}</th>
              <th className="px-4 py-3 font-medium">{t("應還日")}</th>
              <th className="px-4 py-3 font-medium">{t("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((e) => {
              const st = STATUS_STYLE[e.status];
              const overdue =
                e.status === "borrowed" && e.due_return && e.due_return < todayStr();
              return (
                <tr key={e.id} className="border-t border-slate-800/60">
                  <td className="px-4 py-3">
                    {e.name}
                    {e.note && <p className="text-xs text-slate-500">{e.note}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{e.category}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${st.chip}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">{e.borrower_name ?? <span className="text-slate-600">—</span>}</td>
                  <td className={`px-4 py-3 tabular-nums ${overdue ? "text-rose-400" : "text-slate-400"}`}>
                    {e.due_return ? (overdue ? t("逾期 ") : "") + fmtMD(e.due_return) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs">
                      {e.status === "available" && (
                        <button className="text-cyan-300 hover:underline" onClick={() => act(e, "borrow")}>
                          {t("借用")}
                        </button>
                      )}
                      {e.status === "borrowed" && (isStaff(me.role) || e.borrower_id === me.id) && (
                        <button className="text-emerald-300 hover:underline" onClick={() => act(e, "return")}>
                          {t("歸還")}
                        </button>
                      )}
                      {isStaff(me.role) && e.status !== "borrowed" && (
                        <button className="text-slate-400 hover:underline" onClick={() => act(e, "maintenance")}>
                          {e.status === "maintenance" ? t("修好了") : t("送修")}
                        </button>
                      )}
                      {isStaff(me.role) && (
                        <button className="text-slate-500 hover:text-rose-400" onClick={() => remove(e)}>
                          {t("刪除")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {equipment.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  {t("還沒有登記設備")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isStaff(me.role) && (
        <form onSubmit={addEquipment} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:grid-cols-[1fr_10rem_1fr_auto]">
          <input className={INPUT_CLS} placeholder={t("設備名稱，例如：T200 備用推進器")} value={name} onChange={(e) => setName(e.target.value)} />
          <select className={INPUT_CLS} value={category} onChange={(e) => setCategory(e.target.value)}>
            {EQUIPMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className={INPUT_CLS} placeholder={t("備註（序號、位置…選填）")} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={BTN} disabled={!name.trim()}>{t("新增設備")}</button>
        </form>
      )}
    </div>
  );
}
