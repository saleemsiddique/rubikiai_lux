// app/emails/BookingReminderEmailHtmlEN.ts
import dayjs from "dayjs";

type Activity = {
  title: string;
  time?: string; // e.g. "09:00"
  description?: string;
};

type BookingReminderEmailParams = {
  guestName: string;
  houseName: string;
  checkIn: string; // ISO date
  checkOut?: string; // ISO date
  nGuests?: number;
  activities?: Activity[];
  notes?: string;
  logoCid?: string; // default 'rubikiai-logo'
};

export function BookingReminderEmailHtmlEN(params: BookingReminderEmailParams): string {
  const {
    guestName,
    houseName,
    checkIn,
    checkOut,
    nGuests = 2,
    activities = [],
    notes,
    logoCid = "rubikiai-logo",
  } = params;

  const checkInFmt = dayjs(checkIn).format("dddd, MMMM D, YYYY");
  const checkOutFmt = checkOut ? dayjs(checkOut).format("dddd, MMMM D, YYYY") : "";
  const shortDate = dayjs(checkIn).format("DD/MM/YYYY");

  const activitiesRows =
    activities.length > 0
      ? activities
          .map(
            (a) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top;width:120px;font:600 14px Inter, Arial, sans-serif;color:#214235;">
            ${a.time ? `<div style="font-size:13px;color:#6b7280;">${a.time}</div>` : ""}
            <div style="font-size:15px;margin-top:6px;">${a.title}</div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;font:14px Inter, Arial, sans-serif;color:#334155;">
            ${a.description ?? ""}
          </td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="2" style="padding:12px;font:14px Inter, Arial, sans-serif;color:#6b7280;">No activities suggested — reply to this email if you'd like recommendations.</td></tr>`;

  return `
  <div style="margin:0;padding:0;background:#f6f3ef;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f3ef;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eae3da;box-shadow:0 6px 22px rgba(17,24,39,0.06);">
            
            <!-- Logo + greeting -->
            <tr>
              <td style="padding:18px 22px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="cid:${logoCid}" width="140" alt="Logo" style="display:block;border:0;outline:none;text-decoration:none;">
                    </td>
                    <td align="right" style="vertical-align:middle;font:600 14px Inter,Arial,sans-serif;color:#6b7280;">
                      <div>Reservation reminder</div>
                      <div style="font:500 13px Inter,Arial,sans-serif;color:#94a3b8;margin-top:4px;">${shortDate}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td style="padding:8px 22px 0;">
                <div style="font:700 26px Georgia, 'Times New Roman', serif;color:#214235;letter-spacing:0.6px;">
                  Hi ${guestName}, your stay starts in 1 week
                </div>
                <div style="height:3px;width:96px;background:#bfa58b;border-radius:2px;margin-top:10px;"></div>
              </td>
            </tr>

            <!-- Main copy -->
            <tr>
              <td style="padding:14px 22px 6px;">
                <div style="font:500 15px Inter,Arial,sans-serif;color:#334155;line-height:1.6;">
                  We're excited to host you at <strong>${houseName}</strong> on <strong>${checkInFmt}</strong>${checkOut ? ` until ${checkOutFmt}` : ""}. Here are some practical details and suggested activities to help you plan your trip.
                </div>
              </td>
            </tr>

            <!-- Quick details -->
            <tr>
              <td style="padding:12px 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #f0eadf;border-radius:12px;background:#fffcf9;">
                  <tr>
                    <td style="padding:12px 16px;border-right:1px solid #f0eadf;width:50%;">
                      <div style="font:600 12px Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">Check-in</div>
                      <div style="font:600 16px Inter,Arial,sans-serif;color:#0f172a;margin-top:6px;">${checkInFmt}</div>
                    </td>
                    <td style="padding:12px 16px;width:50%;">
                      <div style="font:600 12px Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">Guests</div>
                      <div style="font:600 16px Inter,Arial,sans-serif;color:#0f172a;margin-top:6px;">${nGuests}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Activities preview -->
            <tr>
              <td style="padding:6px 22px 0;">
                <div style="font:700 18px Georgia, 'Times New Roman', serif;color:#214235;">Suggested activities</div>
                <div style="font:500 14px Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">Hand-picked experiences for the area — great for a one-week plan.</div>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 22px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
                  <tbody>
                    ${activitiesRows}
                  </tbody>
                </table>
              </td>
            </tr>

            <!-- Visual mini plan (three cards) -->
            <tr>
              <td style="padding:6px 22px 4px;">
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                  <div style="flex:1;min-width:180px;border-radius:10px;padding:12px;border:1px solid #efe7dc;background:#fff8f3;">
                    <div style="font:700 14px Inter,Arial,sans-serif;color:#214235;">Kayak at Dawn</div>
                    <div style="font:13px Inter,Arial,sans-serif;color:#334155;margin-top:8px;">2-3h sea kayak tour; calm waters & beaches. Recommended morning activity.</div>
                  </div>

                  <div style="flex:1;min-width:180px;border-radius:10px;padding:12px;border:1px solid #efe7dc;background:#fff8f3;">
                    <div style="font:700 14px Inter,Arial,sans-serif;color:#214235;">Coastal Hike</div>
                    <div style="font:13px Inter,Arial,sans-serif;color:#334155;margin-top:8px;">3-5 km scenic route with viewpoints and picnic spots. Medium difficulty.</div>
                  </div>

                  <div style="flex:1;min-width:180px;border-radius:10px;padding:12px;border:1px solid #efe7dc;background:#fff8f3;">
                    <div style="font:700 14px Inter,Arial,sans-serif;color:#214235;">Local Market + Tapas</div>
                    <div style="font:13px Inter,Arial,sans-serif;color:#334155;margin-top:8px;">Visit Saturday market and evening tapas route in the nearby town.</div>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Notes -->
            ${notes ? `<tr><td style="padding:12px 22px 12px;"><div style="font:600 13px Inter,Arial,sans-serif;color:#6b7280;">Notes</div><div style="font:14px Inter,Arial,sans-serif;color:#334155;margin-top:6px;">${notes}</div></td></tr>` : ""}

            <!-- CTA / contact -->
            <tr>
              <td align="center" style="padding:12px 22px 20px;">
                <a href="https://your-site.example/reservations" style="display:inline-block;padding:12px 20px;border-radius:10px;text-decoration:none;font:600 14px Inter,Arial,sans-serif;background:#214235;color:#fff;">View reservation details</a>
                <div style="font:13px Inter,Arial,sans-serif;color:#6b7280;margin-top:10px;">Need anything? Reply to this email or contact us at <a href="mailto:info@rubikiailux.lt" style="color:#214235;text-decoration:underline;">info@rubikiailux.lt</a>.</div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:12px 22px 28px;border-top:1px solid #f0eadf;">
                <div style="font:400 12px Inter,Arial,sans-serif;color:#6b7280;">
                  We look forward to hosting you. Please check travel requirements and local rules before arrival.
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
