import { Suspense } from "react";
import { getTranslations } from 'next-intl/server';
import CheckoutDetailsClient from "./CheckoutDetailsClient";

export default async function CheckoutDetailsPage() {
  const t = await getTranslations('checkoutDetails');

  return (
    <Suspense fallback={<div className="mt-12 p-8 text-center text-sm text-gray-500">{t('loading')}</div>}>
      <CheckoutDetailsClient />
    </Suspense>
  );
}
