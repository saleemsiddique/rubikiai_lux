// app/emails/BookingReminderEmails.ts
import dayjs from "dayjs";

export type Activity = {
  title: string;
  time?: string; // e.g. "09:00"
  description?: string;
};

const PROPERTY_NAME_MAP: Record<string, string> = {
  "L0TeFf2LmrWGAaAyS8NY": "Ezero Namelis",
  "PZwbfMYlSXj61uYYJutg": "Salia-Elniu-Aptvaro",
  "oDzv9346CdaAsok162sX": "Salia-Elniu-Panorama",
};

export type BookingReminderEmailParams = {
  guestName: string;
  houseName: string;
  checkIn: string; // ISO date or YYYY-MM-DD
  checkOut?: string; // ISO date or YYYY-MM-DD
  nGuests?: number;
  activities?: Activity[];
  notes?: string;
  logoCid?: string; // default 'rubikiai-logo'
  houseImageCid?: string; // optional inline image for the house
};


function baseHeader(
  {
    guestName,
    houseName,
    checkIn,
    checkOut,
    nGuests = 2,
    logoCid = "rubikiai-logo",
    houseImageCid,
  }: BookingReminderEmailParams,
  { title }: { title: string }
) {
  const checkInFmt = dayjs(checkIn).format("dddd, MMMM D, YYYY");
  const checkOutFmt = checkOut ? dayjs(checkOut).format("dddd, MMMM D, YYYY") : "";
  const shortDate = dayjs(checkIn).format("DD/MM/YYYY");
  const displayName = PROPERTY_NAME_MAP[houseName] || houseName;

  return `
  <div style="margin:0;padding:0;background:#f6f3ef;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f3ef;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eae3da;box-shadow:0 6px 22px rgba(17,24,39,0.06);">

            <!-- Logo + date -->
            <tr>
              <td style="padding:18px 22px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="cid:${logoCid}" width="140" alt="Logo" style="display:block;border:0;outline:none;text-decoration:none;">
                    </td>
                    <td align="right" style="vertical-align:middle;font:600 14px Inter,Arial,sans-serif;color:#6b7280;">
                      <div>Reservation reminder</div>
                      <div style="font:500 13px Inter,Arial,sans-serif;color:#94a3b8;margin-top:4px;">${shortDate}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td style="padding:8px 22px 0;">
                <div style="font:700 26px Georgia, 'Times New Roman', serif;color:#214235;letter-spacing:0.6px;">
                  ${title}
                </div>
                <div style="height:3px;width:96px;background:#bfa58b;border-radius:2px;margin-top:10px;"></div>
              </td>
            </tr>

            <!-- Main copy -->
            <tr>
              <td style="padding:14px 22px 6px;">
                <div style="font:500 15px Inter,Arial,sans-serif;color:#334155;line-height:1.6;">
                  We're excited to host you at <strong>${displayName}</strong> on <strong>${checkInFmt}</strong>${checkOut ? ` until ${checkOutFmt}` : ""}. Please review the house information and rules below. <br>
                  Klientas privalo užtikrinti, kad su vidaus tvarkos taisyklėmis būtų supažindinti ir jų laikytųsi visi kartu su juo atvykę į sodybą
                  svečiai. Jeigu klientas ar bet kuris iš kartu su klientu atvykusių svečių vidaus tvarkos taisyklių nesilaiko, už bet kokias kilusias
                  pasekmes klientas atsako asmeniškai teisės aktų nustatyta tvarka.
                </div>
              </td>
            </tr>

            <!-- Quick details -->
            <tr>
              <td style="padding:12px 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #f0eadf;border-radius:12px;background:#fffcf9;">
                  <tr>
                    <td style="padding:12px 16px;border-right:1px solid #f0eadf;width:50%;">
                      <div style="font:600 12px Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">Check-in</div>
                      <div style="font:600 16px Inter,Arial,sans-serif;color:#0f172a;margin-top:6px;">${checkInFmt}</div>
                    </td>
                    <td style="padding:12px 16px;width:50%;">
                      <div style="font:600 12px Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">Guests</div>
                      <div style="font:600 16px Inter,Arial,sans-serif;color:#0f172a;margin-top:6px;">${nGuests}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
  `;
}

