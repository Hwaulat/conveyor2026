import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, type Dict } from "./i18n-dict";

export type Lang = "id" | "en";

const LANG_KEY = "jsgi.lang";

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof Dict | (string & {}), vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[lang] as Record<string, string>;
  let text = dict[key] ?? (dictionaries.en as Record<string, string>)[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    const stored = window.localStorage.getItem(LANG_KEY);
    if (stored === "en" || stored === "id") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(LANG_KEY, l);
  };

  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
