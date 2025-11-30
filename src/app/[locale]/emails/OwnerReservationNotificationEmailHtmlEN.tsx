/* eslint-disable @typescript-eslint/no-explicit-any */
export function OwnerReservationNotificationEmailHtmlEN(params: any): string {
  const {
    reservationId,
    guestName,
    guestEmail,
    guestPhone,
    checkIn,
    checkOut,
    nights,
    roomType,
    guests,
    paidNow,
    payAtArrival,
    totalStay,
    discountApplied = 0,
    currency = "EUR",
    propertyName,
    paymentMethod,
    merchantReference,
    notes,
  } = params;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Reservation - ${reservationId}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 30px;">
                <tr>
                  <td>
                    <h1 style="color: #2a4850; margin: 0 0 20px 0;">New Reservation</h1>
                    <h2 style="color: #d4b996; margin: 0 0 30px 0;">ID: ${reservationId}</h2>

                    <h3 style="color: #2a4850; margin: 20px 0 10px 0;">Guest Information</h3>
                    <table width="100%" cellpadding="5" style="border-collapse: collapse;">
                      <tr><td style="padding: 5px 0;"><strong>Name:</strong></td><td>${guestName || 'N/A'}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Email:</strong></td><td>${guestEmail || 'N/A'}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Phone:</strong></td><td>${guestPhone || 'N/A'}</td></tr>
                    </table>

                    <h3 style="color: #2a4850; margin: 20px 0 10px 0;">Reservation Details</h3>
                    <table width="100%" cellpadding="5" style="border-collapse: collapse;">
                      <tr><td style="padding: 5px 0;"><strong>Property:</strong></td><td>${roomType || propertyName || 'N/A'}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Check-in:</strong></td><td>${checkIn}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Check-out:</strong></td><td>${checkOut}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Nights:</strong></td><td>${nights}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Guests:</strong></td><td>${guests}</td></tr>
                    </table>

                    <h3 style="color: #2a4850; margin: 20px 0 10px 0;">Payment Details</h3>
                    <table width="100%" cellpadding="5" style="border-collapse: collapse;">
                      <tr><td style="padding: 5px 0;"><strong>Total:</strong></td><td>${currency} ${totalStay.toFixed(2)}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Paid now:</strong></td><td>${currency} ${paidNow.toFixed(2)}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Pay at arrival:</strong></td><td>${currency} ${payAtArrival.toFixed(2)}</td></tr>
                      ${discountApplied > 0 ? `<tr><td style="padding: 5px 0;"><strong>Discount applied:</strong></td><td>${currency} ${discountApplied.toFixed(2)}</td></tr>` : ''}
                      ${paymentMethod ? `<tr><td style="padding: 5px 0;"><strong>Payment method:</strong></td><td>${paymentMethod}</td></tr>` : ''}
                      ${merchantReference ? `<tr><td style="padding: 5px 0;"><strong>Reference:</strong></td><td>${merchantReference}</td></tr>` : ''}
                    </table>

                    ${notes ? `
                      <h3 style="color: #2a4850; margin: 20px 0 10px 0;">Notes</h3>
                      <p style="color: #666; white-space: pre-wrap;">${notes}</p>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
