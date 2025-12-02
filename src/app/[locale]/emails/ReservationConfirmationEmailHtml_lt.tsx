import { ReservationConfirmationParams } from '@/lib/emailTemplates';
import { formatCurrency } from "@/lib/currency";

export function ReservationConfirmationEmailHtml_lt(params: ReservationConfirmationParams): string {
  const {
    reservationId,
    guestName,
    bookingDate,
    checkIn,
    checkOut,
    nights,
    roomType,
    guests,
    paidNow = 0,
    payAtArrival = 0,
    totalStay = 0,
    discountApplied = 0,
    currency = "EUR",
    hotelName = "Rubikiai Lux",
    hotelContactEmail = "info@rubikiailux.lt",
    hotelContactPhone = "",
    logoCid = "rubikiai-logo",
  } = params;

  // Mapping de IDs a nombres legibles
  const PROPERTY_NAME_MAP: Record<string, string> = {
    "L0TeFf2LmrWGAaAyS8NY": "Ežero Namelis",
    "PZwbfMYlSXj61uYYJutg": "Šalia Elnių Aptvaro",
    "oDzv9346CdaAsok162sX": "Elnių Panorama",
  };

  const readableRoomType = PROPERTY_NAME_MAP[roomType] || roomType;
  const hasDiscount = discountApplied > 0;
  const totalBeforeDiscount = totalStay + discountApplied;

  return `
  <div style="margin:0;padding:0;background:#f4efe9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4efe9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:16px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;border:1px solid #e9e2d9;">
            <tr>
              <td align="center" style="padding:28px 28px 8px;">
                <img src="cid:${logoCid}" width="180" height="auto" alt="${hotelName}" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:auto;">
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:0 28px 6px;">
                <div style="font:700 28px/1.25 Georgia,'Times New Roman',Times,serif;color:#214235;letter-spacing:1px;text-transform:uppercase;">
                  Rezervacijos patvirtinimas
                </div>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:8px 28px 0;">
                <div style="height:3px;width:120px;background:#bfa58b;border-radius:2px;"></div>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:16px 28px 6px;">
                <div style="font:500 16px/1.6 Inter,Arial,sans-serif;color:#334155;">
                  Dėkojame, <strong>${guestName}</strong>. Jūsų rezervacija patvirtinta.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 24px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #efe7dc;border-radius:12px;background:#fffcf8;">
                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #efe7dc;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Rezervacija</div>
                      <div style="font:600 16px/1.4 Inter,Arial,sans-serif;color:#0f172a;">
                        <div>ID: <span style="color:#214235;">${reservationId}</span></div>
                        <div>Rezervacijos data: <span style="color:#214235;">${bookingDate}</span></div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #efe7dc;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Apsilankymo informacija</div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        <div>Atvykimas: <strong>${checkIn}</strong> &nbsp; | &nbsp; Išvykimas: <strong>${checkOut}</strong></div>
                        <div>Naktys: <strong>${nights}</strong> &nbsp; | &nbsp; Svečiai: <strong>${guests}</strong></div>
                        <div>Namelio pavadinimas: <strong>${readableRoomType}</strong></div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 18px;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Mokėjimo suvestinė</div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        ${hasDiscount ? `
                        <div style="margin-top:6px;font-size:16px;color:#64748b;">
                          Suma prieš nuolaidą: <strong>${formatCurrency(totalBeforeDiscount, currency)}</strong>
                        </div>
                        <div style="margin-top:6px;font-size:15px;color:#16a34a;">
                          Pritaikyta nuolaida: <strong>-${formatCurrency(discountApplied, currency)}</strong>
                        </div>
                        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #efe7dc;"></div>
                        ` : ""}
                        <div style="margin-top:6px;font-size:16px;color:#0f172a;">
                          Sumokėta dabar: <strong style="color:#059669;">${formatCurrency(paidNow, currency)}</strong>
                        </div>
                        <div style="margin-top:6px;font-size:16px;color:#0f172a;">
                          Mokėti atvykus: <strong style="color:#dc2626;">${formatCurrency(payAtArrival, currency)}</strong>
                        </div>
                        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #efe7dc;font-size:18px;color:#214235;">
                          Bendra suma: <strong>${formatCurrency(totalStay, currency)}</strong>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 24px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:10px 0;">
                      <div style="font:700 16px/1.3 Georgia,'Times New Roman',Times,serif;color:#214235;">Reikia pagalbos?</div>
                      <div style="font:400 13px/1.6 Inter,Arial,sans-serif;color:#6b7280;">
                        Jei reikia keisti ar atšaukti rezervaciją, susisiekite su mumis <a href="mailto:${hotelContactEmail}" style="color:#214235;text-decoration:none;">${hotelContactEmail}</a>${hotelContactPhone ? ` arba skambinkite ${hotelContactPhone}.` : "."}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 24px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;background:#fffcf8;overflow:hidden;">
                  <tr>
                    <td style="padding:14px 18px;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Svarbu</div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        <div style="margin-bottom:8px;">
                          Arčiau atvykimo datos atsiųsime priminimo laišką su papildoma informacija — atvykimo instrukcijos, nuorodos ir rezervacijos patarimai.
                        </div>
                        <div style="margin-top:10px;font-size:14px;color:#6b7280;">
                          Jei prireiks pagalbos anksčiau, susisiekite <a href="mailto:${hotelContactEmail}" style="color:#214235;text-decoration:none;">${hotelContactEmail}</a>${hotelContactPhone ? ` arba skambinkite ${hotelContactPhone}` : ""}.
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 28px;">
                <div style="font:400 12px/1.6 Inter,Arial,sans-serif;color:#6b7280;">
                  Jūsų rezervacija taikoma Rubikiai Lux sąlygoms. Jei turite klausimų, atsakykite į šį laišką arba rašykite <a href="mailto:${hotelContactEmail}" style="color:#214235;text-decoration:none;">${hotelContactEmail}</a>.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `;
}
