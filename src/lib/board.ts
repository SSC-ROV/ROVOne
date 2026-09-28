import { sql } from "./pg";
import { getSettingValue } from "./db";

/** 香港時區今天（YYYY-MM-DD），與全站日期口徑一致 */
export function hkToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

export type BoardCycle = {
  id: number; title: string; start_date: string; end_date: string;
  status: string; proposer_name: string | null;
  done: number; total: number; members: string[];
};
export type BoardEvent = {
  id: number; title: string; type: string; date: string;
  time: string | null; location: string | null;
};
export type BoardTask = { title: string; cycle_title: string; due_date: string };
export type BoardData = {
  teamName: string; competitionDate: string | null; today: string;
  cycles: BoardCycle[]; events: BoardEvent[]; tasksDue: BoardTask[];
};

/** 看板全部資料（/display 初始渲染與 /api/display 輪詢共用同一份查詢） */
export async function getBoardData(): Promise<BoardData> {
  const today = hkToday();

  // 與週期頁一致：已核准的週期到了開始日 → 自動轉為進行中
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

  const rows = await sql`
    SELECT c.id, c.title, c.start_date, c.end_date, c.status,
           u.display_name AS proposer_name
    FROM cycles c LEFT JOIN users u ON u.id = c.proposer_id
    WHERE c.status IN ('active', 'late')
       OR (c.status = 'approved' AND c.start_date > ${today})
    ORDER BY CASE c.status WHEN 'late' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
             c.end_date`;

  const ids = (rows as unknown as { id: number }[]).map((r) => Number(r.id));
  const taskAggs: { cycle_id: number; total: number; done: number }[] = ids.length
    ? await sql`SELECT cycle_id, COUNT(*)::int AS total,
                       COUNT(*) FILTER (WHERE status = 'done')::int AS done
                FROM tasks WHERE cycle_id = ANY(${ids}) GROUP BY cycle_id`
    : [];
  const memberRows: { cycle_id: number; display_name: string }[] = ids.length
    ? await sql`SELECT cm.cycle_id, u.display_name
                FROM cycle_members cm JOIN users u ON u.id = cm.user_id
                WHERE cm.cycle_id = ANY(${ids}) ORDER BY cm.cycle_id, u.id`
    : [];

  const taskMap = new Map(taskAggs.map((t) => [Number(t.cycle_id), t]));
  const memberMap = new Map<number, string[]>();
  for (const m of memberRows) {
    const k = Number(m.cycle_id);
    (memberMap.get(k) ?? memberMap.set(k, []).get(k)!).push(String(m.display_name));
  }

  const cycles: BoardCycle[] = (rows as unknown as Omit<BoardCycle, "done" | "total" | "members">[]).map(
    (c) => {
      const t = taskMap.get(Number(c.id));
      return {
        ...c,
        id: Number(c.id),
        done: t ? t.done : 0,
        total: t ? t.total : 0,
        members: memberMap.get(Number(c.id)) ?? [],
      };
    }
  );

  const events: BoardEvent[] = await sql`
    SELECT id, title, type, date, time, location
    FROM events WHERE date >= ${calFrom} AND date <= ${calTo}
    ORDER BY date, time NULLS LAST, id`;

  const tasksDue: BoardTask[] = await sql`
    SELECT t.title, c.title AS cycle_title, t.due_date
    FROM tasks t JOIN cycles c ON c.id = t.cycle_id
    WHERE t.due_date IS NOT NULL AND t.due_date >= ${calFrom} AND t.due_date <= ${calTo}
      AND t.status <> 'done'
    ORDER BY t.due_date, t.id`;

  return {
    teamName: teamName || "ROV 隊",
    competitionDate: competitionDate || null,
    today,
    cycles,
    events: (events as unknown as BoardEvent[]).map((e) => ({ ...e, id: Number(e.id) })),
    tasksDue,
  };
}
