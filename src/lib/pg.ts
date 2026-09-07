import postgres from "postgres";

// Supabase transaction pooler（連接池）不支援 prepared statements，必須關閉
// 多連接 + 超時參數：避免單一連接被池端「半開」後所有查詢永久排隊（會讓全站卡在載入中）
export const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 4,
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30, // pooler 端半小時輪換連接，與之對齊
  ssl: "require",
});
