export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000); // 10 秒逾時：避免無限「載入中」
  try {
    const res = await fetch(url, {
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      signal: controller.signal,
      ...init,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(
        (body as { error?: string }).error || `發生錯誤（HTTP ${res.status}）`
      ) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return res.json() as Promise<T>;
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("載入逾時，請檢查網路後重新整理");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
