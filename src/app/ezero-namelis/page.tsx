// ----------------------------
// Example page: app/ezero-namelis/page.tsx
// ----------------------------


// app/ezero-namelis/page.tsx
"use client";


import React from "react";
import dynamic from "next/dynamic";

const HousePageClient = dynamic(() => import("@/components/HousePage"), { ssr: false });

const images = [
  "/ezero-namelis/ezero-namelis (19).jpg",
  "/ezero-namelis/ezero-namelis (5).jpeg",
  "/ezero-namelis/ezero-namelis (16).jpeg",
  "/ezero-namelis/ezero-namelis (3).jpeg",
  "/ezero-namelis/ezero-namelis (4).jpeg",
  "/ezero-namelis/ezero-namelis (18).jpg",
  "/ezero-namelis/ezero-namelis (12).jpeg",
  "/ezero-namelis/ezero-namelis (13).jpeg",
  "/ezero-namelis/ezero-namelis (14).jpeg",
  "/ezero-namelis/ezero-namelis (6).jpeg",
  "/ezero-namelis/ezero-namelis (9).jpeg",
  "/ezero-namelis/ezero-namelis (1).jpeg",
  "/ezero-namelis/ezero-namelis (10).jpeg",
  "/ezero-namelis/ezero-namelis (11).jpeg",
  "/ezero-namelis/ezero-namelis (15).jpeg",
  "/ezero-namelis/ezero-namelis (7).jpeg",
  "/ezero-namelis/ezero-namelis (17).jpg",
  "/ezero-namelis/ezero-namelis (2).jpeg",
  "/ezero-namelis/ezero-namelis (8).jpeg",
];



export default function EzeroNamelisPage() {
  return (
    <HousePageClient
      heroSrc="/ezero-namelis/ezero-namelis (19).jpg"
      title="EŽERO NAMELIS"
      subtitle="A private and romantic cottage for two."
      accommodates={2}
      beds="1 Double"
      images={images}
      houseSlug="lake-house"
      defaultGuests="2"
      defaultType="ezero namelis"
      description={
        <>
          <p>
            Privatus ir Romantiškas Ežero Namelis dviems - tik 10 žingsnių iki ežero ir miško.
          </p>
          <br />
          <p>
            Klasikinis - Retro stilius.
          </p>
          <br />
          <p>
            Prabangus  jacuzzi terasoje su vaizdu į Rubikių ežerą ir nepakartojamus saulėlydžius...
          </p>
          <br />
          <p>
            Čia laikas sustoja...
          </p>
          <br />
          <p>
            Apartamentuose rasite viską ko gali prireikti: pilnai įrengtą virtuvę, poilsio zoną, vonios kambarį, miegamąjį su patogia ir didele dvigule lova, wifi, tv, Kamado Picnic kepsninę terasoje, rankšluosčius, patalynę, chalatus ir t.t....
          </p>
          <br />
          <p>
            Šildomos grindys Jūsų komfortui, šilumos siurblys šiltiems vakarams užtikrinti, kondicionierius - atvėsti karštą vasarą...
          </p>
          <br />
          <p>
            Šiltuoju laikotarpiu taip pat galėsite mėgautis netoliese esančiu dideliu privačiu paplūdimiu. Siūlome išsinuomuoti baidares, vandens dviratį ar valtį, kuriomis galite apiplaukti bei pažinti net 16 Rubikių ežero salų ar palydėti nuostabiausius raudonus saulėlydžius.           </p>
        </>
      }
      amenitiesSections={[
        {
          title: "Kitchen",
          items: ["Refrigerator", "Microwave", "Electric stove", "Oven", "Coffee machine", "Electric kettle", "Dishes and cutlery"],
        },
        {
          title: "Bathroom",
          items: ["Bathtub", "Shower", "Toilet", "Electric towel dryer", "Towels", "Hair dryer", "Shampoo, shower gel, bathrobes"],
        },
        {
          title: "Features",
          items: ["Wi-Fi", "TV", "Heat pump", "Air conditioning", "Heated floors", "Terrace", "Luxury jacuzzi"],
        },
      ]}
    />
  );
}