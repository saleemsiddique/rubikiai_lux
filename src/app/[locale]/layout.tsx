import React from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PWAInstaller from "@/components/PWAInstaller";
import { HouseProvider } from "@/context/HouseContext";
import { locales } from "@/i18n/config";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const title = t('defaultTitle');
  const description = t('defaultDescription');
  const siteUrl = 'https://www.rubikiailux.lt';
  const ogImage = `${siteUrl}/rubikiai-logo.png`;

  return {
    title,
    icons: {
      icon: "/Logotipas.PNG",
      apple: "/apple-icon.png",
    },
    manifest: "/manifest.json",
    themeColor: "#000000",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Rubikiai Lux",
    },
    viewport: {
      width: "device-width",
      initialScale: 1,
      maximumScale: 1,
      userScalable: false,
    },
    openGraph: {
      title,
      url: `${siteUrl}/${locale}`,
      siteName: 'Rubikiai Lux',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      images: [ogImage],
    },
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages: {
        'lt': `${siteUrl}/lt`,
        'en': `${siteUrl}/en`,
        'ru': `${siteUrl}/ru`,
      },
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <HouseProvider>
            <PWAInstaller />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </HouseProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
