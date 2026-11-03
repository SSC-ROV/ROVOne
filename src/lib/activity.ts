import { sql } from "@/lib/pg";

export type ActivityKind = "comment" | "status" | "assignee" | "priority" | "due_date" | "start_date" | "project" | "title";

/** Record a task change in its timeline. Failures are swallowed so they never block the change itself. */
export async function logActivity(taskId: number, userId: number | null, kind: ActivityKind, meta: Record<string, unknown> = {}, body = "") {
  try {
    await sql`
      INSERT INTO task_activity (task_id, user_id, kind, body, meta)
      VALUES (${taskId}, ${userId}, ${kind}, ${body}, ${sql.json(meta as never)})`;
  } catch {
    /* timeline is best effort */
  }
}
