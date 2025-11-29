import { BookingReminderParams } from '@/lib/emailTemplates';

export function BookingReminderEmailHtml_en(params: BookingReminderParams): string {
  const { guestName, reservationId, houseName, startDate, endDate, guests, totalPrice } = params;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reminder about your reservation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #2a4850 0%, #3a5860 100%); padding: 40px 20px;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">Rubikiai Lux</h1>
                    <p style="color: #d4b996; font-size: 16px; margin: 10px 0 0 0;">Reminder about your reservation</p>
                  </td>
                </tr>

                <!-- Greeting -->
                <tr>
                  <td style="padding: 40px 40px 20px 40px;">
                    <h2 style="color: #2a4850; font-size: 24px; margin: 0 0 20px 0;">Hello, ${guestName}!</h2>
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">
                      We wanted to remind you that your visit is coming up soon! We look forward to welcoming you!
                    </p>
                  </td>
                </tr>

                <!-- Reservation Details -->
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 8px; padding: 20px;">
                      <tr>
                        <td>
                          <h3 style="color: #2a4850; font-size: 18px; margin: 0 0 15px 0; border-bottom: 2px solid #d4b996; padding-bottom: 10px;">Your Reservation Details</h3>

                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Reservation No.:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${reservationId}</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Property:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${houseName}</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Check-in:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${startDate} (from 4:00 PM)</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Check-out:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${endDate} (until 11:00-12:00)</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Number of Guests:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${guests}</td>
                            </tr>
                            <tr style="border-top: 2px solid #d4b996;">
                              <td style="color: #666666; font-size: 14px; padding: 12px 0 8px 0;">Total Price:</td>
                              <td style="color: #2a4850; font-size: 16px; font-weight: 700; text-align: right; padding: 12px 0 8px 0;">€${totalPrice.toFixed(2)}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Important Info -->
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff8e1; border-left: 4px solid #d4b996; border-radius: 4px; padding: 20px;">
                      <tr>
                        <td>
                          <h4 style="color: #2a4850; font-size: 16px; margin: 0 0 10px 0;">Important for Your Visit</h4>
                          <ul style="color: #666666; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                            <li>Check-in time from <strong>4:00 PM</strong></li>
                            <li>Check-out time until <strong>12:00 PM</strong> (Lake House) or <strong>11:00 AM</strong> (Duplexes)</li>
                            <li>Pets not allowed for the safety of the fallow deer</li>
                            <li>You can feed the deer only with fruits and vegetables</li>
                            <li>If you have any questions or special requests, don't hesitate to reach out</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Call to Action -->
                <tr>
                  <td align="center" style="padding: 0 40px 40px 40px;">
                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                      We look forward to seeing you soon!
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                      If you have any questions, please contact us:
                    </p>
                    <p style="color: #2a4850; font-size: 14px; margin: 5px 0;">
                      <strong>Phone:</strong> <a href="tel:+37064632972" style="color: #d4b996; text-decoration: none;">+370 646 32 972</a>
                    </p>
                    <p style="color: #2a4850; font-size: 14px; margin: 5px 0;">
                      <strong>Email:</strong> <a href="mailto:info@rubikiailux.lt" style="color: #d4b996; text-decoration: none;">info@rubikiailux.lt</a>
                    </p>
                    <p style="color: #999999; font-size: 12px; margin: 20px 0 0 0;">
                      © ${new Date().getFullYear()} Rubikiai Lux. All rights reserved.
                    </p>
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
