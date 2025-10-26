type DiscountEmailParams = {
  code: string;
  percent: number;
  expiresAt: string; // YYYY-MM-DD
  logoCid?: string;  // igual que el otro email: cid inline opcional
};

export function DiscountCodeEmailHtml(params: DiscountEmailParams): string {
  const { code, percent, expiresAt, logoCid = "rubikiai-logo" } = params;

  return `
  <div style="margin:0;padding:0;background:#f4efe9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4efe9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:16px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;border:1px solid #e9e2d9;">
            <!-- Header / Logo -->
            <tr>
              <td align="center" style="padding:28px 28px 8px;">
                <img src="cid:${logoCid}" width="180" height="auto" alt="Rubikiai Lux" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:auto;">
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td align="center" style="padding:0 28px 6px;">
                <div style="font:700 26px/1.3 Georgia,'Times New Roman',Times,serif;color:#214235;letter-spacing:0.5px;">
                  Your Personal Discount
                </div>
              </td>
            </tr>

            <!-- Gold divider -->
            <tr>
              <td align="center" style="padding:8px 28px 0;">
                <div style="height:3px;width:120px;background:#bfa58b;border-radius:2px;"></div>
              </td>
            </tr>

            <!-- Intro copy -->
            <tr>
              <td align="center" style="padding:16px 28px 6px;">
                <div style="font:500 16px/1.6 Inter,Arial,sans-serif;color:#334155;">
                  We'd love to welcome you to Rubikiai Lux. Here is your private discount code:
                </div>
              </td>
            </tr>

            <!-- Discount box -->
            <tr>
              <td style="padding:18px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #efe7dc;border-radius:12px;background:#fffcf8;">
                  <tr>
                    <td style="padding:16px 18px;border-bottom:1px solid #efe7dc;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">
                        Discount
                      </div>
                      <div style="font:600 22px/1.4 Inter,Arial,sans-serif;color:#214235;">
                        ${percent}% off your stay
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 18px;border-bottom:1px solid #efe7dc;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">
                        Code
                      </div>
                      <div style="font:700 18px/1.4 Inter,Arial,sans-serif;color:#0f172a;">
                        <span style="display:inline-block;padding:6px 10px;border:1px solid #d6c6b3;border-radius:999px;font:600 15px/1 Inter,Arial,sans-serif;color:#214235;letter-spacing:0.5px;background:#faf7f2;">
                          ${code}
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 18px;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">
                        Valid until
                      </div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        <span style="color:#214235;">${expiresAt}</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- How to use -->
            <tr>
              <td style="padding:0 28px 24px;">
                <div style="font:400 13px/1.6 Inter,Arial,sans-serif;color:#6b7280;text-align:left;">
                  Use this code when booking on our site. One-time use, not transferable, and subject to availability.
                  Discount applies to the base accommodation price. Cannot be combined with other promotions.
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:0 28px 28px;">
                <div style="font:400 12px/1.6 Inter,Arial,sans-serif;color:#6b7280;">
                  Need help? Just reply to this email or contact info@rubikiai.lt.
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
