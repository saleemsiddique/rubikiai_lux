import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host') || '';

  // ✅ REDIRECT de rubikiailux.lt a www.rubikiailux.lt
  // PERO NO para rutas de API (evita que POST se convierta en GET)
  if (host === 'rubikiailux.lt' && !pathname.includes('/api/')) {
    const url = req.nextUrl.clone();
    url.host = 'www.rubikiailux.lt';
    return NextResponse.redirect(url, 301);
  }

  // Continuar con el middleware de next-intl
  return intlMiddleware(req);
}

export const config = {
  // Exclude webhooks and cron jobs from locale handling
  matcher: ['/((?!_next|_vercel|api/stripe/webhook|api/montonio/webhook|api/send-reminder|.*\\..*).*)']
};
