import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateDisplayToken } from "@/lib/db";
import { getBoardData } from "@/lib/board";
import DisplayBoard from "./DisplayBoard";

export const dynamic = "force-dynamic";

export default async function DisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 授權：看板連結令牌 或 已登入用戶
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const displayToken = await getOrCreateDisplayToken();
  if (token !== displayToken) {
    const user = await getSessionUser();
    if (!user) redirect("/login");
  }

  const initial = await getBoardData();
  return <DisplayBoard token={displayToken} initial={initial} />;
}
