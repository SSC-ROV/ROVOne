import { sql } from "./pg";

/** 審計日誌：記錄關鍵寫操作（誰、何時、做了什麼） */
export async function logAudit(
  userId: number | null,
  userName: string,
  action: string,
  target = "",
  detail = ""
) {
  try {
    await sql`
      INSERT INTO audit_log (user_id, user_name, action, target, detail)
      VALUES (${userId}, ${userName || ""}, ${action}, ${target}, ${detail})`;
  } catch {
    /* 審計失敗不影響主流程 */
  }
}
