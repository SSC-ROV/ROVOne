// 一次性遷移：push_tokens 表（APNs 設備令牌 → 用戶）
import postgres from "postgres";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL="?(.+?)"?$/m)?.[1];
const sql = postgres(url, { prepare: false, max: 1 });
await sql`CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens(user_id)`;
const t = await sql`SELECT COUNT(*)::int AS n FROM push_tokens`;
console.log("push_tokens 準備完成，目前行數:", t[0].n);
await sql.end();
