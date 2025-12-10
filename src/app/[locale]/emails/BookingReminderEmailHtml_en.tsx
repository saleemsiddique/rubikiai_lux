import { BookingReminderParams } from '@/lib/emailTemplates';
import dayjs from "dayjs";

const PROPERTY_NAME_MAP: Record<string, string> = {
  "L0TeFf2LmrWGAaAyS8NY": "Lake House",
  "PZwbfMYlSXj61uYYJutg": "Near Deer Enclosure",
  "oDzv9346CdaAsok162sX": "Deer Panorama",
};

export function BookingReminderEmailHtml_en(params: BookingReminderParams): string {
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

  // Reglas específicas según variante (EN)
  const rulesA_EN = [
    "Accommodation hours: check-in from 4:00 PM, check-out by 12:00 PM the next day.",
    "Upon arrival, you must pay the remaining reservation amount.",
    "Arriving with pets is strictly prohibited. If you arrive anyway, you will be asked to leave. No refund will be given.",
    "Do not move furniture or relocate items to places they don't belong. Keep the apartments tidy and clean. Everything is in ideal condition and we would like to maintain that.",
    "Please take care of our property. If inventory is broken, damaged, or otherwise harmed - inform and settle immediately. If such damage is caused by minors, their parents or guardians are financially responsible, and if they refuse, the Client is liable in all cases.",
    "If the Client arrives with minors - must care for them, i.e. not leave them unattended, and is fully responsible for their safety and fully financially liable for damage caused by children at the property (broken, damaged inventory, property).",
    "We accept guests only for peaceful rest, so please respect the peace of neighbors, quiet hours from 12:00 AM to 9:00 AM.",
    "SMOKING INDOORS IS PROHIBITED. When smoking outdoors, dispose of cigarette butts only in designated containers on the terrace.",
    "Do not cut on tables or countertops, use cutting boards.",
    "Use baking paper or foil in the oven.",
    "Use electrical appliances according to safety requirements, do not let children use them. Do not leave electrical appliances on unattended. Please turn off all lights and turn off water taps before leaving the apartments.",
    "Blankets, towels, and other room inventory may not be used at the beach or outdoor picnic.",
  ];

  const rulesB_EN = [
    "Accommodation hours: check-in from 4:00 PM, check-out by 11:00 AM the next day.",
    "Upon arrival, you must pay the remaining reservation amount.",
    "Arriving with pets is strictly prohibited. If you arrive anyway, you will be asked to leave. No refund will be given.",
    "Do not move furniture or relocate items to places they don't belong. Keep the apartments tidy and clean. Everything is in ideal condition and we would like to maintain that.",
    "Please take care of our property. If inventory is broken, damaged, or otherwise harmed - inform and settle immediately. If such damage is caused by minors, their parents or guardians are financially responsible, and if they refuse, the Client is liable in all cases.",
    "If the Client or anyone accompanying them arrives with minors - must care for them, i.e. not leave them unattended, and is fully responsible for their safety and fully financially liable for damage caused by children at the property (broken, damaged inventory, property).",
    "We accept guests only for peaceful rest, so please respect the peace of neighbors, quiet hours from 12:00 AM to 9:00 AM.",
    "SMOKING INDOORS IS PROHIBITED. When smoking outdoors, dispose of cigarette butts only in designated containers on the terrace.",
    "Do not cut on tables or countertops, use cutting boards.",
    "Use baking paper or foil in the oven.",
    "Use electrical appliances according to safety requirements, do not let children use them. Do not leave electrical appliances on unattended. Please turn off all lights and turn off water taps before leaving the apartments.",
    "Light the stove only with permission from the property owner and after listening to instructions.",
    "Do not place items on the stove, do not burn household waste in the stove.",
    "Maintain a safe distance from the hot stove and do not leave it burning unattended.",
    "Blankets, towels, and other room inventory may not be used at the beach or outdoor picnic.",
    "Feed the fallow deer only with fruits or vegetables, no other food.",
  ];

  const jacuzziRules_EN = [
    "If the jacuzzi service has not been paid for, using it is strictly prohibited!",
    "Jacuzzi usage time from 6:00 PM to 12:00 AM.",
    "The jacuzzi is not for washing, so we recommend showering before using it!!!",
    ...(variant === "A" ? [] : ["Jumping into and out of the jacuzzi is strictly prohibited."]),
    "Do not wear jewelry and accessories (rings, bracelets, necklaces, watches...) due to the possibility of losing them and damaging jacuzzi pumps...you will have to cover repair costs...€",
    "Using the jacuzzi after applying any creams or oils is prohibited.",
    "Do not eat or drink in the whirlpool tub and do not pour any liquids, shampoo, soap... into it - this can damage the filtration system and pumps and you will have to cover repair costs ...€...",
    "Opening the jacuzzi cover while using the grill is prohibited.",
    "After each use of the whirlpool tub, CLOSING THE COVER IS MANDATORY.",
  ];

  const selectedRules = variant === "A" ? rulesA_EN : rulesB_EN;

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
                  Hi ${guestName}, important info for your stay
                </div>
                <div style="height:3px;width:96px;background:#bfa58b;border-radius:2px;margin-top:10px;"></div>
              </td>
            </tr>

            <!-- Main copy -->
            <tr>
              <td style="padding:14px 22px 6px;">
                <div style="font:500 15px Inter,Arial,sans-serif;color:#334155;line-height:1.6;">
                  We're excited to host you at <strong>${displayName}</strong> on <strong>${checkInFmt}</strong>${checkOut ? ` until ${checkOutFmt}` : ""}. We recommend bringing rubber (beach) slippers to walk on the terrace to the jacuzzi. Will you be using the grill, 10€ (firewood, coal, grates, skewers, tools...)? Drive carefully, there are many wild animals in our area <br/><br/>Please review the house information and rules below.
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

            <!-- House Rules (LT version - kept in Lithuanian as per user's request) -->
            <tr>
              <td style="padding:6px 22px 0;">
                <div style="font:700 18px Georgia, 'Times New Roman', serif;color:#214235;">House Rules</div>
                <div style="font:500 14px Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">Please read carefully</div>
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
                <div style="font:700 18px Georgia, 'Times New Roman', serif;color:#214235;">Jacuzzi Rules</div>
                <div style="font:500 14px Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">Usage information</div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 22px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
                  <tbody>
                    <tr>
                      <td style="padding:12px 14px;font:14px/1.6 Inter, Arial, sans-serif;color:#334155;">
                        <ul style="margin:0;padding-left:18px;">
                          ${jacuzziRules_EN.map((rule) => `<li style="margin:6px 0;">${rule}</li>`).join("")}
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

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
