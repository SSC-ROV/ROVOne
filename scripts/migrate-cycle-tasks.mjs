// 任務完全歸屬開發週期：無週期的任務併入最近的進行中/已核准週期；清理測試週期
// 執行：node --env-file=.env.local scripts/migrate-cycle-tasks.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });

// 清掉先前測試留下的週期
await sql`DELETE FROM cycles WHERE title LIKE '診斷%' OR title LIKE '遲交流程測試%'`;

const [active] = await sql`
  SELECT id FROM cycles WHERE status IN ('active', 'approved')
  ORDER BY id DESC LIMIT 1`;
const [fallback] = await sql`
  SELECT id FROM cycles WHERE status NOT IN ('rejected', 'completed')
  ORDER BY id DESC LIMIT 1`;
const target = active?.id ?? fallback?.id ?? null;

if (target) {
  const r = await sql`
    UPDATE tasks SET cycle_id = ${target} WHERE cycle_id IS NULL`;
  console.log(`已將 ${r.count} 筆無週期任務併入週 #${target}`);
} else {
  console.log("目前沒有可用週期，未歸屬任務保留（請先在週期頁提案）");
}

await sql.end();
console.log("遷移完成");
