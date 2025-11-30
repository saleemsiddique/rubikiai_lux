/* eslint-disable @typescript-eslint/no-explicit-any */
export function OwnerCouponPurchaseEmailHtmlEN(params: any): string {
  const {
    orderId,
    buyerEmail,
    unitAmount,
    quantity,
    currency = "EUR",
    totalAmount,
    codes,
    expiresAt,
    purchasedAt,
    paymentMethod,
  } = params;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Coupon Purchase - ${orderId}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 30px;">
                <tr>
                  <td>
                    <h1 style="color: #2a4850; margin: 0 0 20px 0;">New Coupon Purchase</h1>
                    <h2 style="color: #d4b996; margin: 0 0 30px 0;">Order: ${orderId}</h2>

                    <h3 style="color: #2a4850; margin: 20px 0 10px 0;">Purchase Information</h3>
                    <table width="100%" cellpadding="5" style="border-collapse: collapse;">
                      <tr><td style="padding: 5px 0;"><strong>Buyer Email:</strong></td><td>${buyerEmail || 'N/A'}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Unit Amount:</strong></td><td>${currency} ${unitAmount.toFixed(2)}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Quantity:</strong></td><td>${quantity}</td></tr>
                      <tr><td style="padding: 5px 0;"><strong>Total Amount:</strong></td><td>${currency} ${(totalAmount || unitAmount * quantity).toFixed(2)}</td></tr>
                      ${paymentMethod ? `<tr><td style="padding: 5px 0;"><strong>Payment Method:</strong></td><td>${paymentMethod}</td></tr>` : ''}
                      ${purchasedAt ? `<tr><td style="padding: 5px 0;"><strong>Purchased At:</strong></td><td>${purchasedAt}</td></tr>` : ''}
                      ${expiresAt ? `<tr><td style="padding: 5px 0;"><strong>Expires At:</strong></td><td>${expiresAt}</td></tr>` : ''}
                    </table>

                    <h3 style="color: #2a4850; margin: 20px 0 10px 0;">Generated Codes</h3>
                    <table width="100%" cellpadding="5" style="border-collapse: collapse;">
                      ${codes && codes.length > 0 ? codes.map((c: any) => `
                        <tr>
                          <td style="padding: 5px 0; font-family: monospace; font-size: 14px;">${c.code}</td>
                          <td style="padding: 5px 0; text-align: right;">Remaining: ${currency} ${c.remaining.toFixed(2)}</td>
                        </tr>
                      `).join('') : '<tr><td>No codes generated</td></tr>'}
                    </table>
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
