// app/emails/OwnerReservationNotificationEmailHtmlEN.ts
import { formatCurrency } from "@/lib/currency";

type OwnerReservationNotificationEmailParams = {
  reservationId: string;
  guestName?: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  bookingDate?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomType?: string;
  guests: number;
  paidNow: number;
  payAtArrival: number;
  totalStay: number;
  discountApplied?: number;
  currency?: string;
  propertyName?: string;
  propertyId?: string;
  ownerPhone?: string | null;
  paymentMethod?: string | null;
  merchantReference?: string | null; // reservationId from Montonio/Stripe
  notes?: string | null;
  logoCid?: string;
};

export function OwnerReservationNotificationEmailHtmlEN(
  params: OwnerReservationNotificationEmailParams
): string {
  const {
    reservationId,
    guestName = "Guest",
    guestEmail = null,
    guestPhone = null,
    bookingDate = new Date().toISOString().slice(0, 19),
    checkIn,
    checkOut,
    nights,
    roomType = "Accommodation",
    guests,
    paidNow = 0,
    payAtArrival = 0,
    totalStay = 0,
    discountApplied = 0,
    currency = "EUR",
    propertyName = "Property",
    propertyId = "",
    paymentMethod = null,
    merchantReference = null,
    notes = null,
    logoCid = "rubikiai-logo",
  } = params;

  const hasDiscount = Number(discountApplied) > 0;
  const totalBeforeDiscount = totalStay + (Number(discountApplied) || 0);

  return `
  <div style="margin:0;padding:0;background:#f4efe9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4efe9;">
      <tr><td align="center" style="padding:28px 16px;">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e9e2d9;">
          <tr><td align="center" style="padding:22px;"><img src="cid:${logoCid}" width="160" alt="${propertyName}" style="display:block;border:0;"></td></tr>

          <tr><td style="padding:0 28px 12px;text-align:center;">
            <div style="font:700 20px/1.2 Georgia,serif;color:#214235;text-transform:uppercase;">New Reservation — ${propertyName}</div>
            <div style="font:400 13px/1.4 Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">Reservation ID: <strong style="color:#214235">${reservationId}</strong></div>
          </td></tr>

          <tr><td style="padding:12px 28px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #efe7dc;border-radius:10px;background:#fffcf8;">
              <tr><td style="padding:12px 14px;border-bottom:1px solid #efe7dc;">
                <div style="font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;margin-bottom:6px;">Guest</div>
                <div style="font-size:15px;color:#0f172a;">
                  <div>Name: <strong>${guestName}</strong></div>
                  ${guestEmail ? `<div>Email: <strong>${guestEmail}</strong></div>` : ""}
                  ${guestPhone ? `<div>Phone: <strong>${guestPhone}</strong></div>` : ""}
                </div>
              </td></tr>

              <tr><td style="padding:12px 14px;border-bottom:1px solid #efe7dc;">
                <div style="font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;margin-bottom:6px;">Stay details</div>
                <div style="font-size:15px;color:#0f172a;">
                  <div>Check-in: <strong>${checkIn}</strong> — Check-out: <strong>${checkOut}</strong></div>
                  <div>Nights: <strong>${nights}</strong> | Guests: <strong>${guests}</strong></div>
                  <div>Room type: <strong>${roomType}</strong></div>
                  ${propertyId ? `<div>Property ID: <strong>${propertyId}</strong></div>` : ""}
                </div>
              </td></tr>

              <tr><td style="padding:12px 14px;">
                <div style="font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;margin-bottom:6px;">Payment</div>
                <div style="font-size:15px;color:#0f172a;">
                  ${hasDiscount ? `<div>Total before discount: <strong>${formatCurrency(totalBeforeDiscount, currency)}</strong></div>
                  <div>Discount applied: <strong>-${formatCurrency(discountApplied, currency)}</strong></div>` : ""}
                  <div>Amount paid now: <strong>${formatCurrency(paidNow, currency)}</strong></div>
                  <div>To be paid at arrival: <strong>${formatCurrency(payAtArrival, currency)}</strong></div>
                  <div style="margin-top:8px;font-weight:700;color:#214235;">Total stay: ${formatCurrency(totalStay, currency)}</div>
                  ${paymentMethod ? `<div style="margin-top:8px;">Payment method: <strong>${paymentMethod}</strong></div>` : ""}
                  ${merchantReference ? `<div>Merchant ref: <strong>${merchantReference}</strong></div>` : ""}
                </div>
              </td></tr>
            </table>
          </td></tr>

          ${notes ? `<tr><td style="padding:12px 28px;"><div style="font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;margin-bottom:6px;">Notes</div><div style="font-size:14px;color:#0f172a;">${notes}</div></td></tr>` : ""}
        </table>
      </td></tr>
    </table>
  </div>
  `;
}