function baseFooter(notes?: string) {
  return `
            ${notes ? `<tr><td style="padding:12px 22px 12px;"><div style="font:600 13px Inter,Arial,sans-serif;color:#6b7280;">Notes</div><div style="font:14px Inter,Arial,sans-serif;color:#334155;margin-top:6px;">${notes}</div></td></tr>` : ""}

            <!-- CTA / contact -->
            <tr>
              <td align="center" style="padding:12px 22px 20px;">
                <div style="font:13px Inter,Arial,sans-serif;color:#6b7280;margin-top:10px;">Need anything? Reply to this email or contact us at <a href="mailto:info@rubikiailux.lt" style="color:#214235;text-decoration:underline;">info@rubikiailux.lt</a>.</div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:12px 22px 28px;border-top:1px solid #f0eadf;">
                <div style="font:400 12px Inter,Arial,sans-serif;color:#6b7280;text-align:center;">
                  We look forward to hosting you. Please check travel requirements and local rules before arrival.
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function rulesList(items: string[]) {
  return `
  <tr>
    <td style="padding:6px 22px 0;">
      <div style="font:700 18px Georgia, 'Times New Roman', serif;color:#214235;">House Rules (LT)</div>
      <div style="font:500 14px Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">Vidaus tvarkos taisyklės</div>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 22px 18px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
        <tbody>
          <tr>
            <td style="padding:12px 14px;font:14px/1.6 Inter, Arial, sans-serif;color:#334155;">
              <ul style="margin:0;padding-left:18px;">
                ${items.map((li) => `<li style=\"margin:6px 0;\">${li}</li>`).join("")}
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </td>
  </tr>`;
}

function jacuzziList(items: string[]) {
  return `
  <tr>
    <td style="padding:6px 22px 0;">
      <div style="font:700 18px Georgia, 'Times New Roman', serif;color:#214235;">Jacuzzi taisyklės</div>
      <div style="font:500 14px Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">Naudojimo informacija</div>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 22px 18px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
        <tbody>
          <tr>
            <td style="padding:12px 14px;font:14px/1.6 Inter, Arial, sans-serif;color:#334155;">
              <ul style="margin:0;padding-left:18px;">
                ${items.map((li) => `<li style=\"margin:6px 0;\">${li}</li>`).join("")}
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </td>
  </tr>`;
}

// -------------------- EMAIL A (House ID === L0TeFf2LmrWGAaAyS8NY) --------------------
export function BookingReminderEmailHtml_A(params: BookingReminderEmailParams): string {
  const header = baseHeader(params, { title: `Hi ${params.guestName}, important info for your stay` });
  const rules = [
    // Based on Rubikiai Lux E.N. Taisykles.pdf
    "Apgyvendinimo para prasideda 16 val., baigiasi kitos dienos 12 val.",
    "Atvykus reikia sumokėti likusią rezervacijos sumą.",
    "Atvykti su augintiniais griežtai draudžiama. Visgi atvykus, bus paprašyta išvykti. Mokėjimas nebus grąžinamas.",
    "Neišstumdyti baldų ir neperdėti daiktų į ne jiems skirtas vietas. Palaikyti apartamentuose tvarką ir švarą. Viskas yra idealaus stovio ir mes norėtumėme tai išlaikyti.",
    "Prašome saugoti musų turtą. Jei inventorius sulaužomas, sudaužomas ar kitaip sugadinamas - informuoti ir atsiskaityti reikia iš karto. Jeigu minėtą žalą padaro nepilnamečiai vaikai, materialiai už juos atsako jų tėvai ar globėjai, o šiems atsisakius žalą atlygina – visais atvejais Klientas.",
    "Jei Klientas atvyksta su nepilnamečiais vaikais - privalo rūpintis jais, t.y. nepalikti jų be priežiūros, ir pilnai atsako pats už jų saugumą bei pilnai materialiai atsako už vaikų padarytus sodyboje nuostolius (sulaužytą, sugadintą inventorių, turtą).",
    "Priimame svečius tik ramiam poilsiui, todėl prašome gerbti aplinkinių ramybę, ramybės valandos nuo 24 iki 9 valandos.",
    "RŪKYTI VIDUJE DRAUDŽIAMA. Rūkant lauke, nuorūkas mesti tik į tam skirtas talpas terasoje.",
    "Nepjaustyti ant stalo ar stalviršių, naudoti pjaustymo lenteles.",
    "Orkaitėje naudoti kepimo popierių ar foliją.",
    "Naudotis elektros prietaisais laikantis saugumo reikalavimų, neleisti jais naudotis vaikams. Nepalikti be priežiūros įjungtų elektros prietaisų. Prašome išjungti visas šviesas ir užsukti vandens čiaupus prieš paliekant apartamentus.",
    "Antklodės, rankšluosčiai ir kitas kambarių inventorius negali buti naudojamas pliaže ar iškyloje lauke.",
  ];
  const jacuzzi = [
    "Jei jacuzzi paslauga neapmokėta, ja naudotis griežtai draudžiama!",
    "Jacuzzi naudojimosi laikas nuo 18 val iki 24 val.",
    "Jacuzzi nėra skirta prausimuisi, todėl prieš naudojantis ja, rekomenduojame nusiprausti duše",
    "Nedėvėti papuošalų ir aksesuarų (žiedų, apyrankių, grandinėlių, laikrodžių...) dėl galimybės juos prarasti bei sugadinti jacuzzi siurblius...turėsite padengti taisymo išlaidas...€",
    "Draudžiama naudotis jacuzzi išsitepus bet kokiais kremais ar aliejais,",
    "Nevalgyti ir negerti sūkurinėje vonioje ir nepilti į ją jokių skysčių, nei šampūno, muilo... - taip galite sugadinti filtravimo sistemą bei siurblius ir turėsite padengti taisymo išlaidas ...€...",
    "Draudžiama atidaryti jacuzzi dangtį naudojant grilių – šašlykinę,",
    "Po kiekvieno naudojimosi sūkurine vonia BŪTINA uždaryti dangtį.",
  ];

  return header + rulesList(rules) + jacuzziList(jacuzzi) + baseFooter(params.notes);
}

// -------------------- EMAIL B (any other house) --------------------
export function BookingReminderEmailHtml_B(params: BookingReminderEmailParams): string {
  const header = baseHeader(params, { title: `Hi ${params.guestName}, important info for your stay` });
  const rules = [
    // Based on RubikiaiLux_Sutartis.pdf
    "Apgyvendinimo para prasideda 16 val., baigiasi kitos dienos 11 val.",
    "Atvykus reikia sumokėti likusią rezervacijos sumą.",
    "Atvykti su augintiniais griežtai draudžiama. Visgi atvykus, bus paprašyta išvykti. Mokėjimas nebus grąžinamas.",
    "Neišstumdyti baldų ir neperdėti daiktų į ne jiems skirtas vietas. Palaikyti apartamentuose tvarką ir švarą. Viskas yra idealaus stovio ir mes norėtumėme tai išlaikyti.",
    "Prašome saugoti musų turtą. Jei inventorius sulaužomas, sudaužomas ar kitaip sugadinamas - informuoti ir atsiskaityti reikia iš karto. Jeigu minėtą žalą padaro nepilnamečiai vaikai, materialiai už juos atsako jų tėvai ar globėjai, o šiems atsisakius žalą atlygina – visais atvejais Klientas.",
    "Jei Klientas ar su juo atvykę asmenys atvyksta su nepilnamečiais vaikais - privalo rūpintis jais, t.y. nepalikti jų be priežiūros, ir pilnai atsako patys už jų saugumą bei pilnai materialiai atsako už vaikų padarytus sodyboje nuostolius (sulaužytą, sugadintą inventorių, turtą).",
    "Priimame svečius tik ramiam poilsiui, todėl prašome gerbti aplinkinių ramybę, ramybės valandos nuo 24 iki 9 valandos.",
    "RŪKYTI VIDUJE DRAUDŽIAMA. Rūkant lauke, nuorūkas mesti tik į tam skirtas talpas terasoje.",
    "Nepjaustyti ant stalo ar stalviršių, naudoti pjaustymo lenteles.",
    "Orkaitėje naudoti kepimo popierių ar foliją.",
    "Naudotis elektros prietaisais laikantis saugumo reikalavimų, neleisti jais naudotis vaikams. Nepalikti be priežiūros įjungtų elektros prietaisų. Prašome išjungti visas šviesas ir užsukti vandens čiaupus prieš paliekant apartamentus.",
    "Kambaryje esančia krosnelę kūrenti tik leidus sodybos šeimininkui ir išklausius instruktažą.",
    "Nedėti daiktų ant krosnelės, nekūrenti krosnelės buitinėmis atliekomis.",
    "Laikytis saugaus atstumo nuo įkaitusios krosnelės, bei nepalikti kūrentis be priežiūros.",
    "Antklodės, rankšluosčiai ir kitas kambarių inventorius negali buti naudojamas pliaže ar iškyloje lauke.",
    "Nemaitinti elnių danielių kitu maistu, tik vaisiais ar daržovėmis.",
  ];
  const jacuzzi = [
    "Jei jacuzzi paslauga neapmokėta, ja naudotis griežtai draudžiama!",
    "Jacuzzi naudojimosi laikas nuo 18 val iki 24 val.",
    "Jacuzzi nėra skirta prausimuisi, todėl prieš naudojantis ja, rekomenduojame nusiprausti duše !!!",
    "Griežtai draužiama šokinėti į ir iš Jacuzzi.",
    "Nedėvėti papuošalų ir aksesuarų (žiedų, apyrankių, grandinėlių, laikrodžių...) dėl galimybės juos prarasti bei sugadinti jacuzzi siurblius...turėsite padengti taisymo išlaidas...€",
    "Draudžiama naudotis jacuzzi išsitepus bet kokiais kremais ar aliejais.",
    "Nevalgyti ir negerti sūkurinėje vonioje ir nepilti į ją jokių skysčių, nei šampūno, muilo... - taip galite sugadinti filtravimo sistemą bei siurblius ir turėsite padengti taisymo išlaidas ...€..",
    "Draudžiama atidaryti jacuzzi dangtį naudojant grilių – šašlykinę,",
    "Po kiekvieno naudojimosi sūkurine vonia BŪTINA uždaryti dangtį.",
  ];

  return header + rulesList(rules) + jacuzziList(jacuzzi) + baseFooter(params.notes);
}