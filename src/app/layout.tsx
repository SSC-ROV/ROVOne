import type { Metadata, Viewport } from "next";
import "./globals.css";
import I18nProvider from "@/lib/i18n";
import SubteamsProvider from "@/lib/subteams";
import { Figtree, Poppins } from "next/font/google";
import { cn } from "@/lib/utils";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://iengineer.cc.cd"),
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
  viewportFit: "cover",
};

/** Runs before paint. URL params win and are stored; otherwise keep localStorage / rov_lang cookie; otherwise dark + English. */
const THEME_LANG_BOOT = `(function(){var root=document.documentElement;try{var p=new URLSearchParams(location.search);var t=p.get("theme");if(t==="dark"||t==="light")localStorage.setItem("rov_theme",t);var l=p.get("lang");if(l==="en"||l==="zh")localStorage.setItem("rov_lang",l);t=localStorage.getItem("rov_theme");if(t!=="dark"&&t!=="light")t="dark";root.dataset.theme=t;root.classList.toggle("dark",t==="dark");root.style.colorScheme=t;l=localStorage.getItem("rov_lang");if(l!=="en"&&l!=="zh"){var m=document.cookie.match(/(?:^|; )rov_lang=([^;]*)/);l=m?decodeURIComponent(m[1]):"";}if(l!=="en"&&l!=="zh")l="en";root.lang=l==="zh"?"zh-Hant":"en";root.dataset.lang=l;}catch(e){root.dataset.theme="dark";root.classList.add("dark");root.lang="en";root.dataset.lang="en";root.style.colorScheme="dark";}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-lang="en"
      className={cn("dark h-full antialiased font-sans", figtree.variable, poppins.variable)}
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_LANG_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider><SubteamsProvider>{children}</SubteamsProvider></I18nProvider>
      </body>
    </html>
  );
}
