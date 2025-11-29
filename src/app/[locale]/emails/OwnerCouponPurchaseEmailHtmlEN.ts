// app/emails/OwnerCouponPurchaseEmailHtmlEN.ts
import { formatCurrency } from "@/lib/currency";

type OwnerCouponPurchaseEmailParams = {
  orderId?: string;
  buyerEmail?: string | null;
  unitAmount: number;
  quantity: number;
  currency?: string;
  totalAmount?: number;
  codes: { code: string; remaining: number }[];
  expiresAt?: string; // YYYY-MM-DD
  purchasedAt?: string;
  paymentMethod?: string | null;
  logoCid?: string;
};

export function OwnerCouponPurchaseEmailHtmlEN(
  params: OwnerCouponPurchaseEmailParams
): string {
  const {
    orderId = "coupon-order",
    buyerEmail = null,
    unitAmount,
    quantity,
    currency = "EUR",
    totalAmount = unitAmount * quantity,
    codes = [],
    expiresAt = "",
    purchasedAt = new Date().toISOString().slice(0, 19),
    paymentMethod = null,
    logoCid = "rubikiai-logo",
  } = params;

  return `
  <div style="background:#f4efe9;padding:20px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;margin:auto;background:#fff;border-radius:12px;border:1px solid #e9e2d9;">
      <tr><td align="center" style="padding:22px;"><img src="cid:${logoCid}" width="160" alt="Coupon purchase"></td></tr>

      <tr><td style="padding:0 28px 12px;text-align:center;">
        <div style="font-weight:700;font-size:18px;color:#214235;">New Coupon Purchase</div>
        <div style="font-size:13px;color:#6b7280;margin-top:6px;">Order: <strong>${orderId}</strong> — Purchased: <strong>${purchasedAt}</strong></div>
      </td></tr>

      <tr><td style="padding:12px 28px;">
        <div style="font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;margin-bottom:6px;">Purchase summary</div>
        <div style="font-size:15px;color:#0f172a;">
          <div>Buyer: <strong>${buyerEmail || "Anonymous"}</strong></div>
          <div>Unit price: <strong>${formatCurrency(unitAmount, currency)}</strong></div>
          <div>Quantity: <strong>${quantity}</strong></div>
          <div style="margin-top:8px;font-weight:700;color:#214235;">Total: <strong>${formatCurrency(totalAmount, currency)}</strong></div>
          ${expiresAt ? `<div>Coupons expire: <strong>${expiresAt}</strong></div>` : ""}
        </div>
      </td></tr>

      <tr><td style="padding:12px 28px;">
        <div style="font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;margin-bottom:6px;">Generated codes</div>
        <div style="font-size:14px;color:#0f172a;">
          ${codes.length ? codes.map(c => `<div style="margin-bottom:6px;"><strong>${c.code}</strong> — remaining: ${formatCurrency(c.remaining, currency)}</div>`).join("") : "<div>No codes generated (check order).</div>"}
        </div>
      </td></tr>
    </table>
  </div>
  `;
}
