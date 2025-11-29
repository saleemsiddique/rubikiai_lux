export const locales = ['lt', 'en', 'ru'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'lt';

export const localeNames: Record<Locale, string> = {
  lt: 'Lietuvių',
  en: 'English',
  ru: 'Русский',
};
