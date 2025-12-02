// app/house-rules/page.tsx
import React from "react";
import HouseRulesClient from "./HouseRulesClient";
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'metadata' });

  return {
    title: t('houseRulesTitle'),
    description: t('houseRulesDescription'),
  };
}

export default async function Page({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'houseRules' });

  return (
    <main className="bg-[var(--color-background-main)] min-h-screen pt-14">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-primary-dark)] mb-3">
            {t('title')}
          </h1>
          <p className="text-base text-neutral-600">
            {t('pageSubtitle')}
          </p>
        </header>

        <HouseRulesClient
          introText={t('intro')}
          ezeroText={t('ezeroNamelis')}
          dupleksText={t('dupleksas')}
          ezeroNamelisTab={t('ezeroNamelisTab')}
          dupleksasTab={t('dupleksasTab')}
          generalRules={t('generalRules')}
          generalRulesSubtitle={t('generalRulesSubtitle')}
          jacuzziRules={t('jacuzziRules')}
          jacuzziRulesSubtitle={t('jacuzziRulesSubtitle')}
          importantInfo={t('importantInfo')}
          warningTitle={t('warningTitle')}
          warningText={t('warningText')}
        />
      </div>
    </main>
  );
}
