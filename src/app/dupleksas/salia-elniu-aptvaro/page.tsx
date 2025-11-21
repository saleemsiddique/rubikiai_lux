// server component - validates guests and redirects if overflow
import React from "react";
import { redirect } from "next/navigation";
import HousePage from "@/components/HousePage";

const aptvaroImages = [
  "/dupleksas/dupleksas1.png",
  "/dupleksas/1-dupleksas-n1.jpeg",
  "/dupleksas/1-dupleksas-n2.jpeg",
  "/dupleksas/1-dupleksas-n3.jpeg",
  "/dupleksas/dupleksas-n4.JPG",
  "/dupleksas/dupleksas-n5.JPG",
  "/dupleksas/dupleksas-n6.jpeg",
  "/dupleksas/dupleksas-n7.jpeg",
  "/dupleksas/dupleksas-n8.jpeg",
  "/dupleksas/dupleksas-n9.jpeg",
  "/dupleksas/dupleksas-n10.jpeg",
  "/dupleksas/dupleksas-n11.jpeg",
];

const ACCOMMODATES = 4;
const DEFAULT_GUESTS = "4";

export default function Page({
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

  return (
    <HousePage
      heroSrc="/dupleksas/dupleksas1.png"
      title="N°1 - Šalia Elnių Aptvaro"
      subtitle="Experience magical moments by the Rubikiai lake."
      accommodates={ACCOMMODATES}
      size="40 sq m"
      beds="2 Singles, 1 Double"
      images={aptvaroImages}
      houseSlug="salia-elniu-aptvaro"
      defaultGuests={DEFAULT_GUESTS}
      defaultType="dupleksas"
      description={
        <>
          <p>
            Atsipalaiduokite prabangiuose duplekso apartamentuose Anykščių rajone prie Rubikių ežero gamtos apsuptyje.
          </p>
          <br />
          <p>
            Šviesus, klasikinio - skandinaviško stiliaus dupleksas yra įsikūręs vos 100m iki Rubikių ežero.
          </p>
          <br />
          <p>
            Dupleksas yra unikalus tuo, kad ribojasi su 2ha elnių-danielių teritorija (Jus skirs tik permatoma tvora). Dupleksą sudaro du apartamentai po 40m2, su
            atskirais įėjimais, atskirtomis terasomis bei privačiomis sūkurinėmis SPA voniomis (Jacuzzi).
          </p>
          <br />
          <p>
            Vienuose duplekso apartamentuose gali apsistoti iki 4 asmenų, o rezervavus visą dupleksą (abu apartamentus) net iki 8 asmenų. Čia rasite viską ko gali
            prireikti poilsiui: pilnai įrengtą virtuvę, poilsio zoną, vonios kambarį, miegamąjį (2 viengules ir 1 dvigulę lovas), wifi. TV, rankšluosčius, patalynę, chalatus ir t.t.
          </p>
          <br />
          <p>
            Šildomos grindys Jūsų komfortui, šilumos siurblys šiltiems vakarams užtikrinti, krosnelė - romantiškam jaukumui, kondicionierius - atvėsti karštą vasarą...
          </p>
          <br />
          <p>
            Karštuoju laikotarpiu taip pat galėsite mėgautis netoliese esančiu dideliu privačiu paplūdimiu. Siūlome išsinuomuoti baidares,  vandens dviratį ar valtį, kuriomis
            galite apiplaukti bei pažinti net 16 Rubikių ežero salų ar palydėti nuostabiausius raudonus saulėlydžius.
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
