"use client";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { BTN, INPUT_CLS, SELECT_CLS, SUBTEAMS, SUBTEAM_CLS, CHIP, PART_STATUSES, partStatus, subteamLabel } from "@/lib/ui";
import { fmtMD } from "@/lib/date";
import { useDialogs } from "@/components/ui/Dialogs";
import type { Me, Part, PartStatus } from "@/lib/types";

export default function PartsPage() {
  const { t } = useI18n();
  const { subteams } = useSubteams();
  const { confirm, prompt, toast } = useDialogs();
  const [parts, setParts] = useState<Part[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [fStatus, setFStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [ordering, setOrdering] = useState<{ part: Part; vendor: string; price: string } | null>(null);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [link, setLink] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("個");
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

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p>
    );
  }
  if (!parts || !me) {
    return <p className="py-20 text-center text-sm text-slate-500">{t("載入中…")}</p>;
  }

  const filtered = parts.filter((p) => fStatus === "all" || p.status === fStatus);
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
      confirmText: "刪除",
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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{t("零件採買")}</h1>
        <span className="text-sm text-slate-500">{t("需求 → 老師審批 → 下單 → 到貨，一頁追蹤")}</span>
        <div className="ml-auto flex items-center gap-2">
          <select className={`${SELECT_CLS} w-32`} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="all">{t("全部狀態")}</option>
            {PART_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <button className={BTN} onClick={() => setShowForm(!showForm)}>
            {t("＋ 新零件需求")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="待老師審批" value={String(pendingCount)} accent="text-amber-300" />
        <StatCard label="核准後採買中" value={String(buying.length)} accent="text-cyan-300" />
        <StatCard label="已到貨" value={String(arrived.length)} accent="text-emerald-300" />
        <StatCard label="花費 / 預估" value={`$${Math.round(totalSpent).toLocaleString()} / $${Math.round(totalEst).toLocaleString()}`} accent="text-slate-200" />
      </div>

      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
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

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/40 py-12 text-center text-sm text-slate-500">
            {t("沒有符合的零件申請")}
          </p>
        )}
        {filtered.map((p) => {
          const st = partStatus(p.status);
          const canDelete = isStaff(me.role) || (p.requested_by === me.id && p.status === "pending");
          return (
            <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.chip}`}>
                  {st.label}
                </span>
                <span className="font-bold">{p.name}</span>
                <span className="text-sm text-slate-400">× {p.qty} {p.unit}</span>
                <span className={`${CHIP} ${SUBTEAM_CLS[p.subteam] ?? ""}`}>{subteamLabel(p.subteam)}</span>
                <span className="ml-auto text-sm tabular-nums">
                  {p.actual_price != null ? (
                    <span className="text-emerald-300">{t("實際")} ${p.actual_price.toLocaleString()}</span>
                  ) : (
                    <span className="text-slate-300">{t("預估")} ${(p.est_price * p.qty).toLocaleString()}</span>
                  )}
                </span>
              </div>
              {p.spec && <p className="mt-1 text-sm text-slate-400">{t("規格")}：{p.spec}</p>}
              {p.purpose && <p className="mt-1 text-sm text-slate-400">{t("用途")}：{p.purpose}</p>}
              {p.link && (
                <a href={p.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-cyan-300 hover:underline">
                  {t("購買連結")} ↗
                </a>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{t("申請人")}：{p.requested_by_name ?? "—"}</span>
                {p.decided_note && <span className="text-slate-400">{t("審批備註")}：{p.decided_note}</span>}
                {p.order_vendor && <span>{t("下單")}：{p.order_vendor}{p.order_ref ? `（${p.order_ref}）` : ""}</span>}
                {p.arrived_at && <span>{t("到貨")}：{fmtMD(p.arrived_at.slice(0, 10))}</span>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {p.status === "pending" && isStaff(me.role) && (
                  <>
                    <button
                      className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-emerald-400"
                      onClick={() => decide(p, "approved")}
                    >
                      ✓ {t("批准")}
                    </button>
                    <button
                      className="rounded-lg bg-rose-500 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-rose-400"
                      onClick={() => decide(p, "rejected")}
                    >
                      ✕ {t("駁回")}
                    </button>
                    {p.approve_token && (
                      <button className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300 transition hover:bg-amber-500/20" onClick={() => copyApproveLink(p)}>
                        {t("複製老師審批連結")}
                      </button>
                    )}
                  </>
                )}
                {isStaff(me.role) && p.status !== "pending" && (
                  <select
                    className={`${SELECT_CLS} w-28 text-xs`}
                    value={p.status}
                    onChange={(e) => setStatus(p, e.target.value as PartStatus)}
                  >
                    {PART_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                )}

                {canDelete && (
                  <button className="ml-auto text-xs text-slate-500 transition hover:text-rose-400" onClick={() => removePart(p)}>
                    刪除
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className={`text-xl font-black tabular-nums ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}
