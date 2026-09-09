import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateIcalToken, getSettingValue, getSubteams, setSetting } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { logAudit } from "@/lib/audit";

async function currentSettings() {
  return {
    team_name: (await getSettingValue("team_name")) ?? "ROV 隊",
    competition_date: (await getSettingValue("competition_date")) || null,
    discord_webhook: (await getSettingValue("discord_webhook")) ?? "",
    ical_token: await getOrCreateIcalToken(),
    google_client_id: (await getSettingValue("google_client_id")) ?? "",
    google_client_secret: (await getSettingValue("google_client_secret")) ?? "",
    google_domains: (await getSettingValue("google_domains")) ?? "",
    google_leader_emails: (await getSettingValue("google_leader_emails")) ?? "",
    google_teacher_emails: (await getSettingValue("google_teacher_emails")) ?? "",
    discord_webhook_cycle_audit: (await getSettingValue("discord_webhook_cycle_audit")) ?? "",
    discord_webhook_cycle_progress: (await getSettingValue("discord_webhook_cycle_progress")) ?? "",
    discord_webhook_parts: (await getSettingValue("discord_webhook_parts")) ?? "",
    discord_webhook_members: (await getSettingValue("discord_webhook_members")) ?? "",
    teams_webhook_teacher_cycle: (await getSettingValue("teams_webhook_teacher_cycle")) ?? "",
    teams_webhook_leader_cycle: (await getSettingValue("teams_webhook_leader_cycle")) ?? "",
    teams_webhook_teacher_parts: (await getSettingValue("teams_webhook_teacher_parts")) ?? "",
    subteams: await getSubteams(),
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以查看設定" }, { status: 403 });
  }
  return NextResponse.json(await currentSettings());
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以修改設定" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });

  if (body.team_name !== undefined) {
    const name = String(body.team_name).trim();
    if (!name) return NextResponse.json({ error: "隊名不可空白" }, { status: 400 });
    await setSetting("team_name", name);
  }
  if (body.competition_date !== undefined) {
    await setSetting("competition_date", body.competition_date ? String(body.competition_date) : "");
  }
  if (body.discord_webhook !== undefined) {
    await setSetting("discord_webhook", String(body.discord_webhook).trim());
  }
  if (body.rotate_ical === true) {
    await setSetting("ical_token", crypto.randomBytes(16).toString("hex"));
    await logAudit(user.id, user.username, "ical.rotate", "");
  }
  for (const key of [
    "discord_webhook_cycle_audit",
    "discord_webhook_cycle_progress",
    "discord_webhook_parts",
    "discord_webhook_members",
    "teams_webhook_teacher_cycle",
    "teams_webhook_leader_cycle",
    "teams_webhook_teacher_parts",
  ] as const) {
    if (body?.[key] !== undefined) {
      await setSetting(key, String(body[key]).trim());
    }
  }
  for (const key of [
    "google_client_id",
    "google_client_secret",
    "google_domains",
    "google_leader_emails",
    "google_teacher_emails",
  ] as const) {
    if (body[key] !== undefined) {
      await setSetting(key, String(body[key]).trim());
    }
  }
  await logAudit(user.id, user.username, "settings.update", "", Object.keys(body).join(","));
  return NextResponse.json(await currentSettings());
}
