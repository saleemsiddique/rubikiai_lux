// app/privacy-policy/page.tsx
import React from "react";
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'metadata' });

  return {
    title: t('privacyPolicyTitle'),
    description: t('privacyPolicyDescription'),
  };
}

export default async function PrivacyPolicyPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'privacyPolicy' });

  return (
    <main className="bg-[var(--color-background-main)] min-h-screen pt-8">
      <section className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-primary-dark)]">
          {t('pageTitle')}
        </h1>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm p-6 md:p-8">
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-7 text-neutral-800">
            {t('content')}
          </pre>
        </div>
      </section>
    </main>
  );
}
