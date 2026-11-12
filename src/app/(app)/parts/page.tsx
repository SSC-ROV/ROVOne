"use client";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { tt } from "@/lib/i18n-core";
import { BTN, INPUT_CLS, PART_STATUSES, groupColor, subteamLabel } from "@/lib/ui";
import { fmtMD } from "@/lib/date";
import { isValidBuyLink } from "@/lib/inventory";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageError, PageLoading } from "@/components/PageState";
import { CheckIcon, CircleDotIcon, ExternalLinkIcon, LayersIcon, LinkIcon, PanelRightOpenIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Choice, MultiFilter } from "@/components/tasks/shared";
import { DetailRow, FormField, RowActions, StatusDot, TableEmpty, TableToolbar, TitleCell } from "@/components/board/BoardTable";
import { BoardGroup } from "@/components/board/BoardGroup";
import { BoardHeader } from "@/components/board/BoardHeader";
import { Label, StatusCell } from "@/components/board/ColorCell";
import { PersonCell } from "@/components/board/PersonCell";
import type { Me, Part, PartStatus } from "@/lib/types";

export default function PartsPage() {
  const { lang, t } = useI18n();
  const { subteams } = useSubteams();
  const { confirm, prompt, toast } = useDialogs();
  const [parts, setParts] = useState<Part[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [fSubteam, setFSubteam] = useState<string[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
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
    // 從庫存頁「申請補貨」過來：預先帶入名稱、規格與用途
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setName(params.get("name") ?? "");
      setSpec(params.get("spec") ?? "");
      setPurpose(params.get("purpose") ?? "");
      setLink(params.get("link") ?? "");
      setEstPrice(params.get("est_price") ?? "");
      setShowForm(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  if (error) return <PageError message={error} />;
  if (!parts || !me) return <PageLoading label={t("載入中…")} />;

  const staff = isStaff(me.role);
  const needle = q.trim().toLowerCase();
  const filtered = parts.filter(
    (p) =>
      (fStatus.length === 0 || fStatus.includes(p.status)) &&
      (fSubteam.length === 0 || fSubteam.includes(p.subteam)) &&
      (!needle || [p.name, p.spec, p.purpose, p.requested_by_name ?? "", p.order_vendor].join(" ").toLowerCase().includes(needle))
  );
  const narrowing = needle.length > 0 || fStatus.length > 0 || fSubteam.length > 0;
  const openPart = openId != null ? parts.find((p) => p.id === openId) ?? null : null;
  const statusFilter = PART_STATUSES.map((s) => ({ value: s.key, label: s.label, color: s.color }));
  const subteamFilter = subteams.map((s, i) => ({ value: s.key, label: s.label, color: groupColor(i) }));
  const subteamColor = (key: string) => {
    const i = subteams.findIndex((s) => s.key === key);
    return i >= 0 ? groupColor(i) : "var(--c-gray)";
  };
  // 用管理員自訂的組別名稱；找不到才退回內建名稱
  const subteamName = (key: string) => subteams.find((s) => s.key === key)?.label ?? subteamLabel(key);
  const canEditSubteam = (p: Part) => staff || (p.requested_by === me.id && p.status === "pending");
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
    if (!link.trim()) { toast(t("請填寫購買連結"), "err"); return; }
    if (!isValidBuyLink(link)) { toast(t("購買連結需以 http:// 或 https:// 開頭"), "err"); return; }
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

  async function changeSubteam(p: Part, next: string) {
    if (next === p.subteam) return;
    const snapshot = parts;
    setParts((prev) => prev!.map((x) => (x.id === p.id ? { ...x, subteam: next as Part["subteam"] } : x)));
    try {
      await api(`/api/parts/${p.id}`, { method: "PATCH", body: JSON.stringify({ subteam: next }) });
    } catch (err) {
      setParts(snapshot);
      toast(t((err as Error).message), "err");
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
        title={t("採購申請")}
        subtitle={t("需求 → 老師審批 → 下單 → 到貨，一頁追蹤")}
        action={
          <>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon /> {tt("新採購申請", "New request")}
          </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-6 text-sm">
        <span><b className="text-xl tabular-nums">{pendingCount}</b> {t("待老師審批")}</span>
        <span><b className="text-xl tabular-nums">{buying.length}</b> {t("核准後採買中")}</span>
        <span><b className="text-xl tabular-nums">{arrived.length}</b> {t("已到貨")}</span>
        <span><b className="text-xl tabular-nums">${Math.round(totalSpent).toLocaleString()}</b> / ${Math.round(totalEst).toLocaleString()}</span>
      </div>

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

      <TableToolbar
        query={q}
        onQuery={setQ}
        placeholder={tt("搜尋零件、規格、用途、申請人…", "Search parts, specs, purpose, people…")}
        narrowing={narrowing}
        onClear={() => {
          setQ("");
          setFStatus([]);
          setFSubteam([]);
        }}
        shown={filtered.length}
        total={parts.length}
        noun={["項", "requests"]}
        filters={
          <>
            <MultiFilter label={tt("狀態", "Status")} icon={<CircleDotIcon className="size-3.5" />} value={fStatus} onChange={setFStatus} options={statusFilter} />
            <MultiFilter label={tt("組別", "Subteam")} icon={<LayersIcon className="size-3.5" />} value={fSubteam} onChange={setFSubteam} options={subteamFilter} />
          </>
        }
      />

      {filtered.length === 0 && (
        <div className="rounded-[8px] border border-dashed border-border bg-card">
          <TableEmpty>{parts.length === 0 ? tt("還沒有採購申請", "No purchase requests yet") : t("沒有符合的零件申請")}</TableEmpty>
        </div>
      )}
      {PART_STATUSES.map((status) => {
        const rows = filtered.filter((p) => p.status === status.key);
        if (rows.length === 0) return null;
        return (
          <BoardGroup
            key={status.key}
            title={status.label}
            color={status.color}
            icon={<StatusDot color={status.color} />}
            count={rows.length}
            defaultOpen={status.key !== "rejected"}
          >
            <table className="board-table is-interactive table-fixed" style={{ minWidth: 1080 }}>
              <colgroup>
                <col />
                <col style={{ width: 170 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr>
                  <th><span className="pl-8">{tt("零件", "Part")}</span></th>
                  <th>{tt("申請人", "Requested by")}</th>
                  <th className="color-cell">{t("狀態")}</th>
                  <th>{tt("數量", "Qty")}</th>
                  <th>{tt("金額", "Amount")}</th>
                  <th>{t("組別")}</th>
                  <th>{tt("申請日", "Requested")}</th>
                  <th aria-label={tt("動作", "Actions")} />
                </tr>
              </thead>
              <tbody>
                {rows.map((p, index) => {
                  const canDelete = staff || (p.requested_by === me.id && p.status === "pending");
                  return (
                    <tr key={p.id} className="group/row">
                      <td>
                        <TitleCell index={index} title={p.name} sub={p.spec} muted={p.status === "rejected"} onOpen={() => setOpenId(p.id)} />
                      </td>
                      <td><PersonCell name={p.requested_by_name} /></td>
                      <td className="color-cell">
                        <StatusCell value={p.status} options={partOptions} disabled={!staff} onChange={(value) => onPartStatus(p, value)} />
                      </td>
                      <td className="tabular-nums">× {p.qty} {t(p.unit)}</td>
                      <td className="tabular-nums">
                        {p.actual_price != null ? (
                          <span title={t("實際")}>${p.actual_price.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground" title={t("預估")}>≈ ${(p.est_price * p.qty).toLocaleString()}</span>
                        )}
                      </td>
                      <td><Label color={subteamColor(p.subteam)}>{subteamName(p.subteam)}</Label></td>
                      <td className="tabular-nums text-muted-foreground">{fmtMD(p.created_at.slice(0, 10))}</td>
                      <td>
                        <RowActions
                          label={p.name}
                          actions={[
                            { label: tt("開啟詳情", "Open details"), icon: <PanelRightOpenIcon />, onSelect: () => setOpenId(p.id) },
                            { label: tt("開啟購買連結", "Open purchase link"), icon: <ExternalLinkIcon />, onSelect: () => window.open(p.link, "_blank", "noopener"), hidden: !p.link },
                            { label: t("批准"), icon: <CheckIcon />, onSelect: () => decide(p, "approved"), hidden: !(staff && p.status === "pending"), separator: true },
                            { label: t("駁回"), icon: <XIcon />, onSelect: () => decide(p, "rejected"), hidden: !(staff && p.status === "pending") },
                            { label: t("複製老師審批連結"), icon: <LinkIcon />, onSelect: () => copyApproveLink(p), hidden: !(staff && p.status === "pending" && p.approve_token) },
                            { label: t("刪除"), icon: <Trash2Icon />, onSelect: () => removePart(p), destructive: true, separator: true, hidden: !canDelete },
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

      <Sheet open={openPart != null} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <SheetContent className="w-full gap-0 sm:max-w-[480px]" style={{ width: "min(480px, 100%)", maxWidth: 480 }}>
          {openPart && (
            <>
              <SheetHeader className="border-b border-border px-5">
                <SheetTitle className="text-lg">{openPart.name}</SheetTitle>
                <SheetDescription>
                  {tt("申請人", "Requested by")} {openPart.requested_by_name ?? "—"} · {fmtMD(openPart.created_at.slice(0, 10))}
                </SheetDescription>
              </SheetHeader>
              <dl className="flex flex-col gap-4 overflow-y-auto px-5 py-4 text-sm">
                <DetailRow label={t("狀態")}>
                  <StatusCell value={openPart.status} options={partOptions} disabled={!staff} onChange={(value) => onPartStatus(openPart, value)} />
                </DetailRow>
                <DetailRow label={t("規格")}>{openPart.spec}</DetailRow>
                <DetailRow label={tt("數量", "Qty")}>× {openPart.qty} {t(openPart.unit)}</DetailRow>
                <DetailRow label={tt("金額", "Amount")}>
                  {openPart.actual_price != null
                    ? `${t("實際")} $${openPart.actual_price.toLocaleString()}`
                    : `${t("預估")} $${(openPart.est_price * openPart.qty).toLocaleString()}`}
                </DetailRow>
                <DetailRow label={t("組別")}>
                  {canEditSubteam(openPart) ? (
                    <Choice
                      value={openPart.subteam}
                      onChange={(value) => changeSubteam(openPart, value)}
                      options={subteams.map((s) => ({ value: s.key, label: s.label }))}
                      className="w-full"
                      ariaLabel={t("組別")}
                    />
                  ) : (
                    <Label color={subteamColor(openPart.subteam)}>{subteamName(openPart.subteam)}</Label>
                  )}
                </DetailRow>
                <DetailRow label={t("用途")}>{openPart.purpose}</DetailRow>
                <DetailRow label={t("購買連結")}>
                  {openPart.link && (
                    <a href={openPart.link} target="_blank" rel="noreferrer" className="break-all text-[var(--c-blue)] hover:underline">
                      {openPart.link}
                    </a>
                  )}
                </DetailRow>
                <DetailRow label={t("審批備註")}>{openPart.decided_note}</DetailRow>
                <DetailRow label={t("下單")}>
                  {openPart.order_vendor ? `${openPart.order_vendor}${openPart.order_ref ? `（${openPart.order_ref}）` : ""}` : ""}
                </DetailRow>
                <DetailRow label={t("到貨")}>{openPart.arrived_at ? fmtMD(openPart.arrived_at.slice(0, 10)) : ""}</DetailRow>
              </dl>
              {staff && openPart.status === "pending" && (
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
                  <Button onClick={() => decide(openPart, "approved")}><CheckIcon /> {t("批准")}</Button>
                  <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => decide(openPart, "rejected")}><XIcon /> {t("駁回")}</Button>
                  {openPart.approve_token && (
                    <Button variant="ghost" onClick={() => copyApproveLink(openPart)}><LinkIcon /> {t("複製老師審批連結")}</Button>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="w-full gap-0 sm:max-w-[520px]" style={{ width: "min(520px, 100%)", maxWidth: 520 }}>
          <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b border-border px-5">
              <SheetTitle className="text-lg">{tt("新採購申請", "New purchase request")}</SheetTitle>
              <SheetDescription>{tt("送出後會產生老師審批連結", "Sending it creates an approval link for the teacher")}</SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 text-sm">
              <FormField label={tt("零件名稱", "Part name")}>
                <Input autoFocus className="h-9" placeholder={tt("例如：T200 推進器", "e.g. T200 thruster")} value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <FormField label={t("規格 / 型號")}>
                <Input className="h-9" value={spec} onChange={(e) => setSpec(e.target.value)} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={tt("數量", "Qty")}>
                  <Input className="h-9" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                </FormField>
                <FormField label={t("單位")}>
                  <Input className="h-9" value={unit} onChange={(e) => setUnit(e.target.value)} />
                </FormField>
                <FormField label={`${t("預估單價")} $`}>
                  <Input className="h-9" type="number" min="0" value={estPrice} onChange={(e) => setEstPrice(e.target.value)} />
                </FormField>
                <FormField label={t("組別")}>
                  <Choice value={subteam} onChange={setSubteam} options={subteams.map((s) => ({ value: s.key, label: s.label }))} className="w-full" ariaLabel={t("組別")} />
                </FormField>
              </div>
              <FormField label={tt("購買連結 *", "Buy link *")}>
                <Input className="h-9" type="url" required placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
              </FormField>
              <FormField label={t("用途（給老師看的說明）")}>
                <textarea
                  className="field-sizing-content min-h-24 rounded-[8px] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </FormField>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-5 py-3">
              <Button type="button" variant="ghost" className="ml-auto" onClick={() => setShowForm(false)}>{t("取消")}</Button>
              <Button type="submit" disabled={busy || !name.trim() || !link.trim()}>{busy ? t("送出中…") : t("送出申請")}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
