/* eslint-disable @typescript-eslint/no-explicit-any */
export function DiscountCodeEmailHtml_en(params: any): string {
  const { code, percent, expiresAt, logoCid } = params;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Discount Code</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 30px;">
                ${logoCid ? `
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <img src="cid:${logoCid}" alt="Rubikiai Lux" style="max-width: 200px; height: auto;" />
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td align="center">
                    <h1 style="color: #2a4850; margin: 0 0 20px 0;">Your Personal Discount</h1>
                    <p style="font-size: 18px; color: #666;">You've received a ${percent}% discount for Rubikiai Lux!</p>

                    <div style="background: linear-gradient(135deg, #d4b996 0%, #c9a87a 100%); border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center;">
                      <p style="color: #2a4850; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">Your Discount Code</p>
                      <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin: 10px 0;">
                        <p style="color: #2a4850; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 3px; font-family: 'Courier New', monospace;">${code}</p>
                      </div>
                      <p style="color: #2a4850; font-size: 24px; font-weight: 700; margin: 20px 0 0 0;">${percent}% OFF</p>
                    </div>

                    <p style="color: #666; margin: 20px 0;">
                      Use this code when booking your stay at Rubikiai Lux.
                      ${expiresAt ? `Valid until ${expiresAt}.` : ''}
                    </p>

                    <p style="color: #999; font-size: 12px; margin: 30px 0 0 0;">
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
