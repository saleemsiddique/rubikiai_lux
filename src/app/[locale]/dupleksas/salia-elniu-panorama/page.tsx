// server component - validates guests and redirects if overflow
import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from 'next-intl/server';
import HousePage from "@/components/HousePage";

const panoramaImages = [
  "/dupleksas/2-dupleksas8.jpeg",
  "/dupleksas/2-dupleksas11.jpeg",
  "/dupleksas/2-dupleksas4.jpeg",
  "/dupleksas/2-dupleksas7.jpeg",
  "/dupleksas/2-dupleksas6.jpeg",
  "/dupleksas/2-dupleksas3.jpeg",
  "/dupleksas/2-dupleksas9.jpeg",
  "/dupleksas/2-dupleksas5.jpeg",
  "/dupleksas/2-dupleksas1.jpeg",
  "/dupleksas/2-dupleksas14.jpeg",
  "/dupleksas/2-dupleksas2.jpeg",
  "/dupleksas/2-dupleksas13.jpg",
  "/dupleksas/2-dupleksas12.jpeg",
  "/dupleksas/2-dupleksas10.jpeg",
];

const ACCOMMODATES = 4;
const DEFAULT_GUESTS = "4";

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

export default async function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const guestsRaw = Array.isArray(searchParams?.guests)
    ? searchParams!.guests[0]
    : searchParams?.guests ?? DEFAULT_GUESTS;

  const guests = parseInt(String(guestsRaw), 10);

  if (!Number.isNaN(guests) && Number.isFinite(guests) && guests > ACCOMMODATES) {
    redirect("/error-page");
  }

  const t = await getTranslations('houses.dupleksas');
  const tAmenities = await getTranslations('amenities');

  return (
    <Suspense fallback={<HousePageFallback />}>
      <HousePage
        heroSrc="/dupleksas/2-dupleksas8.jpeg"
        title="Nr.2 – Elnių Panorama"
        subtitle={t('subtitle')}
        accommodates={ACCOMMODATES}
        size={t('size')}
        beds={t('beds')}
        images={panoramaImages}
        houseSlug="salia-elniu-panorama"
        defaultGuests={DEFAULT_GUESTS}
        defaultType="dupleksas"
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
              tAmenities('bathrobes')
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