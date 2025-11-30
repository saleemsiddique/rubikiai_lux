import { BookingReminderParams } from '@/lib/emailTemplates';
import dayjs from "dayjs";

const PROPERTY_NAME_MAP: Record<string, string> = {
  "L0TeFf2LmrWGAaAyS8NY": "Ezero Namelis",
  "PZwbfMYlSXj61uYYJutg": "Salia-Elniu-Aptvaro",
  "oDzv9346CdaAsok162sX": "Salia-Elniu-Panorama",
};

export function BookingReminderEmailHtml_lt(params: BookingReminderParams): string {
  const {
    guestName,
    houseName,
    checkIn,
    checkOut,
    nGuests = 2,
    variant = "B",
    notes,
    logoCid = "rubikiai-logo",
  } = params;

  const checkInFmt = dayjs(checkIn).format("dddd, MMMM D, YYYY");
  const checkOutFmt = checkOut ? dayjs(checkOut).format("dddd, MMMM D, YYYY") : "";
  const shortDate = dayjs(checkIn).format("DD/MM/YYYY");
  const displayName = PROPERTY_NAME_MAP[houseName] || houseName;

  // Reglas específicas según variante (LT)
  const rulesA_LT = [
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

  const rulesB_LT = [
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

  const jacuzziRules_LT = [
    "Jei jacuzzi paslauga neapmokėta, ja naudotis griežtai draudžiama!",
    "Jacuzzi naudojimosi laikas nuo 18 val iki 24 val.",
    "Jacuzzi nėra skirta prausimuisi, todėl prieš naudojantis ja, rekomenduojame nusiprausti duše !!!",
    ...(variant === "A" ? [] : ["Griežtai draužiama šokinėti į ir iš Jacuzzi."]),
    "Nedėvėti papuošalų ir aksesuarų (žiedų, apyrankių, grandinėlių, laikrodžių...) dėl galimybės juos prarasti bei sugadinti jacuzzi siurblius...turėsite padengti taisymo išlaidas...€",
    "Draudžiama naudotis jacuzzi išsitepus bet kokiais kremais ar aliejais.",
    "Nevalgyti ir negerti sūkurinėje vonioje ir nepilti į ją jokių skysčių, nei šampūno, muilo... - taip galite sugadinti filtravimo sistemą bei siurblius ir turėsite padengti taisymo išlaidas ...€..",
    "Draudžiama atidaryti jacuzzi dangtį naudojant grilių – šašlykinę,",
    "Po kiekvieno naudojimosi sūkurine vonia BŪTINA uždaryti dangtį.",
  ];

  const selectedRules = variant === "A" ? rulesA_LT : rulesB_LT;

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
                      <div>Rezervacijos priminimas</div>
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
                  Sveiki ${guestName}, svarbi informacija apie jūsų apsilankymą
                </div>
                <div style="height:3px;width:96px;background:#bfa58b;border-radius:2px;margin-top:10px;"></div>
              </td>
            </tr>

            <!-- Main copy -->
            <tr>
              <td style="padding:14px 22px 6px;">
                <div style="font:500 15px Inter,Arial,sans-serif;color:#334155;line-height:1.6;">
                  Džiaugiamės galėdami jus priimti <strong>${displayName}</strong> <strong>${checkInFmt}</strong>${checkOut ? ` iki ${checkOutFmt}` : ""}. Prašome peržiūrėti namų informaciją ir taisykles žemiau.
                </div>
              </td>
            </tr>

            <!-- Quick details -->
            <tr>
              <td style="padding:12px 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #f0eadf;border-radius:12px;background:#fffcf9;">
                  <tr>
                    <td style="padding:12px 16px;border-right:1px solid #f0eadf;width:50%;">
                      <div style="font:600 12px Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">Atvykimas</div>
                      <div style="font:600 16px Inter,Arial,sans-serif;color:#0f172a;margin-top:6px;">${checkInFmt}</div>
                    </td>
                    <td style="padding:12px 16px;width:50%;">
                      <div style="font:600 12px Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">Svečiai</div>
                      <div style="font:600 16px Inter,Arial,sans-serif;color:#0f172a;margin-top:6px;">${nGuests}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- House Rules (LT version - kept in Lithuanian as per user's request) -->
            <tr>
              <td style="padding:6px 22px 0;">
                <div style="font:700 18px Georgia, 'Times New Roman', serif;color:#214235;">Namų taisyklės</div>
                <div style="font:500 14px Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">Prašome atidžiai perskaityti</div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 22px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
                  <tbody>
                    <tr>
                      <td style="padding:12px 14px;font:14px/1.6 Inter, Arial, sans-serif;color:#334155;">
                        <ul style="margin:0;padding-left:18px;">
                          ${selectedRules.map((rule) => `<li style="margin:6px 0;">${rule}</li>`).join("")}
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            <!-- Jacuzzi Rules -->
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
                          ${jacuzziRules_LT.map((rule) => `<li style="margin:6px 0;">${rule}</li>`).join("")}
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            ${notes ? `<tr><td style="padding:12px 22px 12px;"><div style="font:600 13px Inter,Arial,sans-serif;color:#6b7280;">Pastabos</div><div style="font:14px Inter,Arial,sans-serif;color:#334155;margin-top:6px;">${notes}</div></td></tr>` : ""}

            <!-- CTA / contact -->
            <tr>
              <td align="center" style="padding:12px 22px 20px;">
                <div style="font:13px Inter,Arial,sans-serif;color:#6b7280;margin-top:10px;">Reikia pagalbos? Atsakykite į šį laišką arba susisiekite <a href="mailto:info@rubikiailux.lt" style="color:#214235;text-decoration:underline;">info@rubikiailux.lt</a>.</div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:12px 22px 28px;border-top:1px solid #f0eadf;">
                <div style="font:400 12px Inter,Arial,sans-serif;color:#6b7280;text-align:center;">
                  Laukiame jūsų apsilankymo. Prašome patikrinti kelionės reikalavimus ir vietos taisykles prieš atvykimą.
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>`;
}
