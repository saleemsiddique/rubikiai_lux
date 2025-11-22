// ----------------------------
// Example page: app/ezero-namelis/page.tsx
// ----------------------------


// app/ezero-namelis/page.tsx
"use client";


import React from "react";
import dynamic from "next/dynamic";

const HousePageClient = dynamic(() => import("@/components/HousePage"), { ssr: false });

const images = [
  "/ezero-namelis/ezero-namelis.png",
  "/ezero-namelis/ezero-n1.jpeg",
  "/ezero-namelis/ezero-n2.jpeg",
  "/ezero-namelis/ezero-n3.jpeg",
  "/ezero-namelis/ezero-n4.jpeg",
  "/ezero-namelis/ezero-n5.jpeg",
  "/ezero-namelis/ezero-n6.jpeg",
  "/ezero-namelis/ezero-n7.jpeg",
  "/ezero-namelis/ezero-n8.jpeg",
  "/ezero-namelis/ezero-n9.jpeg",
  "/ezero-namelis/ezero-n10.jpeg",
  "/ezero-namelis/ezero-n11.JPG",
  "/ezero-namelis/ezero-n12.jpeg",
  "/ezero-namelis/ezero-n13.jpg",
  "/ezero-namelis/ezero-n14.jpeg",
  "/ezero-namelis/ezero-n15.jpeg",
];


export default function EzeroNamelisPage() {
  return (
    <HousePageClient
      heroSrc="/ezero-namelis/ezero-namelis.png"
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
            Klasikinis - Retro stilius.

            Prabangus  jacuzzi terasoje su vaizdu į Rubikių ežerą ...

            Privati pakrantė - paplūdimys, nepakartojami saulėlydžiai.
            Čia laikas sustoja...
          </p>
          <br />
          <p>
            Apartamentuose rasite viską ko gali prireikti: pilnai įrengtą virtuvę, poilsio zoną, vonios kambarį, miegamąjį su patogia ir
            didele dvigule lova, wifi, tv, Kamado Picnic kepsninę terasoje...
          </p>
          <br />
          <p>
            Šildomos grindys jūsų komfortui, šilumos siurblys šiltiems vakarams užtikrinti, kondicionierius - atvėsti karštą vasarą...
          </p>
          <br />
          <p>
            Šiltuoju laikotarpiu taip pat galėsite mėgautis šalia esančiu dideliu privačiu paplūdimiu. Siūlome išsinuomuoti baidares, 
            vandens dviratį ar valtį, kuriomis galite apiplaukti bei pažinti net 16 Rubikių ežero salų ar palydėti nuostabiausius 
            raudonus saulėlydžius.
          </p>
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