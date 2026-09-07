import postgres from "postgres";

// Supabase transaction pooler（連接池）不支援 prepared statements，必須關閉
export const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 1,
  ssl: "require",
});
