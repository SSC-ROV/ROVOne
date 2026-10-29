import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import Navbar from "@/components/Navbar";
import type { Me } from "@/lib/types";
import DialogProvider from "@/components/ui/Dialogs";
import PasswordChangedGuard from "@/components/PasswordChangedGuard";
import CommandPalette from "@/components/CommandPalette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const settings = await getSettings();
  return (
    <DialogProvider>
      <PasswordChangedGuard />
      <CommandPalette />
      <Navbar user={user as Me} teamName={settings.team_name}>
        {children}
      </Navbar>
    </DialogProvider>
  );
}
