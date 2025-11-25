// app/house-rules/page.tsx
import React from "react";
import HouseRulesClient from "./HouseRulesClient";

export const metadata = {
  title: "House Rules | Rubikiai Lux",
};

const INTRO_TEXT = `Klientas privalo užtikrinti, kad su vidaus tvarkos taisyklėmis būtų supažindinti ir jų laikytųsi visi kartu su juo atvykę į sodybą svečiai. Jeigu klientas ar bet kuris iš kartu su klientu atvykusių svečių vidaus tvarkos taisyklių nesilaiko, už bet kokias kilusias pasekmes klientas atsako asmeniškai teisės aktų nustatyta tvarka.`;

const EZERO_NAMELIS = `Apgyvendinimo para prasideda 16 val., baigiasi kitos dienos 12 val.

Atvykus reikia sumokėti likusią rezervacijos sumą.

Atvykti su augintiniais griežtai draudžiama. Visgi atvykus, bus paprašyta išvykti. Mokėjimas nebus grąžinamas.

Neišstumdyti baldų ir neperdėti daiktų į ne jiems skirtas vietas. Palaikyti apartamentuose tvarką ir švarą. Viskas yra idealaus stovio ir mes norėtumėme tai išlaikyti.

Prašome saugoti mūsų turtą. Jei inventorius sulaužomas, sudaužomas ar kitaip sugadinamas - informuoti ir atsiskaityti reikia iš karto. Jeigu minėtą žalą padaro nepilnamečiai vaikai, materialiai už juos atsako jų tėvai ar globėjai, o šiems atsisakius žalą atlygina – visais atvejais Klientas.

Jei Klientas atvyksta su nepilnamečiais vaikais - privalo rūpintis jais, t.y. nepalikti jų be priežiūros, ir pilnai atsako pats už jų saugumą bei pilnai materialiai atsako už vaikų padarytus sodyboje nuostolius (sulaužytą, sugadintą inventorių, turtą).

Priimame svečius tik ramiam poilsiui, todėl prašome gerbti aplinkinių ramybę, ramybės valandos nuo 24 iki 9 valandos.

RŪKYTI VIDUJE DRAUDŽIAMA. Rūkant lauke, nuorūkas mesti tik į tam skirtas talpas terasoje.

Nepjaustyti ant stalo ar stalviršių, naudoti pjaustymo lenteles.

Orkaitėje naudoti kepimo popierių ar foliją.

Naudotis elektros prietaisais laikantis saugumo reikalavimų, neleisti jais naudotis vaikams. Nepalikti be priežiūros įjungtų elektros prietaisų. Prašome išjungti visas šviesas ir užsukti vandens čiaupus prieš paliekant apartamentus.

Antklodės, rankšluosčiai ir kitas kambarių inventorius negali būti naudojamas pliažė ar iškyloje lauke.

---JACUZZI---

Jei jacuzzi paslauga neapmokėta, ja naudotis griežtai draudžiama!

Jacuzzi naudojimosi laikas nuo 18 val iki 24 val.

Jacuzzi nėra skirta prausimuisi, todėl prieš naudojantis ja, rekomenduojame nusiprausti duše!

Nedėvėti papuošalų ir aksesuarų (žiedų, apyrankių, grandinėlių, laikrodžių...) dėl galimybės juos prarasti bei sugadinti jacuzzi siurblius...turėsite padengti taisymo išlaidas.

Draudžiama naudotis jacuzzi išsitepus bet kokiais kremais ar aliejais.

Nevalgyti ir negerti sūkurinėje vonioje ir nepilti į ją jokių skysčių, nei šampūno, muilo... - taip galite sugadinti filtravimo sistemą bei siurblius ir turėsite padengti taisymo išlaidas.

Draudžiama atidaryti jacuzzi dangtį naudojant grilių – šašlykinę.

Po kiekvieno naudojimosi sūkurine vonia BŪTINA uždaryti dangtį.`;

