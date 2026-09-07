/** i18n 核心（純函數，伺服器與客戶端共用） */

export type Lang = "zh" | "en";

// 目前語言（客戶端由 Provider 同步；元件藉 useI18n 訂閱重新渲染）
let _lang: Lang = "zh";
export function setLangProxy(l: Lang) {
  _lang = l;
}
export function getLangProxy(): Lang {
  return _lang;
}

/** 依目前語言選字（含中英對照的字條） */
export function tt(zh: string, en: string): string {
  return _lang === "zh" ? zh : en;
}
