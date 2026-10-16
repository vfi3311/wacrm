import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE_NAME } from '@/lib/i18n';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const configuredLocale = process.env.NEXT_PUBLIC_APP_LOCALE;
  const locale = isLocale(savedLocale)
    ? savedLocale
    : isLocale(configuredLocale)
      ? configuredLocale
      : DEFAULT_LOCALE;
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
