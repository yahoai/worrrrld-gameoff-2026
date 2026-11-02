import { LOCALES, type Locale } from "./config";

/** Standalone build: picks the browser language. worrrrld.com supplies its own provider. */
export function useI18n(): { locale: Locale } {
  const lang = navigator.language.slice(0, 2) as Locale;
  return { locale: LOCALES.includes(lang) ? lang : "en" };
}
