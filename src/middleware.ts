import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Exclude Stripe and Montonio webhooks from locale handling
  matcher: ['/((?!_next|_vercel|api/stripe/webhook|api/montonio/webhook|.*\\..*).*)']
};
