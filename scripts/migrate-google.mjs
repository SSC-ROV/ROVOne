// 一次性遷移（2026-09-07 Google 登入）：users 加 email / login_method
// 執行：node --env-file=.env.local scripts/migrate-google.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });

await sql.unsafe(`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS login_method TEXT NOT NULL DEFAULT 'password';
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
`);
console.log("遷移完成：users.email / login_method 已建立");

// 預設網域白名單（使用者可之後在管理頁修改）
await sql.unsafe(`
  INSERT INTO settings (key, value) VALUES ('google_domains', 'stu.ssc.edu.hk,ssc.edu.hk')
  ON CONFLICT (key) DO NOTHING;
`);
console.log("預設 google_domains 已寫入設定");

await sql.end();
