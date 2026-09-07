"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** 強制改密碼閘門：首登（或密碼被重設）未改密時，跳轉到「帳號」頁 */
export default function PasswordChangedGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/login" || pathname === "/account") return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user && !d.user.password_changed_at) {
          router.replace("/account?force=1");
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  return null;
}
