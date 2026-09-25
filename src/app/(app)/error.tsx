"use client";

import { useEffect } from "react";

/** (app) 群組的錯誤邊界：任何頁面渲染崩潰都顯示這個可復原的頁面，而不是 Next 預設白屏 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-4xl">🛠️</p>
      <h1 className="text-lg font-bold text-ink">
        頁面出錯了 / Something went wrong
      </h1>
      <p className="max-w-md text-sm text-ink-subtle">
        載入這個頁面時發生錯誤，請重試；若持續失敗請告訴隊長或老師。
        <br />
        An error occurred while loading this page. Please try again.
      </p>
      {error.digest && (
        <p className="text-xs text-ink-tertiary">錯誤代碼：{error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          重試 / Retry
        </button>
        <button
          onClick={() => (window.location.href = "/")}
          className="rounded-lg border border-hairline-strong px-4 py-2 text-sm text-ink-muted transition hover:border-hairline-strong"
        >
          回首頁 / Home
        </button>
      </div>
    </div>
  );
}
