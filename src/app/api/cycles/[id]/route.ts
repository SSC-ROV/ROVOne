import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { notifyDiscord } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

type CycleRow = {
  id: number;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  description: string;
  proposer_id: number | null;
};

async function load(id: number): Promise<CycleRow | undefined> {
  const [row] = await sql`SELECT * FROM cycles WHERE id = ${id}`;
  return row as CycleRow | undefined;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const cycle = await load(Number(id));
  if (!cycle) return NextResponse.json({ error: "週期不存在" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    note?: string;
    title?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    member_ids?: number[];
  } | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });

  // ── 審批動作 ──
  if (body.action === "approve" || body.action === "reject") {
    if (!isStaff(user.role)) {
      return NextResponse.json({ error: "只有隊長或老師可以審批" }, { status: 403 });
    }
  }
  if (body.action === "approve") {
    if (cycle.status === "pending_leader") {
      // 老師是最終審批者，可直接生效；隊長核准後升級待老師審批
      const next = user.role === "teacher" ? "active" : "pending_teacher";
      await sql`
        UPDATE cycles SET status = ${next}, decided_by = ${user.id},
               decided_note = ${String(body.note ?? "").trim()}
        WHERE id = ${cycle.id}`;
      await logAudit(user.id, user.username, "cycle.approve", `cycle:${cycle.id}`, `${cycle.title} → ${next}`);
      await notifyDiscord(
        next === "active"
          ? `✅ 老師核准開發週期：「${cycle.title}」，已開始！`
          : `✅ 隊長核准開發週期：「${cycle.title}」，待老師最終審批`
      );
      return NextResponse.json({ ok: true, status: next });
    }
    if (cycle.status === "pending_teacher") {
      if (user.role !== "teacher") {
        return NextResponse.json({ error: "這一關要由老師審批" }, { status: 403 });
      }
      await sql`
        UPDATE cycles SET status = 'active', decided_by = ${user.id},
               decided_note = ${String(body.note ?? "").trim()}
        WHERE id = ${cycle.id}`;
      await logAudit(user.id, user.username, "cycle.approve", `cycle:${cycle.id}`, `${cycle.title} → active`);
      await notifyDiscord(`✅ 老師核准開發週期：「${cycle.title}」，已開始！`);
      return NextResponse.json({ ok: true, status: "active" });
    }
    return NextResponse.json({ error: "這個狀態不能審批" }, { status: 400 });
  }

  if (body.action === "reject") {
    if (!isStaff(user.role)) {
      return NextResponse.json({ error: "只有隊長或老師可以駁回" }, { status: 403 });
    }
    if (cycle.status === "pending_teacher" && user.role !== "teacher") {
      return NextResponse.json({ error: "這一關要由老師審批" }, { status: 403 });
    }
    if (cycle.status !== "pending_leader" && cycle.status !== "pending_teacher") {
      return NextResponse.json({ error: "這個狀態不能駁回" }, { status: 400 });
    }
    await sql`
      UPDATE cycles SET status = 'rejected', decided_by = ${user.id},
             decided_note = ${String(body.note ?? "").trim()}
      WHERE id = ${cycle.id}`;
    await logAudit(user.id, user.username, "cycle.reject", `cycle:${cycle.id}`, cycle.title);
    await notifyDiscord(
      `❌ 開發週期「${cycle.title}」被駁回${body.note ? `— 備註：${body.note}` : ""}`
    );
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (body.action === "complete") {
    if (cycle.status !== "active") {
      return NextResponse.json({ error: "只有進行中的週期可以標記完成" }, { status: 400 });
    }
    if (!isStaff(user.role) && cycle.proposer_id !== user.id) {
      return NextResponse.json({ error: "只有提案人或幹部可以標記完成" }, { status: 403 });
    }
    await sql`
      UPDATE cycles SET status = 'completed', completed_at = ${new Date().toISOString()}
      WHERE id = ${cycle.id}`;
    await logAudit(user.id, user.username, "cycle.complete", `cycle:${cycle.id}`, cycle.title);
    await notifyDiscord(`🏁 開發週期「${cycle.title}」已完成！`);
    return NextResponse.json({ ok: true, status: "completed" });
  }

  if (body.action === "resubmit") {
    if (cycle.status !== "rejected") {
      return NextResponse.json({ error: "只有被駁回的週期可以重新提交" }, { status: 400 });
    }
    if (cycle.proposer_id !== user.id) {
      return NextResponse.json({ error: "只有提案人可以重新提交" }, { status: 403 });
    }
    const next = isStaff(user.role) ? "pending_teacher" : "pending_leader";
    await sql`UPDATE cycles SET status = ${next}, decided_note = '' WHERE id = ${cycle.id}`;
    await notifyDiscord(
      `🔄 開發週期「${cycle.title}」重新提交${next === "pending_teacher" ? "，待老師審批" : "，待隊長審批"}`
    );
    return NextResponse.json({ ok: true, status: next });
  }

  // ── 編輯內容（提案人限定；審批中或被駁回時）──
  if (cycle.proposer_id !== user.id && !isStaff(user.role)) {
    return NextResponse.json({ error: "只有提案人可以編輯" }, { status: 403 });
  }
  if (cycle.status === "active" || cycle.status === "completed") {
    return NextResponse.json({ error: "已開始或已完成的週期不可編輯內容" }, { status: 400 });
  }
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "名稱不可空白" }, { status: 400 });
    await sql`UPDATE cycles SET title = ${title} WHERE id = ${cycle.id}`;
  }
  if (body.description !== undefined) {
    await sql`UPDATE cycles SET description = ${String(body.description)} WHERE id = ${cycle.id}`;
  }
  const start = body.start_date !== undefined ? String(body.start_date) : cycle.start_date;
  const end = body.end_date !== undefined ? String(body.end_date) : cycle.end_date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    return NextResponse.json({ error: "日期格式或範圍不正確" }, { status: 400 });
  }
  await sql`UPDATE cycles SET start_date = ${start}, end_date = ${end} WHERE id = ${cycle.id}`;
  if (body.member_ids !== undefined) {
    await sql`DELETE FROM cycle_members WHERE cycle_id = ${cycle.id} AND user_id IS DISTINCT FROM ${cycle.proposer_id}`;
    for (const mid of body.member_ids) {
      const n = Number(mid);
      if (n && n !== cycle.proposer_id && (await sql`SELECT 1 FROM users WHERE id = ${n}`).length) {
        await sql`INSERT INTO cycle_members (cycle_id, user_id) VALUES (${cycle.id}, ${n}) ON CONFLICT DO NOTHING`;
      }
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const cycle = await load(Number(id));
  if (!cycle) return NextResponse.json({ error: "週期不存在" }, { status: 404 });
  const ownerPending =
    cycle.proposer_id === user.id &&
    ["pending_leader", "pending_teacher", "rejected"].includes(cycle.status);
  if (!isStaff(user.role) && !ownerPending) {
    return NextResponse.json(
      { error: "只有隊長／老師可以刪除；提案人只能刪除自己審批中的提案" },
      { status: 403 }
    );
  }
  await sql`DELETE FROM cycles WHERE id = ${cycle.id}`;
  return NextResponse.json({ ok: true });
}
