import React from "react";
import type { Metadata } from "next";
import { getTranslations } from 'next-intl/server';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: "Admin - Rubikiai Lux",
    description: "Panel de administración",
    icons: {
      icon: "/Logotipas.PNG",
      apple: "/apple-icon.png",
    },
    manifest: "/manifest-admin.json", // Manifest específico para admin
    themeColor: "#000000",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Rubikiai Admin",
    },
    viewport: {
      width: "device-width",
      initialScale: 1,
      maximumScale: 1,
      userScalable: false,
    },
  };
}

export default function AdminLayout({ children }: Props) {
  return <>{children}</>;
}
