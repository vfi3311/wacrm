export const SUPPORTED_LOCALES = ['en', 'es', 'ko', 'pt'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE_NAME = 'wacrm_locale';

export function isLocale(value: string | undefined): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}
