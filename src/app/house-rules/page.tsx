// app/house-rules/page.tsx
import React from "react";
import HouseRulesClient from "./HouseRulesClient";

export const metadata = {
  title: "House Rules | Rubikiai Lux",
};
const EZERO_NAMELIS = `TRUMPALAIKIO APGYVENDINIMO PASLAUGŲ SUTARTIS
Haroldas Aukštikalnis gyv. Piliakalnio vs 1, LT-29203, Anykščių r., toliau sutartyje vadinamas paslaugų
teikėju, ir ...........................................................................,
gyv.vieta/buveinė ................................................................................................................................................, toliau sutartyje
vadinamas Klientu, sudarydami 20....................... trumpalaikio apgyvendinimo paslaugų sutartį, susitariame, kad Klientas
įsipareigoja besąlygiškai laikytis vidaus tvarkos taisyklių sodyboje „Rubikiai Lux Spa Apartments“, esančioje adresu Piliakalnio vs
1, LT-29203, Anykščių r.
Klientas privalo užtikrinti, kad su vidaus tvarkos taisyklėmis būtų supažindinti ir jų laikytųsi visi kartu su juo atvykę į sodybą
svečiai. Jeigu klientas ar bet kuris iš kartu su klientu atvykusių svečių vidaus tvarkos taisyklių nesilaiko, už bet kokias kilusias
pasekmes klientas atsako asmeniškai teisės aktų nustatyta tvarka.

Kitos nuostatos:
1. Apgyvendinimo para prasideda 16 val., baigiasi kitos dienos 12 val.
2. Atvykus reikia sumokėti likusią rezervacijos sumą.
3. Atvykti su augintiniais griežtai draudžiama. Visgi atvykus, bus paprašyta išvykti. Mokėjimas nebus grąžinamas.
4. Neišstumdyti baldų ir neperdėti daiktų į ne jiems skirtas vietas. Palaikyti apartamentuose tvarką ir švarą. Viskas yra idealaus
stovio ir mes norėtumėme tai išlaikyti.
5. Prašome saugoti musų turtą. Jei inventorius sulaužomas, sudaužomas ar kitaip sugadinamas - informuoti ir atsiskaityti
reikia iš karto. Jeigu minėtą žalą padaro nepilnamečiai vaikai, materialiai už juos atsako jų tėvai ar globėjai, o šiems
atsisakius žalą atlygina – visais atvejais Klientas.
6. Jei Klientas atvyksta su nepilnamečiais vaikais - privalo rūpintis jais, t.y. nepalikti jų be
priežiūros, ir pilnai atsako pats už jų saugumą bei pilnai materialiai atsako už vaikų padarytus sodyboje nuostolius
(sulaužytą, sugadintą inventorių, turtą).
7. Priimame svečius tik ramiam poilsiui, todėl prašome gerbti aplinkinių ramybę, ramybės valandos nuo 24 iki 9 valandos..
8. RŪKYTI VIDUJE DRAUDŽIAMA. Rūkant lauke, nuorūkas mesti tik į tam skirtas talpas terasoje.
9. Nepjaustyti ant stalo ar stalviršių, naudoti pjaustymo lenteles.
10. Orkaitėje naudoti kepimo popierių ar foliją.
11. Naudotis elektros prietaisais laikantis saugumo reikalavimų, neleisti jais naudotis vaikams. Nepalikti be priežiūros įjungtų
elektros prietaisų. Prašome išjungti visas šviesas ir užsukti vandens čiaupus prieš paliekant apartamentus.
12. Antklodės, rankšluosčiai ir kitas kambarių inventorius negali buti naudojamas pliaže ar iškyloje lauke.

Jacuzzi naudojimo taisykles:
1. Jei jacuzzi paslauga neapmokėta, ja naudotis griežtai draudžiama!
2. Jacuzzi naudojimosi laikas nuo 18 val iki 24 val.
3. Jacuzzi nėra skirta prausimuisi, todėl prieš naudojantis ja, rekomenduojame nusiprausti duše !!!
4. Nedėvėti papuošalų ir aksesuarų (žiedų, apyrankių, grandinėlių, laikrodžių...) dėl galimybės juos prarasti bei sugadinti
jacuzzi siurblius...turėsite padengti taisymo išlaidas...€
5. Draudžiama naudotis jacuzzi išsitepus bet kokiais kremais ar aliejais,
6. Nevalgyti ir negerti sūkurinėje vonioje ir nepilti į ją jokių skysčių, nei šampūno, muilo... - taip galite sugadinti
filtravimo sistemą bei siurblius ir turėsite padengti taisymo išlaidas ...€..
7. Draudžiama atidaryti jacuzzi dangtį naudojant grilių – šašlykinę,
8. Po kiekvieno naudojimosi sūkurine vonia BŪTINA uždaryti dangtį.

Rubikiai LUX darbuotojai turi teisę iškeldinti iš apartamentų anksčiau nustatyto termino asmenis (be pinigų grąžinimo),
kurie nesilaiko ir šiurkščiai pažeidžia vidaus tvarkos ir elgesio taisykles, taip pat reikalauti atlyginti padarytą žalą ir
nuostolius pagal LR įstatymus.

Haroldas Aukštikalnis
`;

