export const LOCALES = ["en", "ko", "ja", "zh", "es", "pt", "fr", "de"] as const;
export type Locale = (typeof LOCALES)[number];
