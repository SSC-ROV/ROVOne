import type { Metadata, Viewport } from "next";
import "./globals.css";
import I18nProvider from "@/lib/i18n";
import SubteamsProvider from "@/lib/subteams";

export const metadata: Metadata = {
  title: "ROV 隊伍任務平台",
  description: "ROV 團隊的開發週期、任務追蹤、時間規劃與裝備管理",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ROV Hub",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("rov_theme");if(t!=="dark"&&t!=="light"){t="light";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider><SubteamsProvider>{children}</SubteamsProvider></I18nProvider>
      </body>
    </html>
  );
}
