import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import Navbar from "@/components/Navbar";
import DialogProvider from "@/components/ui/Dialogs";

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
      <div className="flex min-h-screen flex-col">
        <Navbar user={user} teamName={settings.team_name} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </DialogProvider>
  );
}
