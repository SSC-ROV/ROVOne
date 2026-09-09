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

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n 必須在 I18nProvider 內使用");
  return v;
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  // 初值固定 "zh"（與 SSR 一致，避免水合不匹配）；掛載後才讀 localStorage／瀏覽器語言再切換
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("rov_lang");
    const initial: Lang =
      saved === "en" || saved === "zh"
        ? saved
        : (navigator.language || "").toLowerCase().startsWith("en")
          ? "en"
          : "zh";
    setLangState(initial);
  }, []);

  useEffect(() => {
    setLangProxy(lang);
    localStorage.setItem("rov_lang", lang);
    try {
      document.cookie = `rov_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* 忽略 */
    }
  }, [lang]);

  const t = useCallback(
    (zh: string) => (lang === "zh" ? zh : (DICT[zh] ?? zh)),
    [lang]
  );

  const value: I18n = {
    lang,
    setLang: setLangState,
    toggle: () => setLangState((l) => (l === "zh" ? "en" : "zh")),
    t,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
