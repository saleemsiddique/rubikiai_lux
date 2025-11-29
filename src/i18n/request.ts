import { getRequestConfig } from 'next-intl/server';
import { locales } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as any)) {
    locale = 'lt';
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
