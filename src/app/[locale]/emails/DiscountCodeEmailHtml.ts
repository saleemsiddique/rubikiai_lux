// app/emails/DiscountCodeEmailHtml.ts

type DiscountEmailParams = {
  code: string;
  percent: number;        // entero 1..100
  expiresAt: string;      // "YYYY-MM-DD"
  logoCid?: string;       // cid del adjunto inline, ej "rubikiai-logo"
};

export function DiscountCodeEmailHtml(params: DiscountEmailParams): string {
  const { code, percent, expiresAt, logoCid = "rubikiai-logo" } = params;

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
                <img src="cid:${logoCid}" width="180" height="auto" alt="Rubikiai Lux" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:auto;">
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td align="center" style="padding:0 28px 6px;">
                <div style="font:700 26px/1.25 Georgia,'Times New Roman',Times,serif;color:#214235;letter-spacing:0.8px;text-transform:uppercase;">
                  Your personal discount
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
                  We’re happy to offer you an exclusive discount for your stay at Rubikiai Lux.
                </div>
              </td>
            </tr>

            <!-- Summary block -->
            <tr>
              <td style="padding:18px 24px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #efe7dc;border-radius:12px;background:#fffcf8;">
                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #efe7dc;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">
                        Discount
                      </div>
                      <div style="font:600 20px/1.4 Inter,Arial,sans-serif;color:#0f172a;">
                        <span style="color:#214235;">${percent}% OFF</span> on your booking
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #efe7dc;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">
                        Code
                      </div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        <span style="display:inline-block;padding:6px 10px;border:1px solid #d6c6b3;border-radius:999px;font:600 14px/1 Inter,Arial,sans-serif;color:#214235;letter-spacing:0.5px;background:#faf7f2;">
                          ${code}
                        </span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 18px;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">
                        Valid until
                      </div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        ${expiresAt}
                      </div>
                      <div style="font:400 12px/1.5 Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">
                        One-time use. Non-transferable. Subject to availability.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- How to redeem -->
            <tr>
              <td style="padding:16px 28px 24px;">
                <div style="font:700 16px/1.4 Georgia,'Times New Roman',Times,serif;color:#214235;margin-bottom:8px;">
                  How to redeem
                </div>
                <div style="font:400 14px/1.6 Inter,Arial,sans-serif;color:#334155;">
                  When booking on our site, simply enter your code in the designated field and click ‘Apply discount’ on the page before confirming your reservation.
                </div>
              </td>
            </tr>

            <!-- Footer note -->
            <tr>
              <td style="padding:0 28px 28px;">
                <div style="font:400 12px/1.6 Inter,Arial,sans-serif;color:#6b7280;">
                  If you have any questions or would like to confirm availability, just reply to this email.
                </div>
              </td>
            </tr>
          </table>
          <!-- /Card -->
        </td>
      </tr>
    </table>
  </div>`;
}
