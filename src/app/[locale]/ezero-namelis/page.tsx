// ----------------------------
// Example page: app/ezero-namelis/page.tsx
// ----------------------------


// app/ezero-namelis/page.tsx
import React from "react";
import { getTranslations } from 'next-intl/server';
import HousePage from "@/components/HousePage";

const images = [
  "/ezero-namelis/ezero-namelis (19).jpg",
  "/ezero-namelis/ezero-namelis (9).jpeg",
  "/ezero-namelis/ezero-namelis (5).jpeg",
  "/ezero-namelis/ezero-namelis (16).jpeg",
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



export default async function EzeroNamelisPage() {
  const t = await getTranslations('houses.ezeroNamelis');
  const tAmenities = await getTranslations('amenities');

  return (
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
            tAmenities('dishwasher'),
            tAmenities('coffeeMachine'),
            tAmenities('kettle'),
            tAmenities('dishes')
          ],
        },
        {
          title: tAmenities('bathroom'),
          items: [
            tAmenities('bathtub'),
            tAmenities('shower'),
            tAmenities('toilet'),
            tAmenities('towels'),
            tAmenities('hairDryer'),
            tAmenities('toiletries')
          ],
        },
        {
          title: tAmenities('features'),
          items: [
            tAmenities('wifi'),
            tAmenities('tv'),
            tAmenities('heatPump'),
            tAmenities('airConditioning'),
            tAmenities('heatedFloors'),
            tAmenities('terrace'),
            tAmenities('jacuzzi')
          ],
        },
      ]}
    />
  );
}