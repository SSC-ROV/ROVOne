"use client";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { tt } from "@/lib/i18n-core";
import { BTN, INPUT_CLS, PART_STATUSES, SELECT_CLS, subteamLabel } from "@/lib/ui";
import { fmtMD } from "@/lib/date";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageEmpty, PageError, PageLoading } from "@/components/PageState";
import { BoardGroup } from "@/components/board/BoardGroup";
import { BoardHeader } from "@/components/board/BoardHeader";
import { StatusCell } from "@/components/board/ColorCell";
import { PersonCell } from "@/components/board/PersonCell";
import type { Me, Part, PartStatus } from "@/lib/types";

export default function PartsPage() {
  const { lang, t } = useI18n();
  const { subteams } = useSubteams();
  const { confirm, prompt, toast } = useDialogs();
  const [parts, setParts] = useState<Part[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [fStatus, setFStatus] = useState("all");
  const [fSubteam, setFSubteam] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [ordering, setOrdering] = useState<{ part: Part; vendor: string; price: string } | null>(null);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [link, setLink] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState(lang === "en" ? "pcs" : "個");
  const [estPrice, setEstPrice] = useState("");
  const [purpose, setPurpose] = useState("");
  const [subteam, setSubteam] = useState("general");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [p, u] = await Promise.all([
      api<{ parts: Part[] }>("/api/parts"),
      api<{ user: Me | null }>("/api/auth/me"),
    ]);
    setParts(p.parts);
    setMe(u.user);
  }

  const bgReload = () => { load().catch(() => {}); };
  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <PageError message={error} />;
  if (!parts || !me) return <PageLoading label={t("載入中…")} />;

  const filtered = parts.filter(
    (p) => (fStatus === "all" || p.status === fStatus) && (fSubteam === "all" || p.subteam === fSubteam)
  );
  const partOptions = PART_STATUSES.map((s) => ({ value: s.key, label: s.label, color: s.color }));
  const pendingCount = parts.filter((p) => p.status === "pending").length;
  const buying = parts.filter((p) => p.status === "approved" || p.status === "ordered");
  const arrived = parts.filter((p) => p.status === "arrived");
  // est_price 是單價；actual_price 直接存整筆總價
  const totalEst = parts
    .filter((p) => p.status !== "rejected")
    .reduce((a, p) => a + (p.est_price || 0) * p.qty, 0);
  const totalSpent = arrived.reduce((a, p) => a + (p.actual_price ?? 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/parts", {
        method: "POST",
        body: JSON.stringify({
          name,
          spec,
          link,
          qty: Number(qty) || 1,
          unit,
          est_price: Number(estPrice) || 0,
          purpose,
          subteam,
        }),
      });
      setName(""); setSpec(""); setLink(""); setQty("1"); setEstPrice(""); setPurpose("");
      setShowForm(false);
      toast(t("申請已送出，等老師審批就好"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setBusy(false);
    }
  }

  function onPartStatus(p: Part, next: string) {
    if (next === p.status) return;
    if (next === "approved" || next === "rejected") {
      decide(p, next);
      return;
    }
    setStatus(p, next as PartStatus);
  }

  async function setStatus(p: Part, status: PartStatus) {
    try {
      if (status === "ordered") {
        setOrdering({ part: p, vendor: p.order_vendor, price: "" });
        return;
      }
      await api(`/api/parts/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function confirmOrder() {
    if (!ordering) return;
    const snapshot = parts;
    const apply = (patch: Partial<Part>) =>
      setParts((prev) => prev!.map((x) => (x.id === ordering.part.id ? { ...x, ...patch } : x)));
    apply({ status: "ordered", order_vendor: ordering.vendor, actual_price: ordering.price === "" ? null : Number(ordering.price) || null });
    try {
      await api(`/api/parts/${ordering.part.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "ordered",
          order_vendor: ordering.vendor,
          actual_price: ordering.price === "" ? null : Number(ordering.price) || null,
        }),
      });
      toast(t("已標記為已下單"));
      setOrdering(null);
      bgReload();
    } catch (err) {
      setParts(snapshot);
      setOrdering(null);
      toast(t((err as Error).message), "err");
    }
  }

  async function decide(p: Part, decision: "approved" | "rejected") {
    let note = "";
    if (decision === "rejected") {
      const input = await prompt({ title: `駁回「${p.name}」`, label: t("給申請人的備註（可留空）") });
      if (input === null) return;
      note = input;
    }
    const snapshot = parts;
    // 樂觀：立即更新狀態
    setParts((prev) =>
      prev!.map((x) =>
        x.id === p.id
          ? { ...x, status: decision, decided_note: note, decided_at: x.decided_at ?? new Date().toISOString() }
          : x
      )
    );
    try {
      await api(`/api/parts/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: decision, decided_note: note }),
      });
      toast(decision === "approved" ? t("已核准") + `「${p.name}」` : t("已駁回") + `「${p.name}」`);
      bgReload();
    } catch (err) {
      setParts(snapshot);
      toast(t((err as Error).message), "err");
    }
  }

  async function removePart(p: Part) {
    const ok = await confirm({
      title: `${t("刪除")}「${p.name}」${t("的申請？")}`,
      confirmText: t("刪除"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/parts/${p.id}`, { method: "DELETE" });
      toast(t("已刪除"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function copyApproveLink(p: Part) {
    const url = `${location.origin}/approve/${p.approve_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("審批連結已複製！用 LINE / Messenger 傳給老師，打開就能按核准"));
    } catch {
      await prompt({ title: t("複製這個審批連結給老師"), initial: url });
    }
  }

  return (
    <div className="space-y-4">
      <BoardHeader
        title={t("零件採買")}
        subtitle={t("需求 → 老師審批 → 下單 → 到貨，一頁追蹤")}
        action={
          <>
          <select className={`${SELECT_CLS} w-32`} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="all">{t("全部狀態")}</option>
            {PART_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select className={`${SELECT_CLS} w-32`} value={fSubteam} onChange={(e) => setFSubteam(e.target.value)}>
            <option value="all">{t("全部組別")}</option>
            {subteams.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <button className={BTN} onClick={() => setShowForm(!showForm)}>
            {t("＋ 新零件需求")}
          </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-6 text-sm">
        <span><b className="text-xl tabular-nums">{pendingCount}</b> {t("待老師審批")}</span>
        <span><b className="text-xl tabular-nums">{buying.length}</b> {t("核准後採買中")}</span>
        <span><b className="text-xl tabular-nums">{arrived.length}</b> {t("已到貨")}</span>
        <span><b className="text-xl tabular-nums">${Math.round(totalSpent).toLocaleString()}</b> / ${Math.round(totalEst).toLocaleString()}</span>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-[16px] border border-border bg-card p-5">
          <h2 className="font-bold">{t("新增零件需求（送出後自動產生「老師審批連結」）")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <input className={INPUT_CLS} placeholder={t("零件名稱 *")} value={name} onChange={(e) => setName(e.target.value)} />
            <input className={INPUT_CLS} placeholder={t("規格 / 型號")} value={spec} onChange={(e) => setSpec(e.target.value)} />
            <input className={INPUT_CLS} placeholder={t("購買連結（選填）")} value={link} onChange={(e) => setLink(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className={INPUT_CLS} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              <input className={INPUT_CLS} placeholder={t("單位")} value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <input className={INPUT_CLS} type="number" min="0" placeholder={`${t("預估單價")} $`} value={estPrice} onChange={(e) => setEstPrice(e.target.value)} />
            <select className={INPUT_CLS} value={subteam} onChange={(e) => setSubteam(e.target.value)}>
              {subteams.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <input className={`${INPUT_CLS} sm:col-span-3`} placeholder={t("用途（給老師看的說明）")} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <button className={BTN} disabled={busy || !name.trim()}>{busy ? t("送出中…") : t("送出申請")}</button>
        </form>
      )}

      {ordering && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            confirmOrder();
          }}
          className="mb-4 flex flex-wrap items-end gap-2 rounded-[8px] border border-border bg-card p-3"
        >
          <p className="w-full text-sm font-medium">{t("在哪裡下單？")} · {ordering.part.name}</p>
          <input
            className={INPUT_CLS}
            placeholder={t("在哪裡下單？")}
            value={ordering.vendor}
            onChange={(event) => setOrdering({ ...ordering, vendor: event.target.value })}
          />
          <input
            className={INPUT_CLS}
            placeholder={t("實際金額（整筆總價，可留空）")}
            value={ordering.price}
            onChange={(event) => setOrdering({ ...ordering, price: event.target.value })}
          />
          <button className={BTN} type="submit">{t("✓ 確認下單")}</button>
          <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => setOrdering(null)}>
            {t("取消")}
          </button>
        </form>
      )}

      <BoardGroup title={t("零件採買")} color="#579bfc" count={filtered.length}>
        {filtered.length === 0 && <PageEmpty>{t("沒有符合的零件申請")}</PageEmpty>}
        {filtered.length > 0 && (
          <table className="board-table">
            <thead>
              <tr>
                <th>{tt("零件", "Part")}</th>
                <th>{t("負責人")}</th>
                <th className="color-cell">{t("狀態")}</th>
                <th>{tt("數量", "Qty")}</th>
                <th>{t("組別")}</th>
                <th>{tt("金額", "Amount")}</th>
                <th>{t("操作")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const canDelete = isStaff(me.role) || (p.requested_by === me.id && p.status === "pending");
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="max-w-sm whitespace-normal py-1">
                        <div className="font-medium">{p.name}</div>
                        {p.spec && <p className="text-xs text-muted-foreground">{t("規格")}：{p.spec}</p>}
                        {p.purpose && <p className="text-xs text-muted-foreground">{t("用途")}：{p.purpose}</p>}
                        {p.link && (
                          <a href={p.link} target="_blank" rel="noreferrer" className="text-xs text-[#2383a5] hover:underline">
                            {t("購買連結")} ↗
                          </a>
                        )}
                        {p.decided_note && <p className="text-xs text-muted-foreground">{t("審批備註")}：{p.decided_note}</p>}
                        {p.order_vendor && (
                          <p className="text-xs text-muted-foreground">
                            {t("下單")}：{p.order_vendor}{p.order_ref ? `（${p.order_ref}）` : ""}
                          </p>
                        )}
                        {p.arrived_at && <p className="text-xs text-muted-foreground">{t("到貨")}：{fmtMD(p.arrived_at.slice(0, 10))}</p>}
                      </div>
                    </td>
                    <td>
                      <PersonCell name={p.requested_by_name} />
                    </td>
                    <td className="color-cell">
                      <StatusCell
                        value={p.status}
                        options={partOptions}
                        disabled={!isStaff(me.role)}
                        onChange={(value) => onPartStatus(p, value)}
                      />
                    </td>
                    <td className="tabular-nums">× {p.qty} {t(p.unit)}</td>
                    <td>{subteamLabel(p.subteam)}</td>
                    <td className="tabular-nums">
                      {p.actual_price != null ? (
                        <span>{t("實際")} ${p.actual_price.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground">{t("預估")} ${(p.est_price * p.qty).toLocaleString()}</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2 py-1">
                        {p.status === "pending" && isStaff(me.role) && (
                          <>
                            <button
                              type="button"
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-bold text-ink shadow transition hover:bg-emerald-400"
                              onClick={() => decide(p, "approved")}
                            >
                              ✓ {t("批准")}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-bold text-ink shadow transition hover:bg-rose-400"
                              onClick={() => decide(p, "rejected")}
                            >
                              ✕ {t("駁回")}
                            </button>
                            {p.approve_token && (
                              <button type="button" className="rounded-lg border border-amber-200 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-600 transition hover:bg-amber-500/20" onClick={() => copyApproveLink(p)}>
                                {t("複製老師審批連結")}
                              </button>
                            )}
                          </>
                        )}
                        {canDelete && (
                          <button type="button" className="text-xs text-muted-foreground transition hover:text-rose-400" onClick={() => removePart(p)}>
                            {t("刪除")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </BoardGroup>
    </div>
  );
}
