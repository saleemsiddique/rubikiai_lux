"use client";
// app/house-rules/HouseRulesClient.tsx
import React, { useMemo, useState } from "react";

const RULES = `Dupleksas ir ežero namelis yra skirti tik svečiams norintiems ramaus poilsio, todėl primename, kad:

​

Vienuose duplekso apartamentuose gali apsistoti iki 4 asmenų. Rezervuoti gali tik pilnamečiai asmenys.

Nepilnamečiai vaikai priimami tik nuo 16 metų, nebent iš anksto susitarus, rezervuojant abu duplekso apartamentus.

Apartamentuose, bei jų lauko zonose ar jacuzzi vienu metu negali būti daugiau žmonių nei nurodyta rezervacijoje.

Be papildomo apmokėjimo gali apsistoti tik tiek asmenų, kiek buvo nurodyta rezervacijos metu.

Atvykti su augintiniais griežtai draudžiama. Atvykus bus paprašyta išvykti. Rezervacijos mokestis nebus grąžinamas.

Vakarėliai ir renginiai neleidžiami. Gerbkite savo ir kitų svečių ramybę. Ramybės valandos nuo 24 iki 9 valandos.

​​

Rubikiai Lux darbuotojai turi teisę iškeldinti iš apartamentų ankščiau nustatyto termino asmenis (be jokio sumokėtos paslaugų kainos atlyginimo), kurie nesilaiko ir šiurkščiai pažeidžia vidaus tvarkos ir elgesio taisykles, taip pat reikalauti atlyginti padarytą žalą ir nuostolius.

​

Poilsiautojai visiškai materialiai atsako už sugadintą ar sunaikintą sodyboje ir jos teritorijoje esantį kilnojamąjį ir nekilnojamąjį turtą, bei materialines vertybes (už padarytą materialinę žalą klientas atsako LR įstatymų nustatyta tvarka).

 

Už galimus nelaimingus atsitikimus, galinčius įvykti sodybos teritorijoje ar už jos ribų  (namo viduje, terasoje, miške, kieme, sūkurinėje vonioje, maudantis ežere, plaukiojant su irklentėm ir t.t.) yra atsakingi patys poilsiautojai.

​

 

Poilsiautojai privalo:

​​

atvykus sumokėti likusią rezervacijos sumą.

palaikyti apartamentuose tvarką ir švarą. Viskas yra idealaus stovio ir mes norėtumėme tai išlaikyti. 

neišstumdyti ir neperdėti daiktų į ne jiems skirtas vietas. 

Antklodės, rankšluosčiai ir kitas kambarių inventorius negali būti naudojamas pliaže ar iškyloje lauke.

nepjaustyti ant stalo ar stalviršių, naudoti pjaustymo lenteles. 

orkaitėje naudoti kepimo popierių ar foliją.

RŪKYTI VIDUJE DRAUDŽIAMA. Rūkant lauke, nuorūkas mesti tik į tam skirtas talpas terasoje. 

nemaitinti elnių danielių be šeimininkų leidimo.

nepalikti be priežiūros įjungtų elektros prietaisų. Prašome išjungti visas šviesas ir užsukti vandenį prieš paliekant apartamentus.

tėvai, arba prižiūrintys asmenys privalo užtikrinti vaikų saugumą.

kambaryje esančią krosnelę kūrenti tik leidus sodybos šeimininkui ir išklausius instruktažą.

nedėti daiktų ant krosnelės. nekūrenti krosnelės buitinėmis atliekomis.

laikytis saugaus atstumo nuo įkaitusios krosnelės, dėl nudegimo galimybės

​​

JACUZZI NAUDOJIMO TAISYKLĖS:

​​

jei jacuzzi paslauga neapmokėta, ja naudotis draudžiama!

Jei pamiršote ar per klaidą nerezervavote jacuzzi, galite tai padaryti atvykę.

Jacuzzi NĖRA skirta prausimuisi, todėl prieš naudojantis ja, BŪTINA nusiprausti duše !!!

Nedėvėti papuošalų ir aksesuarų (žiedų, apyrankių, grandinėlių, laikrodžių…) dėl galimybės juos prarasti bei sugadinti jacuzzi siurblius...

Nelipti ir nedėti jokių daiktų ant jacuzzi dangčio.

Nešokinėti į ir iš jacuzzi.

Draudžiama atidaryti jacuzzi dangtį naudojant grilių - šašlykinę.

Nevalgyti ir negerti sūkurinėje vonioje ir nepilti į ją jokių skysčių, įskaitant šampūnus, muilus - taip galite sugadinti filtravimo sistemą.

Nepalikti nepilnamečių vaikų be priežiūros sūkurinėje vonioje.

Po kiekvieno naudojimosi sūkurine vonia būtina uždaryti dangtį!!!

​

​

Check-in ir Check-out

Duplekso atvykimas nuo 16:00, išvykimas iki 11:00. 

Ežero Namelio atvykimas nuo 16:00, išvykimas iki 12:00. 

​

Rezervacijos atšaukimas

Rezervacijos datą vieną kartą galima pakeisti nemokamai likus ne mažiau kaip 7 dienos iki atvykimo. Depozitas negrąžinamas. Daugkartinis datos keitimas apmokestinamas 20€ suma.

​

Dovanų kuponas

Dovanų kuponas turi būti galiojantis atvykimo dieną. Dovanų kuponą galima pratęsti, jei kuponas nėra panaudotas ir jo galiojimas nėra pasibaigęs. Pratęsti dovanų kuponą galima 2 mėnesiams ir tik vieną kartą. Dovanų kupono pratęsimas kainuoja 20 eur. Pinigai už dovanų kuponus nėra grąžinami.`;

export default function HouseRulesClient() {
  const [showRaw, setShowRaw] = useState(false);

  // Dividir en párrafos por dobles saltos de línea para presentación manteniendo el texto EXACTO
  const paragraphs = useMemo(() => RULES.split("\n\n"), []);

  return (
    <main className="min-h-screen bg-neutral-50 py-30">
      <div className="max-w-4xl mx-auto px-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">House Rules</h1>
          <p className="text-sm text-gray-600">
            Please read the house rules carefully to ensure a pleasant stay for all guests.
          </p>
        </header>

        {/* Contenido principal — presentación estética pero sin modificar RULES */}
        <article className="bg-white shadow-sm rounded-2xl p-6 prose max-w-none">
          {/* Ejemplo de encabezados y secciones generadas por la UI (no modifican RULES) */}
          <section>
            <h2>Normas generales</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {/* Renderizamos párrafos manteniendo exactamente el contenido */}
              {paragraphs.slice(0, 7).map((p, i) => (
                <p key={i} style={{ whiteSpace: "pre-wrap" }}>
                  {p}
                </p>
              ))}
            </div>
          </section>

          <section>
            <h2>Obligaciones del huésped</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {paragraphs.slice(7, 12).map((p, i) => (
                <p key={i} style={{ whiteSpace: "pre-wrap" }}>
                  {p}
                </p>
              ))}
            </div>
          </section>

          <section>
            <h2>Reglas de uso del jacuzzi</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {paragraphs.slice(12, 19).map((p, i) => (
                <p key={i} style={{ whiteSpace: "pre-wrap" }}>
                  {p}
                </p>
              ))}
            </div>
          </section>

          <section>
            <h2>Check-in / Check-out y políticas</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {paragraphs.slice(19).map((p, i) => (
                <p key={i} style={{ whiteSpace: "pre-wrap" }}>
                  {p}
                </p>
              ))}
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
