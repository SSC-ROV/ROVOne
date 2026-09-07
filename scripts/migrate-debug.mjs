// Debug 清單相關資料庫遷移（2026-09-07）
// 執行：node --env-file=.env.local scripts/migrate-debug.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });

await sql.unsafe(`
  -- 強制首登改密碼（既有帳號視為已改過）
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
  UPDATE users SET password_changed_at = now() WHERE password_changed_at IS NULL;

  -- 審批連結 72 小時過期
  ALTER TABLE parts ADD COLUMN IF NOT EXISTS approve_expires_at TIMESTAMPTZ;
  UPDATE parts SET approve_expires_at = now() + interval '72 hours'
    WHERE approve_expires_at IS NULL AND status = 'pending';

  -- 任務樂觀鎖
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

  -- 登入失敗計數（限流）
  CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGSERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    count INTEGER NOT NULL DEFAULT 1,
    blocked_until TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(identifier, window_start);

  -- 審計日誌
  CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at DESC);
`);
console.log("遷移完成：password_changed_at / login_attempts / audit_log / approve_expires_at / tasks.version");
await sql.end();
