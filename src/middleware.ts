import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Include API routes in the matcher so they get the locale prefix
  matcher: ['/((?!_next|_vercel|.*\\..*).*)']
};
