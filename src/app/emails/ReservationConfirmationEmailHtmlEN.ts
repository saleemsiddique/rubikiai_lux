import { formatCurrency } from "@/lib/currency";

type ReservationConfirmationEmailParams = {
  reservationId: string;
  guestName: string;
  bookingDate: string; // ISO YYYY-MM-DD or full datetime string
  checkIn: string; // ISO YYYY-MM-DD
  checkOut: string; // ISO YYYY-MM-DD
  nights: number;
  roomType: string;
  guests: number;
  unitAmount: number; // price per night
  taxes?: number; // optional
  fees?: number; // optional
  totalAmount?: number; // optionally precomputed
  currency?: string;
  paymentMethod?: string; // e.g. "Card **** 4242"
  hotelName?: string;
  hotelContactEmail?: string;
  hotelContactPhone?: string;
  logoCid?: string; // default 'rubikiai-logo'
};

export function ReservationConfirmationEmailHtmlEN(params: ReservationConfirmationEmailParams): string {
  const {
    reservationId,
    guestName,
    bookingDate,
    checkIn,
    checkOut,
    nights,
    roomType,
    guests,
    unitAmount,
    taxes = 0,
    fees = 0,
    totalAmount,
    currency = "EUR",
    paymentMethod = "—",
    hotelName = "Rubikiai Lux",
    hotelContactEmail = "info@rubikiailux.lt",
    hotelContactPhone = "",
    logoCid = "rubikiai-logo",
  } = params;

  const subtotal = unitAmount * nights;
  const calculatedTotal = typeof totalAmount === "number" ? totalAmount : subtotal + (taxes ?? 0) + (fees ?? 0);

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
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Payment</div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        <div>Price per night: <strong>${formatCurrency(unitAmount, currency)}</strong></div>
                        <div>Subtotal: <strong>${formatCurrency(subtotal, currency)}</strong></div>
                        <div>Taxes: <strong>${formatCurrency(taxes, currency)}</strong></div>
                        <div>Additional fees: <strong>${formatCurrency(fees, currency)}</strong></div>
                        <div style="margin-top:8px;font-size:18px;color:#214235;">Total: <strong>${formatCurrency(calculatedTotal, currency)}</strong></div>
                        <div style="margin-top:6px;font-size:14px;color:#475569;">Payment method: <strong>${paymentMethod}</strong></div>
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

            <!-- Small receipt / breakdown table (optional) -->
            <tr>
              <td style="padding:8px 24px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:12px 14px;background:#faf7f2;border-bottom:1px solid #eee;font:700 12px/1 Inter,Arial,sans-serif;color:#6b7280;letter-spacing:.5px;text-transform:uppercase;">Description</th>
                      <th align="right" style="padding:12px 14px;background:#faf7f2;border-bottom:1px solid #eee;font:700 12px/1 Inter,Arial,sans-serif;color:#6b7280;letter-spacing:.5px;text-transform:uppercase;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td align="left" style="padding:12px 14px;border-bottom:1px solid #eee;">${nights} × ${roomType} (per night)</td>
                      <td align="right" style="padding:12px 14px;border-bottom:1px solid #eee;">${formatCurrency(subtotal, currency)}</td>
                    </tr>
                    <tr>
                      <td align="left" style="padding:12px 14px;border-bottom:1px solid #eee;">Taxes</td>
                      <td align="right" style="padding:12px 14px;border-bottom:1px solid #eee;">${formatCurrency(taxes, currency)}</td>
                    </tr>
                    <tr>
                      <td align="left" style="padding:12px 14px;border-bottom:1px solid #eee;">Additional fees</td>
                      <td align="right" style="padding:12px 14px;border-bottom:1px solid #eee;">${formatCurrency(fees, currency)}</td>
                    </tr>
                    <tr>
                      <td align="left" style="padding:12px 14px;font:700 14px/1 Inter,Arial,sans-serif;color:#0f172a;">Total</td>
                      <td align="right" style="padding:12px 14px;font:700 14px/1 Inter,Arial,sans-serif;color:#214235;">${formatCurrency(calculatedTotal, currency)}</td>
                    </tr>
                  </tbody>
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