const DUPLEKSAS = `TRUMPALAIKIO APGYVENDINIMO PASLAUGŲ SUTARTIS
Haroldas Aukštikalnis gyv. Piliakalnio vs 1, LT-29203, Anykščių r., toliau sutartyje vadinamas paslaugų
teikėju, ir ...........................................................................,
gyv.vieta/buveinė ................................................................................................................................................, toliau sutartyje
vadinamas Klientu, sudarydami 20....................... trumpalaikio apgyvendinimo paslaugų sutartį, susitariame, kad Klientas
įsipareigoja besąlygiškai laikytis vidaus tvarkos taisyklių sodyboje „Rubikiai Lux Spa Apartments“, esančioje adresu Piliakalnio vs
1, LT-29203, Anykščių r.
Klientas privalo užtikrinti, kad su vidaus tvarkos taisyklėmis būtų supažindinti ir jų laikytųsi visi kartu su juo atvykę į sodybą
svečiai. Jeigu klientas ar bet kuris iš kartu su klientu atvykusių svečių vidaus tvarkos taisyklių nesilaiko, už bet kokias kilusias
pasekmes klientas atsako asmeniškai teisės aktų nustatyta tvarka.

Kitos nuostatos:
1. Apgyvendinimo para prasideda 16 val., baigiasi kitos dienos 11 val.
2. Atvykus reikia sumokėti likusią rezervacijos sumą.
3. Atvykti su augintiniais griežtai draudžiama. Visgi atvykus, bus paprašyta išvykti. Mokėjimas nebus grąžinamas.
4. Neišstumdyti baldų ir neperdėti daiktų į ne jiems skirtas vietas. Palaikyti apartamentuose tvarką ir švarą. Viskas yra idealaus
stovio ir mes norėtumėme tai išlaikyti.
5. Prašome saugoti musų turtą. Jei inventorius sulaužomas, sudaužomas ar kitaip sugadinamas - informuoti ir atsiskaityti
reikia iš karto. Jeigu minėtą žalą padaro nepilnamečiai vaikai, materialiai už juos atsako jų tėvai ar globėjai, o šiems
atsisakius žalą atlygina – visais atvejais Klientas.
6. Jei Klientas ar su juo atvykę asmenys atvyksta su nepilnamečiais vaikais - privalo rūpintis jais, t.y. nepalikti jų be
priežiūros, ir pilnai atsako patys už jų saugumą bei pilnai materialiai atsako už vaikų padarytus sodyboje nuostolius
(sulaužytą, sugadintą inventorių, turtą).
7. Priimame svečius tik ramiam poilsiui, todėl prašome gerbti aplinkinių ramybę, ramybės valandos nuo 24 iki 9 valandos..
8. RŪKYTI VIDUJE DRAUDŽIAMA. Rūkant lauke, nuorūkas mesti tik į tam skirtas talpas terasoje.
9. Nepjaustyti ant stalo ar stalviršių, naudoti pjaustymo lenteles.
10. Orkaitėje naudoti kepimo popierių ar foliją.
11. Naudotis elektros prietaisais laikantis saugumo reikalavimų, neleisti jais naudotis vaikams. Nepalikti be priežiūros įjungtų
elektros prietaisų. Prašome išjungti visas šviesas ir užsukti vandens čiaupus prieš paliekant apartamentus.
12. Kambaryje esančia krosnelę kūrenti tik leidus sodybos šeimininkui ir išklausius instruktažą.
13. Nedėti daiktų ant krosnelės, nekūrenti krosnelės buitinėmis atliekomis.
14. Laikytis saugaus atstumo nuo įkaitusios krosnelės, bei nepalikti kūrentis be priežiūros.
15. Antklodės, rankšluosčiai ir kitas kambarių inventorius negali buti naudojamas pliaže ar iškyloje lauke.
16. Nemaitinti elnių danielių kitu maistu, tik vaisiais ar daržovėmis.

Jacuzzi naudojimo taisykles:
1. Jei jacuzzi paslauga neapmokėta, ja naudotis griežtai draudžiama!
2. Jacuzzi naudojimosi laikas nuo 18 val iki 24 val.
3. Jacuzzi nėra skirta prausimuisi, todėl prieš naudojantis ja, rekomenduojame nusiprausti duše !!!
4. Griežtai draužiama šokinėti į ir iš Jacuzzi
5. Nedėvėti papuošalų ir aksesuarų (žiedų, apyrankių, grandinėlių, laikrodžių...) dėl galimybės juos prarasti bei sugadinti
jacuzzi siurblius...turėsite padengti taisymo išlaidas...€
6. Draudžiama naudotis jacuzzi išsitepus bet kokiais kremais ar aliejais,
7. Nevalgyti ir negerti sūkurinėje vonioje ir nepilti į ją jokių skysčių, nei šampūno, muilo... - taip galite sugadinti
filtravimo sistemą bei siurblius ir turėsite padengti taisymo išlaidas ...€
8. Draudžiama atidaryti jacuzzi dangtį naudojant grilių – šašlykinę,
9. Po kiekvieno naudojimosi sūkurine vonia BŪTINA uždaryti dangtį.

Rubikiai LUX darbuotojai turi teisę iškeldinti iš apartamentų anksčiau nustatyto termino asmenis (be pinigų grąžinimo),
kurie nesilaiko ir šiurkščiai pažeidžia vidaus tvarkos ir elgesio taisykles, taip pat reikalauti atlyginti padarytą žalą ir
nuostolius pagal LR įstatymus.

Haroldas Aukštikalnis
`;

export default function Page() {
  return (
    <main className="bg-[var(--color-background-main)] min-h-screen pt-8">
      <div className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-primary-dark)]">
            House Rules / Taisyklės
          </h1>
          <p className="text-sm text-gray-600">
            Please read the house rules carefully to ensure a pleasant stay for
            all guests.
          </p>
        </header>

        <HouseRulesClient ezeroText={EZERO_NAMELIS} dupleksText={DUPLEKSAS} />
      </div>
    </main>
  );
}
