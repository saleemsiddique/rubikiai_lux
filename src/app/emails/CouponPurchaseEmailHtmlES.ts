import { formatCurrency } from "@/lib/currency";

export function CouponPurchaseEmailHtmlEN(params: {
  unitAmount: number;
  quantity: number;
  currency?: string;
  codes: { code: string; remaining: number }[];
  expiresAt: string; // ISO date string
}): string {
  const { unitAmount, quantity, currency = "EUR", codes, expiresAt } = params;
  const total = unitAmount * quantity;

  const rows = codes
    .map(
      (c) => `
      <tr>
        <td style=\"padding:8px 12px;border:1px solid #eee;font-family:Inter,Arial,sans-serif\">${c.code}</td>
        <td style=\"padding:8px 12px;border:1px solid #eee;font-family:Inter,Arial,sans-serif\">${formatCurrency(c.remaining, currency)}</td>
      </tr>`
    )
    .join("");

  return `
  <div style=\"max-width:640px;margin:0 auto;padding:24px;font-family:Inter,Arial,sans-serif;color:#0f172a\">
    <h1 style=\"margin:0 0 8px;font-size:24px\">Thanks for your purchase!</h1>
    <p style=\"margin:0 0 16px;opacity:.8\">Here are your Rubikiai Lux coupon(s).</p>

    <table style=\"border-collapse:collapse;margin:16px 0 8px;width:100%\">
      <tbody>
        <tr>
          <td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600\">Amount</td>
          <td style=\"padding:8px 12px;border:1px solid #eee\">${formatCurrency(unitAmount, currency)} x ${quantity} = <strong>${formatCurrency(total, currency)}</strong></td>
        </tr>
        <tr>
          <td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600\">Validity</td>
          <td style=\"padding:8px 12px;border:1px solid #eee\">Until ${expiresAt} (12 months)</td>
        </tr>
      </tbody>
    </table>

    <h2 style=\"font-size:18px;margin:16px 0 8px\">Codes & balance</h2>
    <table style=\"border-collapse:collapse;margin:0 0 24px;width:100%\">
      <thead>
        <tr>
          <th align=\"left\" style=\"padding:8px 12px;border:1px solid #eee;background:#fafafa\">Code</th>
          <th align=\"left\" style=\"padding:8px 12px;border:1px solid #eee;background:#fafafa\">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <p style=\"opacity:.7;margin:0\">Redeem the code during booking. Subject to availability. Non‑refundable.</p>
  </div>`;
}
