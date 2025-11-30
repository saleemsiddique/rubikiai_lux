import { CouponPurchaseParams } from '@/lib/emailTemplates';
import { formatCurrency } from "@/lib/currency";

export function CouponPurchaseEmailHtml_lt(params: CouponPurchaseParams): string {
  const { unitAmount, quantity, currency = "EUR", codes, expiresAt, logoCid = "rubikiai-logo" } = params;

  const total = unitAmount * quantity;

  const codeRows = codes
    .map(
      (c) => `
      <tr>
        <td align="left" style="padding:12px 14px;border-bottom:1px solid #eee;">
          <span style="display:inline-block;padding:6px 10px;border:1px solid #d6c6b3;border-radius:999px;font:600 13px/1 Inter,Arial,sans-serif;color:#214235;letter-spacing:0.5px;background:#faf7f2;">
            ${c.code}
          </span>
        </td>
        <td align="right" style="padding:12px 14px;border-bottom:1px solid #eee;font:600 14px/1 Inter,Arial,sans-serif;color:#0f172a;">
          ${formatCurrency(c.remaining, currency)}
        </td>
      </tr>`
    )
    .join("");

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
                <div style="font:700 28px/1.25 Georgia,'Times New Roman',Times,serif;color:#214235;letter-spacing:1px;text-transform:uppercase;">
                  Dovanų kuponas
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
                  Dėkojame už pirkinį! Žemiau rasite savo Rubikiai Lux kuponą(-us).
                </div>
              </td>
            </tr>

            <!-- Summary block -->
            <tr>
              <td style="padding:18px 24px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #efe7dc;border-radius:12px;background:#fffcf8;">
                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #efe7dc;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Suma</div>
                      <div style="font:600 18px/1.4 Inter,Arial,sans-serif;color:#0f172a;">
                        ${formatCurrency(unitAmount, currency)} × ${quantity}
                        <span style="opacity:.6">=</span>
                        <span style="color:#214235;">${formatCurrency(total, currency)}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 18px;">
                      <div style="font:600 13px/1 Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Galiojimas</div>
                      <div style="font:600 16px/1.5 Inter,Arial,sans-serif;color:#0f172a;">
                        Iki <span style="color:#214235;">${expiresAt}</span> <span style="opacity:.6">(12 mėnesių)</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Codes list title -->
            <tr>
              <td style="padding:10px 24px 0;">
                <div style="font:700 18px/1.3 Georgia,'Times New Roman',Times,serif;color:#214235;">Kodai ir likutis</div>
              </td>
            </tr>

            <!-- Codes table -->
            <tr>
              <td style="padding:8px 24px 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:12px 14px;background:#faf7f2;border-bottom:1px solid #eee;font:700 12px/1 Inter,Arial,sans-serif;color:#6b7280;letter-spacing:.5px;text-transform:uppercase;">Kodas</th>
                      <th align="right" style="padding:12px 14px;background:#faf7f2;border-bottom:1px solid #eee;font:700 12px/1 Inter,Arial,sans-serif;color:#6b7280;letter-spacing:.5px;text-transform:uppercase;">Likutis</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${codeRows}
                  </tbody>
                </table>
              </td>
            </tr>

            <!-- Footer note -->
            <tr>
              <td style="padding:0 28px 28px;">
                <div style="font:400 12px/1.6 Inter,Arial,sans-serif;color:#6b7280;">
                  Panaudokite savo kodą rezervuodami Rubikiai Lux (priklausomai nuo laisvų vietų). Negrąžinamas. Jei reikia pagalbos, kreipkitės info@rubikiailux.lt.
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
