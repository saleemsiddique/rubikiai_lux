import { ReservationConfirmationParams } from '@/lib/emailTemplates';

export function ReservationConfirmationEmailHtml_lt(params: ReservationConfirmationParams): string {
  const { guestName, reservationId, houseName, startDate, endDate, guests, totalPrice, depositPaid, remainingBalance } = params;

  return `
    <!DOCTYPE html>
    <html lang="lt">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rezervacijos patvirtinimas</title>
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
                    <p style="color: #d4b996; font-size: 16px; margin: 10px 0 0 0;">Rezervacijos patvirtinimas</p>
                  </td>
                </tr>

                <!-- Greeting -->
                <tr>
                  <td style="padding: 40px 40px 20px 40px;">
                    <h2 style="color: #2a4850; font-size: 24px; margin: 0 0 20px 0;">Sveiki, ${guestName}!</h2>
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">
                      Džiaugiamės patvirtinti jūsų rezervaciją. Laukiame jūsų apsilankymo!
                    </p>
                  </td>
                </tr>

                <!-- Reservation Details -->
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 8px; padding: 20px;">
                      <tr>
                        <td>
                          <h3 style="color: #2a4850; font-size: 18px; margin: 0 0 15px 0; border-bottom: 2px solid #d4b996; padding-bottom: 10px;">Rezervacijos informacija</h3>

                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Rezervacijos Nr.:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${reservationId}</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Namelis:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${houseName}</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Atvykimas:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${startDate} (nuo 16:00)</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Išvykimas:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${endDate} (iki 11:00-12:00)</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Svečių skaičius:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${guests}</td>
                            </tr>
                            <tr style="border-top: 2px solid #d4b996;">
                              <td style="color: #666666; font-size: 14px; padding: 12px 0 8px 0;">Bendra kaina:</td>
                              <td style="color: #2a4850; font-size: 16px; font-weight: 700; text-align: right; padding: 12px 0 8px 0;">€${totalPrice.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 4px 0;">Sumokėtas užstatas:</td>
                              <td style="color: #4caf50; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">€${depositPaid.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 4px 0 12px 0;">Mokėti atvykus:</td>
                              <td style="color: #ff9800; font-size: 16px; font-weight: 700; text-align: right; padding: 4px 0 12px 0;">€${remainingBalance.toFixed(2)}</td>
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
                          <h4 style="color: #2a4850; font-size: 16px; margin: 0 0 10px 0;">Svarbi informacija</h4>
                          <ul style="color: #666666; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                            <li>Atvykimo laikas nuo <strong>16:00</strong></li>
                            <li>Išvykimo laikas iki <strong>12:00</strong> (Ežero Namelis) arba <strong>11:00</strong> (Dupleksai)</li>
                            <li>Gyvūnai draudžiami danielių saugumui</li>
                            <li>Galite danielius maitinti tik vaisiais ir daržovėmis</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                      Jei turite klausimų, susisiekite su mumis:
                    </p>
                    <p style="color: #2a4850; font-size: 14px; margin: 5px 0;">
                      <strong>Telefonas:</strong> <a href="tel:+37064632972" style="color: #d4b996; text-decoration: none;">+370 646 32 972</a>
                    </p>
                    <p style="color: #2a4850; font-size: 14px; margin: 5px 0;">
                      <strong>El. paštas:</strong> <a href="mailto:info@rubikiailux.lt" style="color: #d4b996; text-decoration: none;">info@rubikiailux.lt</a>
                    </p>
                    <p style="color: #999999; font-size: 12px; margin: 20px 0 0 0;">
                      © ${new Date().getFullYear()} Rubikiai Lux. Visos teisės saugomos.
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
