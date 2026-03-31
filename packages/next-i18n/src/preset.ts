/** Общие настройки локалей для next-intl `defineRouting` (без зависимости от next-intl в сборке пакета). */
export const spektorsI18nPreset = {
  locales: ["ru", "en", "nl"],
  defaultLocale: "ru",
  localePrefix: "as-needed" as const,
};
