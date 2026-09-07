// 自訂組別 + 活動組別欄位
// 執行：node --env-file=.env.local scripts/migrate-subteams.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });

await sql.unsafe(`
  ALTER TABLE events ADD COLUMN IF NOT EXISTS subteam TEXT;
  INSERT INTO settings (key, value) VALUES ('subteams', '[{"key":"mech","zh":"機械","en":"Mechanical"},{"key":"elec","zh":"電控","en":"Electronics"},{"key":"sw","zh":"軟體","en":"Software"},{"key":"pilot","zh":"操控","en":"Pilot"},{"key":"general","zh":"全隊","en":"Team"}]')
  ON CONFLICT (key) DO NOTHING;
`);
console.log("遷移完成：events.subteam 欄位 + 預設自訂組別清單已寫入");
await sql.end();
