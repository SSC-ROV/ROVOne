import { NextRequest, NextResponse } from "next/server";
import { getOrCreateIcalToken, getSettingValue, setSetting } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

async function currentSettings() {
  return {
    team_name: (await getSettingValue("team_name")) ?? "ROV 隊",
    competition_date: (await getSettingValue("competition_date")) || null,
    discord_webhook: (await getSettingValue("discord_webhook")) ?? "",
    ical_token: await getOrCreateIcalToken(),
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
  const body = (await req.json().catch(() => null)) as {
    team_name?: string;
    competition_date?: string | null;
    discord_webhook?: string;
  } | null;
  if (body?.team_name !== undefined) {
    const name = String(body.team_name).trim();
    if (!name) return NextResponse.json({ error: "隊名不可空白" }, { status: 400 });
    await setSetting("team_name", name);
  }
  if (body?.competition_date !== undefined) {
    await setSetting("competition_date", body.competition_date || "");
  }
  if (body?.discord_webhook !== undefined) {
    await setSetting("discord_webhook", String(body.discord_webhook).trim());
  }
  return NextResponse.json(await currentSettings());
}
