// ----------------------------
// Example page: app/ezero-namelis/page.tsx
// ----------------------------

import React, { Suspense } from "react";
import { getTranslations } from 'next-intl/server';
import HousePage from "@/components/HousePage";

const images = [
  "/ezero-namelis/ezero-namelis (19).jpg",
  "/ezero-namelis/ezero-namelis (9).jpeg",
  "/ezero-namelis/ezero-namelis (5).jpeg",
  "/ezero-namelis/ezero-namelis (3).jpeg",
  "/ezero-namelis/ezero-namelis (4).jpeg",
  "/ezero-namelis/ezero-namelis (18).jpg",
  "/ezero-namelis/ezero-namelis (12).jpeg",
  "/ezero-namelis/ezero-namelis (13).jpeg",
  "/ezero-namelis/ezero-namelis (14).jpeg",
  "/ezero-namelis/ezero-namelis (6).jpeg",
  "/ezero-namelis/ezero-namelis (1).jpeg",
  "/ezero-namelis/ezero-namelis (10).jpeg",
  "/ezero-namelis/ezero-namelis (11).jpeg",
  "/ezero-namelis/ezero-namelis (15).jpeg",
  "/ezero-namelis/ezero-namelis (7).jpeg",
  "/ezero-namelis/ezero-namelis (17).JPG",
  "/ezero-namelis/ezero-namelis (2).jpeg",
  "/ezero-namelis/ezero-namelis (8).jpeg",
];

// Forzar renderizado dinámico para evitar el error de useSearchParams
export const dynamic = 'force-dynamic';

// Loading fallback component
function HousePageFallback() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="relative h-[75vh] md:h-screen w-full bg-gray-200 animate-pulse" />
    </div>
  );
}

export default async function EzeroNamelisPage() {
  const t = await getTranslations('houses.ezeroNamelis');
  const tAmenities = await getTranslations('amenities');

  return (
    <Suspense fallback={<HousePageFallback />}>
      <HousePage
        heroSrc="/ezero-namelis/ezero-namelis (19).jpg"
        title="EŽERO NAMELIS"
        subtitle={t('subtitle')}
        accommodates={2}
        size={t('size')}
        beds={t('beds')}
        images={images}
        houseSlug="lake-house"
        defaultGuests="2"
        defaultType="ezero namelis"
        description={
          <>
            <p>{t('description.p1')}</p>
            <br />
            <p>{t('description.p2')}</p>
            <br />
            <p>{t('description.p3')}</p>
            <br />
            <p>{t('description.p4')}</p>
            <br />
            <p>{t('description.p5')}</p>
            <br />
            <p>{t('description.p6')}</p>
            <br />
            <p>{t('description.p7')}</p>
          </>
        }
        amenitiesSections={[
          {
            title: tAmenities('kitchen'),
            items: [
              tAmenities('refrigerator'),
              tAmenities('microwave'),
              tAmenities('electricStove'),
              tAmenities('oven'),
              tAmenities('coffeeMachine'),
              tAmenities('kettle'),
            ],
          },
          {
            title: tAmenities('bathroom'),
            items: [
              tAmenities('towels'),
              tAmenities('hairDryer'),
              tAmenities('shampooGel'),
              tAmenities('wc'),
              tAmenities('showers'),
              tAmenities('bathrobes'),
            ],
          },
          {
            title: tAmenities('additionally'),
            items: [
              tAmenities('wifi'),
              tAmenities('tv'),
              tAmenities('heatPump'),
              tAmenities('airConditioning'),
              tAmenities('heatedFloor'),
              tAmenities('terrace'),
              tAmenities('jacuzzi'),
              tAmenities('bbq')
            ],
          },
        ]}
      />
    </Suspense>
  );
}