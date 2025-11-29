import { CouponPurchaseParams } from '@/lib/emailTemplates';

export function CouponPurchaseEmailHtml_en(params: CouponPurchaseParams): string {
  const { recipientName, code, amount, expirationDate } = params;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Gift Voucher</title>
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
                    <p style="color: #d4b996; font-size: 16px; margin: 10px 0 0 0;">Your Gift Voucher</p>
                  </td>
                </tr>

                <!-- Greeting -->
                <tr>
                  <td style="padding: 40px 40px 20px 40px;">
                    <h2 style="color: #2a4850; font-size: 24px; margin: 0 0 20px 0;">Hello, ${recipientName}!</h2>
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">
                      We're delighted to present your gift voucher for a relaxing stay at Rubikiai Lux!
                    </p>
                  </td>
                </tr>

                <!-- Coupon Code -->
                <tr>
                  <td style="padding: 0 40px 30px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #d4b996 0%, #c9a87a 100%); border-radius: 12px; padding: 30px; text-align: center;">
                      <tr>
                        <td>
                          <p style="color: #2a4850; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; font-weight: 600;">Your Voucher Code</p>
                          <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin: 10px 0;">
                            <p style="color: #2a4850; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 3px; font-family: 'Courier New', monospace;">${code}</p>
                          </div>
                          <p style="color: #2a4850; font-size: 24px; font-weight: 700; margin: 20px 0 0 0;">€${amount.toFixed(2)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Coupon Details -->
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 8px; padding: 20px;">
                      <tr>
                        <td>
                          <h3 style="color: #2a4850; font-size: 18px; margin: 0 0 15px 0; border-bottom: 2px solid #d4b996; padding-bottom: 10px;">Voucher Details</h3>

                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Value:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">€${amount.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Valid Until:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${expirationDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #666666; font-size: 14px; padding: 8px 0;">Code:</td>
                              <td style="color: #2a4850; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0; font-family: 'Courier New', monospace;">${code}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- How to Use -->
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff8e1; border-left: 4px solid #d4b996; border-radius: 4px; padding: 20px;">
                      <tr>
                        <td>
                          <h4 style="color: #2a4850; font-size: 16px; margin: 0 0 10px 0;">How to Use Your Voucher</h4>
                          <ul style="color: #666666; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                            <li>Visit our website and select your desired property</li>
                            <li>During booking, enter your voucher code: <strong style="font-family: 'Courier New', monospace;">${code}</strong></li>
                            <li>The discount will be automatically applied to the total amount</li>
                            <li>Voucher is valid until <strong>${expirationDate}</strong></li>
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