const DUPLEKSAS = `Apgyvendinimo para prasideda 16 val., baigiasi kitos dienos 11 val.

Atvykus reikia sumokėti likusią rezervacijos sumą.

Atvykti su augintiniais griežtai draudžiama. Visgi atvykus, bus paprašyta išvykti. Mokėjimas nebus grąžinamas.

Neišstumdyti baldų ir neperdėti daiktų į ne jiems skirtas vietas. Palaikyti apartamentuose tvarką ir švarą. Viskas yra idealaus stovio ir mes norėtumėme tai išlaikyti.

Prašome saugoti mūsų turtą. Jei inventorius sulaužomas, sudaužomas ar kitaip sugadinamas - informuoti ir atsiskaityti reikia iš karto. Jeigu minėtą žalą padaro nepilnamečiai vaikai, materialiai už juos atsako jų tėvai ar globėjai, o šiems atsisakius žalą atlygina – visais atvejais Klientas.

Jei Klientas ar su juo atvykę asmenys atvyksta su nepilnamečiais vaikais - privalo rūpintis jais, t.y. nepalikti jų be priežiūros, ir pilnai atsako patys už jų saugumą bei pilnai materialiai atsako už vaikų padarytus sodyboje nuostolius (sulaužytą, sugadintą inventorių, turtą).

Priimame svečius tik ramiam poilsiui, todėl prašome gerbti aplinkinių ramybę, ramybės valandos nuo 24 iki 9 valandos.

RŪKYTI VIDUJE DRAUDŽIAMA. Rūkant lauke, nuorūkas mesti tik į tam skirtas talpas terasoje.

Nepjaustyti ant stalo ar stalviršių, naudoti pjaustymo lenteles.

Orkaitėje naudoti kepimo popierių ar foliją.

Naudotis elektros prietaisais laikantis saugumo reikalavimų, neleisti jais naudotis vaikams. Nepalikti be priežiūros įjungtų elektros prietaisų. Prašome išjungti visas šviesas ir užsukti vandens čiaupus prieš paliekant apartamentus.

Kambaryje esančia krosnelę kūrenti tik leidus sodybos šeimininkui ir išklausius instruktažą.

Nedėti daiktų ant krosnelės, nekūrenti krosnelės buitinėmis atliekomis.

Laikytis saugaus atstumo nuo įkaitusios krosnelės, bei nepalikti kūrentis be priežiūros.

Antklodės, rankšluosčiai ir kitas kambarių inventorius negali būti naudojamas pliažė ar iškyloje lauke.

Nemaitinti elnių danielių kitu maistu, tik vaisiais ar daržovėmis.

---JACUZZI---

Jei jacuzzi paslauga neapmokėta, ja naudotis griežtai draudžiama!

Jacuzzi naudojimosi laikas nuo 18 val iki 24 val.

Jacuzzi nėra skirta prausimuisi, todėl prieš naudojantis ja, rekomenduojame nusiprausti duše!

Griežtai draudžiama šokinėti į ir iš Jacuzzi.

Nedėvėti papuošalų ir aksesuarų (žiedų, apyrankių, grandinėlių, laikrodžių...) dėl galimybės juos prarasti bei sugadinti jacuzzi siurblius...turėsite padengti taisymo išlaidas.

Draudžiama naudotis jacuzzi išsitepus bet kokiais kremais ar aliejais.

Nevalgyti ir negerti sūkurinėje vonioje ir nepilti į ją jokių skysčių, nei šampūno, muilo... - taip galite sugadinti filtravimo sistemą bei siurblius ir turėsite padengti taisymo išlaidas.

Draudžiama atidaryti jacuzzi dangtį naudojant grilių – šašlykinę.

Po kiekvieno naudojimosi sūkurine vonia BŪTINA uždaryti dangtį.`;

export default function Page() {
  return (
    <main className="bg-[var(--color-background-main)] min-h-screen pt-14">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-primary-dark)] mb-3">
            Vidaus Tvarkos Taisyklės
          </h1>
          <p className="text-base text-neutral-600">
            House Rules — Please read carefully to ensure a pleasant stay
          </p>
        </header>

        <HouseRulesClient 
          introText={INTRO_TEXT}
          ezeroText={EZERO_NAMELIS} 
          dupleksText={DUPLEKSAS} 
        />
      </div>
    </main>
  );
}