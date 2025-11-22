// server component - validates guests and redirects if overflow
import React from "react";
import { redirect } from "next/navigation";
import HousePage from "@/components/HousePage";

const aptvaroImages = [
  "/dupleksas/1-dupleksas10.jpeg",
  "/dupleksas/1-dupleksas12.jpeg",
  "/dupleksas/1-dupleksas3.jpeg",
  "/dupleksas/1-dupleksas4.jpeg",
  "/dupleksas/1-dupleksas13.jpg",
  "/dupleksas/1-dupleksas6.jpeg",
  "/dupleksas/1-dupleksas7.jpeg",
  "/dupleksas/1-dupleksas8.jpg",
  "/dupleksas/1-dupleksas9.jpeg",
  "/dupleksas/1-dupleksas14.jpg",
  "/dupleksas/1-dupleksas5.jpeg",
  "/dupleksas/1-dupleksas2.jpeg",
  "/dupleksas/1-dupleksas1.jpeg",
  "/dupleksas/1-dupleksas11.jpg",
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
      heroSrc="/dupleksas/1-dupleksas10.jpeg"
      title="Nr.1 - Šalia Elnių Aptvaro"
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
