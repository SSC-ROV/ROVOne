"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { setLangProxy, type Lang } from "./i18n-core";
import { DICT } from "./i18n-dict";

type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** 中文 → 目前語言（en 時查字典，查不到就回中文） */
  t: (zh: string) => string;
};

const Ctx = createContext<I18n | null>(null);

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Saved choice only. URL params are already copied into localStorage by the boot script. */
function readSavedLang(): Lang | null {
  try {
    const saved = localStorage.getItem("rov_lang");
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    /* ignore */
  }
  const cookie = readCookie("rov_lang");
  if (cookie === "en" || cookie === "zh") return cookie;
  return null;
}

function applyStoredTheme() {
  try {
    const saved = localStorage.getItem("rov_theme");
    const theme = saved === "light" || saved === "dark" ? saved : "dark";
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  } catch {
    /* ignore */
  }
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n 必須在 I18nProvider 內使用");
  return v;
}

function persistLang(next: Lang) {
  setLangProxy(next);
  const root = document.documentElement;
  root.lang = next === "zh" ? "zh-Hant" : "en";
  root.dataset.lang = next;
  try {
    localStorage.setItem("rov_lang", next);
    document.cookie = `rov_lang=${next}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* 忽略 */
  }
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  // SSR and the first client render stay "en" so hydration matches the boot script.
  // A saved rov_lang / cookie is applied after mount. Nothing is written until the user changes language.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    applyStoredTheme();
    const saved = readSavedLang();
    if (saved) {
      setLangProxy(saved);
      if (saved !== "en") setLangState(saved);
      return;
    }
    setLangProxy("en");
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    persistLang(next);
  }, []);

  const t = useCallback(
    (zh: string) => (lang === "zh" ? zh : (DICT[zh] ?? zh)),
    [lang]
  );

  const value: I18n = {
    lang,
    setLang,
    toggle: () => setLang(lang === "zh" ? "en" : "zh"),
    t,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
