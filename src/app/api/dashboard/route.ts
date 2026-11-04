import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteDashboardLayout, getDashboardLayout, saveDashboardLayout } from "@/lib/dashboard-db";
import { sanitizeLayout } from "@/lib/dashboard/catalog";

/** The signed-in person's own dashboard layout (null until they customize it). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  return NextResponse.json({ layout: await getDashboardLayout(user.id) });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { layout?: unknown } | null;
  const layout = sanitizeLayout(body?.layout);
  if (!layout) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  await saveDashboardLayout(user.id, layout);
  return NextResponse.json({ layout });
}

/** Forget the saved layout, so the default template shows again. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  await deleteDashboardLayout(user.id);
  return NextResponse.json({ ok: true });
}
