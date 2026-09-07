// 移除比賽任務功能：刪除 mission_tasks 表與 tasks.mission_id 欄位
// 執行：node --env-file=.env.local scripts/migrate-remove-missions.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });

await sql.unsafe(`
  ALTER TABLE tasks DROP COLUMN IF EXISTS mission_id;
  DROP TABLE IF EXISTS mission_tasks;
  DELETE FROM audit_log WHERE action LIKE 'mission.%';
`);
console.log("遷移完成：mission_tasks 表與 tasks.mission_id 已移除");
await sql.end();
