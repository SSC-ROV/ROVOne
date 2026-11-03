import crypto from "crypto";
import { after } from "next/server";
import { sql } from "./pg";
import { notifyTeams } from "./notify";
import { pushToUsers, roleUserIds } from "./push";

export type NewPartRequest = {
  name: string;
  spec?: string;
  link?: string;
  qty?: number;
  unit?: string;
  est_price?: number;
  purpose?: string;
  subteam?: string;
};

/**
 * 建立一筆待審批的零件／採購申請，並在背景通知老師（Teams + 推播）。
 * 「採購申請」頁與庫存「回報沒有了」自動補貨共用。
 */
export async function createPartRequest(
  input: NewPartRequest,
  user: { id: number; display_name: string },
  origin: string
): Promise<number> {
  const name = input.name.trim();
  const qty = Math.max(1, Number(input.qty) || 1);
  const est = Math.max(0, Number(input.est_price) || 0);
  const token = crypto.randomUUID().replace(/-/g, "");
  const [row] = await sql`
    INSERT INTO parts (name, spec, link, qty, unit, est_price, purpose, subteam, status, requested_by, approve_token, approve_expires_at)
    VALUES (${name}, ${String(input.spec ?? "")}, ${String(input.link ?? "")},
            ${qty}, ${String(input.unit ?? "個")},
            ${est}, ${String(input.purpose ?? "")},
            ${String(input.subteam ?? "general")}, 'pending', ${user.id}, ${token},
            now() + interval '72 hours')
    RETURNING id`;
  after(() => notifyTeams("teacher_parts",
    `🛒 新零件申請「${name}」待批准`,
    `申請人：${user.display_name}｜數量：${qty}｜預估：$${est}`,
    `${origin}/approve/${token}`));
  after(async () => {
    const teachers = await roleUserIds("teacher");
    await pushToUsers(teachers,
      "🛒 有一份新的零件需求待批准",
      `「${name}」× ${qty}（預估 $${est}）由 ${user.display_name} 提出`,
      "/parts", user.id);
  });
  return Number(row.id);
}
