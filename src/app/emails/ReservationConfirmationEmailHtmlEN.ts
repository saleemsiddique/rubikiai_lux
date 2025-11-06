import { formatCurrency } from "@/lib/currency";

type ReservationConfirmationEmailParams = {
  reservationId: string;
  guestName: string;
  bookingDate: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomType: string;
  guests: number;
  // NUEVOS CAMPOS SIMPLIFICADOS:
  paidNow: number; // lo que se pagó ahora
  payAtArrival: number; // lo que queda por pagar
  totalStay: number; // total de la estancia
  discountApplied?: number; // lo descontado del cupón/porcentaje
  currency?: string;
  hotelName?: string;
  hotelContactEmail?: string;
  hotelContactPhone?: string;
  logoCid?: string;
};

export function ReservationConfirmationEmailHtmlEN(
  params: ReservationConfirmationEmailParams
): string {
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

  const hasDiscount = discountApplied > 0;
  const totalBeforeDiscount = totalStay + discountApplied;

  return `
  <div style="margin:0;padding:0;background:#f4efe9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4efe9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <!-- Card -->
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:16px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;border:1px solid #e9e2d9;">
            <!-- Header / Logo -->
            <tr>
              <td align="center" style="padding:28px 28px 8px;">
                <img src="cid:${logoCid}" width="180" height="auto" alt="${hotelName}" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:auto;">
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td align="center" style="padding:0 28px 6px;">
                <div style="font:700 28px/1.25 Georgia,'Times New Roman',Times,serif;color:#214235;letter-spacing:1px;text-transform:uppercase;">
                  Reservation Confirmation
                </div>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td align="center" style="padding:8px 28px 0;">
                <div style="height:3px;width:120px;background:#bfa58b;border-radius:2px;"></div>
              </td>
            </tr>

            <!-- Intro copy -->
            <tr>
              <td align="center" style="padding:16px 28px 6px;">
                <div style="font:500 16px/1.6 Inter,Arial,sans-serif;color:#334155;">
                  Thank you, <strong>${guestName}</strong>. Your reservation is confirmed.
                </div>
              </td>
            </tr>

            <!-- Booking summary -->
            <tr>
              <td style="padding:18px 24px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #efe7dc;border-radius:12px;background:#fffcf8;">
                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #efe7dc;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Booking</div>
                      <div style="font:600 16px/1.4 Inter,Arial,sans-serif;color:#0f172a;">
                        <div>ID: <span style="color:#214235;">${reservationId}</span></div>
                        <div>Booking date: <span style="color:#214235;">${bookingDate}</span></div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #efe7dc;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Stay details</div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        <div>Check-in: <strong>${checkIn}</strong> &nbsp; | &nbsp; Check-out: <strong>${checkOut}</strong></div>
                        <div>Nights: <strong>${nights}</strong> &nbsp; | &nbsp; Guests: <strong>${guests}</strong></div>
                        <div>Room type: <strong>${roomType}</strong></div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 18px;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Payment Summary</div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        ${
                          hasDiscount
                            ? `
                        <div style="margin-top:6px;font-size:16px;color:#64748b;">
                          Total before discount: <strong>${formatCurrency(totalBeforeDiscount, currency)}</strong>
                        </div>
                        <div style="margin-top:6px;font-size:15px;color:#16a34a;">
                          Discount applied: <strong>-${formatCurrency(discountApplied, currency)}</strong>
                        </div>
                        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #efe7dc;"></div>
                        `
                            : ""
                        }
                        <div style="margin-top:6px;font-size:16px;color:#0f172a;">
                          Amount paid now: <strong style="color:#059669;">${formatCurrency(paidNow, currency)}</strong>
                        </div>
                        <div style="margin-top:6px;font-size:16px;color:#0f172a;">
                          To be paid at arrival: <strong style="color:#dc2626;">${formatCurrency(payAtArrival, currency)}</strong>
                        </div>
                        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #efe7dc;font-size:18px;color:#214235;">
                          Total stay: <strong>${formatCurrency(totalStay, currency)}</strong>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Actions / Contact -->
            <tr>
              <td style="padding:12px 24px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:10px 0;">
                      <div style="font:700 16px/1.3 Georgia,'Times New Roman',Times,serif;color:#214235;">Need help?</div>
                      <div style="font:400 13px/1.6 Inter,Arial,sans-serif;color:#6b7280;">
                        If you need to modify or cancel your reservation, contact us at <a href="mailto:${hotelContactEmail}" style="color:#214235;text-decoration:none;">${hotelContactEmail}</a>
                        ${hotelContactPhone ? `or call us at ${hotelContactPhone}.` : "."}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Reminder notice (replaces payment breakdown) -->
            <tr>
              <td style="padding:12px 24px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;background:#fffcf8;overflow:hidden;">
                  <tr>
                    <td style="padding:14px 18px;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Important</div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        <div style="margin-bottom:8px;">
                          We'll send you a reminder email closer to your arrival date with further details — check-in instructions, directions, and reservation tips.
                        </div>
                        <div style="margin-top:10px;font-size:14px;color:#6b7280;">
                          If you need assistance before then, contact us at <a href="mailto:${hotelContactEmail}" style="color:#214235;text-decoration:none;">${hotelContactEmail}</a>${hotelContactPhone ? ` or call ${hotelContactPhone}` : ""}.
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>


            <!-- Footer note -->
            <tr>
              <td style="padding:0 28px 28px;">
                <div style="font:400 12px/1.6 Inter,Arial,sans-serif;color:#6b7280;">
                  Your reservation is subject to Rubikiai Lux terms and conditions. If you have questions, reply to this email or write to <a href="mailto:${hotelContactEmail}" style="color:#214235;text-decoration:none;">${hotelContactEmail}</a>.
                </div>
              </td>
            </tr>
          </table>
          <!-- /Card -->
        </td>
      </tr>
    </table>
  </div>
  `;
}
