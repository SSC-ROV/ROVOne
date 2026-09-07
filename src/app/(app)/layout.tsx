import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import Navbar from "@/components/Navbar";
import type { Me } from "@/lib/types";
import DialogProvider from "@/components/ui/Dialogs";
import PasswordChangedGuard from "@/components/PasswordChangedGuard";

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
      <div className="flex min-h-screen flex-col">
        <Navbar user={user as Me} teamName={settings.team_name} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </DialogProvider>
  );
}
