import { cookies } from "next/headers";
import { getPartByToken } from "@/lib/db";
import { subteamLabel } from "@/lib/ui";
import ApproveActions from "@/components/ApproveActions";

export const metadata = { title: "零件申請審批 · ROV 隊伍任務平台" };

export default async function ApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lang = (await cookies()).get("rov_lang")?.value === "en" ? "en" : "zh";
  const t = (zh: string, en: string) => (lang === "en" ? en : zh);
  const part = await getPartByToken(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top,rgba(8,145,178,0.22),transparent_60%)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-black text-slate-950">
            ROV
          </span>
          <h1 className="text-xl font-bold">{t("零件申請審批", "Part Request Approval")}</h1>
          <p className="text-sm text-slate-400">{t("學生採買申請，麻煩您審核", "A student purchase request for your review")}</p>
        </div>

        {!part ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
            <p className="text-rose-300">{t("找不到這個審批連結，請跟學生確認連結是否正確。", "Approval link not found — please check the link with the student.")}</p>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <div>
              <p className="text-2xl font-bold">
                {part.name}
                <span className="ml-2 text-base font-normal text-slate-400">
                  × {part.qty} {part.unit}
                </span>
              </p>
              <p className="mt-1 text-lg text-cyan-300">{t("預估金額 ", "Estimated total ")}${part.est_price * part.qty}</p>
            </div>
            <dl className="space-y-2 text-sm">
              {part.spec && (
                <div>
                  <dt className="text-slate-500">{t("規格 / 型號", "Spec / Model")}</dt>
                  <dd className="text-slate-200">{part.spec}</dd>
                </div>
              )}
              {part.link && (
                <div>
                  <dt className="text-slate-500">{t("購買連結", "Purchase link")}</dt>
                  <dd>
                    <a href={part.link} target="_blank" rel="noreferrer" className="break-all text-cyan-300 hover:underline">
                      {part.link} ↗
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">{t("用途", "Purpose")}</dt>
                <dd className="text-slate-200">{part.purpose || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("申請組別", "Subteam")}</dt>
                <dd className="text-slate-200">{subteamLabel(part.subteam)}</dd>
              </div>
            </dl>

            {part.status === "pending" ? (
              <ApproveActions token={token} />
            ) : (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  part.status === "approved"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : part.status === "rejected"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      : "border-slate-700 bg-slate-800/60 text-slate-300"
                }`}
              >
                {part.status === "approved" && t("✅ 已核准，學生會接著採買。", "✅ Approved. The student will proceed with the purchase.")}
                {part.status === "rejected" && t("❌ 已駁回。", "❌ Rejected.")}
                {(part.status === "ordered" || part.status === "arrived") &&
                  t("✅ 已核准（學生已完成採買流程）。", "✅ Approved (purchase completed).")}
                {part.decided_note && <p className="mt-1 text-slate-400">{t("備註：", "Note: ")}{part.decided_note}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
