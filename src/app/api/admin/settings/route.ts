import { NextRequest, NextResponse } from "next/server";
import db, { getOrCreateIcalToken, getSettingValue, setSetting } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (user.role !== "leader") {
    return NextResponse.json({ error: "只有隊長可以查看設定" }, { status: 403 });
  }
  return NextResponse.json({
    team_name: getSettingValue("team_name") ?? "ROV 隊",
    competition_date: getSettingValue("competition_date") || null,
    discord_webhook: getSettingValue("discord_webhook") ?? "",
    ical_token: getOrCreateIcalToken(),
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (user.role !== "leader") {
    return NextResponse.json({ error: "只有隊長可以修改設定" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    team_name?: string;
    competition_date?: string | null;
    discord_webhook?: string;
  } | null;
  if (body?.team_name !== undefined) {
    const name = String(body.team_name).trim();
    if (!name) return NextResponse.json({ error: "隊名不可空白" }, { status: 400 });
    setSetting("team_name", name);
  }
  if (body?.competition_date !== undefined) {
    setSetting("competition_date", body.competition_date || "");
  }
  if (body?.discord_webhook !== undefined) {
    setSetting("discord_webhook", String(body.discord_webhook).trim());
  }
  return NextResponse.json({
    team_name: getSettingValue("team_name"),
    competition_date: getSettingValue("competition_date") || null,
    discord_webhook: getSettingValue("discord_webhook") ?? "",
    ical_token: getOrCreateIcalToken(),
  });
}

// 保留 db 引用，避免某些打包情境下 tree-shake 掉 schema 初始化
void db;
