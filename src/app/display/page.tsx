import { redirect } from "next/navigation";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateDisplayToken, getSettingValue } from "@/lib/db";
import Clock from "./Clock";
import AutoRefresh, { FullscreenButton } from "./AutoRefresh";
import MonthCalendar from "./MonthCalendar";

export const dynamic = "force-dynamic";

const TYPE_DOT: Record<string, string> = {
  meeting: "bg-cyan-400",
  watertest: "bg-sky-400",
  competition: "bg-rose-400",
  other: "bg-slate-400",
};

/** 香港時區今天（YYYY-MM-DD），與全站日期口徑一致 */
function hkToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(b + "T00:00:00+08:00") - Date.parse(a + "T00:00:00+08:00")) / 86400000
  );
}

function weekdayZh(dateStr: string): string {
  return new Date(dateStr + "T00:00:00+08:00").toLocaleDateString("zh-TW", {
    weekday: "short",
    timeZone: "Asia/Hong_Kong",
  });
}

type CycleRow = {
  id: number; title: string; start_date: string; end_date: string;
  status: string; proposer_name: string | null;
};

export default async function DisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 授權：看板連結令牌 或 已登入用戶
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const displayToken = await getOrCreateDisplayToken();
  if (token !== displayToken) {
    const user = await getSessionUser();
    if (!user) redirect("/login");
  }

  const today = hkToday();

  // 與週期頁相同：已核准的週期到了開始日 → 自動轉為進行中（看板也會觸發，Pi 長期顯示不會卡在「即將開始」）
  await sql`
    UPDATE cycles SET status = 'active'
    WHERE status = 'approved' AND start_date <= ((now() AT TIME ZONE 'Asia/Hong_Kong')::date)::text`;

  const plus14 = new Date(Date.parse(today + "T00:00:00+08:00") + 14 * 86400000)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  const calFrom = new Date(Date.parse(today + "T00:00:00+08:00") - 100 * 86400000)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  const calTo = new Date(Date.parse(today + "T00:00:00+08:00") + 200 * 86400000)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });

  const [teamName, competitionDate] = await Promise.all([
    getSettingValue("team_name"),
    getSettingValue("competition_date"),
  ]);

  const cycles = (await sql`
    SELECT c.id, c.title, c.start_date, c.end_date, c.status,
           u.display_name AS proposer_name
    FROM cycles c LEFT JOIN users u ON u.id = c.proposer_id
    WHERE c.status IN ('active', 'late')
       OR (c.status = 'approved' AND c.start_date > ${today})
    ORDER BY CASE c.status WHEN 'late' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
             c.end_date`) as CycleRow[];

  const ids = cycles.map((c) => c.id);
  type TaskAgg = { cycle_id: number; total: number; done: number };
  type MemberRow = { cycle_id: number; display_name: string };
  const taskAggs: TaskAgg[] = ids.length
    ? await sql`SELECT cycle_id, COUNT(*)::int AS total,
                       COUNT(*) FILTER (WHERE status = 'done')::int AS done
                FROM tasks WHERE cycle_id = ANY(${ids}) GROUP BY cycle_id`
    : [];
  const memberRows: MemberRow[] = ids.length
    ? await sql`SELECT cm.cycle_id, u.display_name
                FROM cycle_members cm JOIN users u ON u.id = cm.user_id
                WHERE cm.cycle_id = ANY(${ids}) ORDER BY cm.cycle_id, u.id`
    : [];
  const eventList: { id: number; title: string; type: string; date: string;
    time: string | null; location: string | null }[] = await sql`
    SELECT id, title, type, date, time, location
    FROM events WHERE date >= ${calFrom} AND date <= ${calTo}
    ORDER BY date, time NULLS LAST, id`;
  const taskDue: { title: string; cycle_title: string; due_date: string }[] = await sql`
    SELECT t.title, c.title AS cycle_title, t.due_date
    FROM tasks t JOIN cycles c ON c.id = t.cycle_id
    WHERE t.due_date IS NOT NULL AND t.due_date >= ${calFrom} AND t.due_date <= ${calTo}
      AND t.status <> 'done'
    ORDER BY t.due_date, t.id`;

  const taskMap = new Map(taskAggs.map((t) => [Number(t.cycle_id), t]));
  const memberMap = new Map<number, string[]>();
  for (const m of memberRows) {
    const k = Number(m.cycle_id);
    (memberMap.get(k) ?? memberMap.set(k, []).get(k)!).push(String(m.display_name));
  }

  const late = cycles.filter((c) => c.status === "late");
  const active = cycles.filter((c) => c.status === "active");
  const upcoming = cycles.filter((c) => c.status === "approved");

  // 日程按日期分組
  const agenda = new Map<string, typeof eventList>();
  for (const e of eventList) {
    (agenda.get(e.date) ?? agenda.set(e.date, []).get(e.date)!).push(e);
  }

  const compDays =
    competitionDate && competitionDate >= today ? daysBetween(today, competitionDate) : null;

  const cycleCard = (c: CycleRow) => {
    const totalDays = Math.max(1, daysBetween(c.start_date, c.end_date));
    const elapsed = Math.min(totalDays, Math.max(0, daysBetween(c.start_date, today)));
    const pct = Math.round((elapsed / totalDays) * 100);
    const task = taskMap.get(c.id);
    const members = memberMap.get(c.id) ?? [];
    const barColor =
      c.status === "late" ? "bg-rose-400" : c.status === "active" ? "bg-emerald-400" : "bg-sky-400";
    const chip =
      c.status === "late"
        ? "bg-rose-500/15 text-rose-300"
        : c.status === "active"
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-sky-500/15 text-sky-300";
    const chipLabel =
      c.status === "late" ? "遲交" : c.status === "active" ? "進行中" : "即將開始";
    const left = daysBetween(today, c.end_date);
    return (
      <div
        key={c.id}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-3xl font-bold text-white">{c.title}</h3>
          <span className={`shrink-0 rounded-full px-4 py-1.5 text-base font-semibold ${chip}`}>
            {chipLabel}
          </span>
        </div>
        <p className="mt-2 text-base text-slate-400">
          {c.start_date} ~ {c.end_date}
          {c.status !== "approved" && (
            <span className="ml-3 text-lg text-slate-200">
              {c.status === "late" ? "已超時" : `剩餘 ${left} 日`}
            </span>
          )}
          {c.status === "approved" && (
            <span className="ml-3 text-lg text-sky-300">{daysBetween(today, c.start_date)} 日後開始</span>
          )}
        </p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-base text-slate-400">
          <span>
            任務進度{" "}
            <span className="text-lg font-semibold text-slate-200">
              {task ? `${task.done}/${task.total}` : "0/0"}
            </span>
          </span>
          {members.length > 0 && (
            <span className="truncate">成員：{members.join("、")}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#020617] px-8 py-6 text-slate-100">
      <AutoRefresh seconds={60} />
      {/* 頂部：隊名＋比賽倒數｜大時鐘 */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tight text-white">
            {teamName || "ROV 隊"}
          </h1>
          <p className="mt-1 text-base text-slate-500">團隊看板 · 每分鐘自動更新</p>
          {compDays !== null && (
            <p className="mt-2 inline-block rounded-full bg-rose-500/15 px-5 py-1.5 text-xl font-bold text-rose-300">
              距比賽 {compDays} 日
            </p>
          )}
        </div>
        <div className="flex items-end gap-4">
          <FullscreenButton />
          <Clock />
        </div>
      </header>

      {/* 週期：雙列大卡 */}
      <section className="mt-6">
        {late.length > 0 && (
          <>
            <h2 className="text-2xl font-bold text-rose-300">⚠ 遲交（{late.length}）</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 2xl:grid-cols-2">
              {late.map(cycleCard)}
            </div>
          </>
        )}
        <h2 className="text-2xl font-bold text-slate-300">
          進行中（{active.length}）
        </h2>
        {active.length === 0 && late.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center text-xl text-slate-500">
            目前沒有進行中的週期
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 2xl:grid-cols-2">
            {active.map(cycleCard)}
          </div>
        )}
        {upcoming.length > 0 && (
          <>
            <h2 className="mt-5 text-2xl font-bold text-slate-400">
              即將開始（{upcoming.length}）
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-4 2xl:grid-cols-2">
              {upcoming.map(cycleCard)}
            </div>
          </>
        )}
      </section>

      {/* 未來兩週重點（大字清單） */}
      {agenda.size > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-2xl font-bold text-slate-300">未來兩週重點</h2>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {[...agenda.entries()].map(([date, items]) => (
              <div
                key={date}
                className={`flex items-baseline gap-2 ${
                  date === today ? "text-cyan-300" : "text-slate-300"
                }`}
              >
                <span className="text-xl font-bold">
                  {Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}
                </span>
                <span className="text-sm text-slate-500">{weekdayZh(date)}</span>
                {items.map((e) => (
                  <span key={e.id} className="flex items-center gap-1.5 text-lg text-white">
                    <span className={`h-2 w-2 rounded-full ${TYPE_DOT[e.type] ?? TYPE_DOT.other}`} />
                    {e.title}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 本月日曆（圖像化，可翻月） */}
      <div className="mt-6">
        <MonthCalendar events={eventList} tasks={taskDue} />
      </div>
    </main>
  );
}
