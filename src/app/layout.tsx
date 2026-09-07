import type { Metadata } from "next";
import "./globals.css";
import I18nProvider from "@/lib/i18n";

export const metadata: Metadata = {
  title: "ROV 隊伍任務平台",
  description: "ROV 團隊的任務看板、時間規劃與任務日曆",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
