import { BookingReminderParams } from '@/lib/emailTemplates';
import dayjs from "dayjs";
import 'dayjs/locale/ru';

const PROPERTY_NAME_MAP: Record<string, string> = {
  "L0TeFf2LmrWGAaAyS8NY": "Домик у Озера",
  "PZwbfMYlSXj61uYYJutg": "Рядом с оленьим загоном",
  "oDzv9346CdaAsok162sX": "Панорама оленей",
};

export function BookingReminderEmailHtml_ru(params: BookingReminderParams): string {
  const {
    guestName,
    houseName,
    checkIn,
    checkOut,
    nGuests = 2,
    variant = "B",
    notes,
    logoCid = "rubikiai-logo",
  } = params;

  const checkInFmt = dayjs(checkIn).locale('ru').format("MMMM D, YYYY");
  const checkOutFmt = checkOut ? dayjs(checkOut).locale('ru').format("MMMM D, YYYY") : "";
  const shortDate = dayjs(checkIn).format("DD/MM/YYYY");
  const displayName = PROPERTY_NAME_MAP[houseName] || houseName;

  // Reglas específicas según variante (RU)
  const rulesA_RU = [
    "Часы размещения: заезд с 16:00, выезд до 12:00 следующего дня.",
    "По прибытии необходимо оплатить оставшуюся сумму бронирования.",
    "Прибытие с домашними животными строго запрещено. В случае прибытия вас попросят уехать. Возврат средств не предусмотрен.",
    "Не перемещайте мебель и не перекладывайте предметы в места, где они не должны находиться. Содержите апартаменты в чистоте и порядке. Всё находится в идеальном состоянии, и мы хотели бы это сохранить.",
    "Пожалуйста, аккуратно относитесь к нашему имуществу. Если предметы инвентаря сломаны, повреждены или повреждены каким-либо образом — сообщите и немедленно оплатите. Если такой ущерб причинён несовершеннолетними, их родители или опекуны несут финансовую ответственность, а если они отказываются, Клиент несет ответственность во всех случаях.",
    "Если Клиент прибывает с несовершеннолетними — он должен заботиться о них, то есть не оставлять их без присмотра, и полностью отвечает за их безопасность и полностью финансово ответственен за ущерб, причиненный детьми в имуществе (сломанные, поврежденные предметы инвентаря, имущество).",
    "Мы принимаем гостей только для спокойного отдыха, поэтому, пожалуйста, уважайте спокойствие соседей, часы тишины с 00:00 до 09:00.",
    "КУРЕНИЕ В ПОМЕЩЕНИЯХ ЗАПРЕЩЕНО. При курении на улице выбрасывайте окурки только в предусмотренные контейнеры на террасе.",
    "Не режьте на столах или прилавках, используйте разделочные доски.",
    "Используйте пергаментную бумагу или фольгу в духовке.",
    "Используйте электрические приборы в соответствии с требованиями безопасности, не разрешайте детям их использовать. Не оставляйте включенные электрические приборы без присмотра. Перед выездом из апартаментов выключите все освещение и перекройте краны с водой.",
    "Одеяла, полотенца и другой инвентарь помещения нельзя использовать на пляже или на пикнике на природе.",
  ];

  const rulesB_RU = [
    "Часы размещения: заезд с 16:00, выезд до 11:00 следующего дня.",
    "По прибытии необходимо оплатить оставшуюся сумму бронирования.",
    "Прибытие с домашними животными строго запрещено. В случае прибытия вас попросят уехать. Возврат средств не предусмотрен.",
    "Не перемещайте мебель и не перекладывайте предметы в места, где они не должны находиться. Содержите апартаменты в чистоте и порядке. Всё находится в идеальном состоянии, и мы хотели бы это сохранить.",
    "Пожалуйста, аккуратно относитесь к нашему имуществу. Если предметы инвентаря сломаны, повреждены или повреждены каким-либо образом — сообщите и немедленно оплатите. Если такой ущерб причинён несовершеннолетними, их родители или опекуны несут финансовую ответственность, а если они отказываются, Клиент несет ответственность во всех случаях.",
    "Если Клиент или кто-либо, сопровождающий его, прибывает с несовершеннолетними — он должен заботиться о них, то есть не оставлять их без присмотра, и полностью отвечает за их безопасность и полностью финансово ответственен за ущерб, причиненный детьми в имуществе (сломанные, поврежденные предметы инвентаря, имущество).",
    "Мы принимаем гостей только для спокойного отдыха, поэтому, пожалуйста, уважайте спокойствие соседей, часы тишины с 00:00 до 09:00.",
    "КУРЕНИЕ В ПОМЕЩЕНИЯХ ЗАПРЕЩЕНО. При курении на улице выбрасывайте окурки только в предусмотренные контейнеры на террасе.",
    "Не режьте на столах или прилавках, используйте разделочные доски.",
    "Используйте пергаментную бумагу или фольгу в духовке.",
    "Используйте электрические приборы в соответствии с требованиями безопасности, не разрешайте детям их использовать. Не оставляйте включенные электрические приборы без присмотра. Перед выездом из апартаментов выключите все освещение и перекройте краны с водой.",
    "Зажигайте плиту только с разрешения собственника имущества и после ознакомления с инструкциями.",
    "Не размещайте предметы на плите, не сжигайте бытовые отходы в плите.",
    "Поддерживайте безопасное расстояние от горячей плиты и не оставляйте её горящей без присмотра.",
    "Одеяла, полотенца и другой инвентарь помещения нельзя использовать на пляже или на пикнике на природе.",
    "Кормите косулю только фруктами или овощами, никакой другой едой.",
  ];

  const jacuzziRules_RU = [
    "Если услуга джакузи не оплачена, её использование строго запрещено!",
    "Время использования джакузи с 18:00 до 00:00.",
    "Джакузи предназначена не для мытья, поэтому рекомендуем принять душ перед её использованием!!!",
    ...(variant === "A" ? [] : ["Прыгать в джакузи и из джакузи строго запрещено."]),
    "Не надевайте украшения и аксессуары (кольца, браслеты, ожерелья, часы...) из-за возможности их потери и повреждения насосов джакузи...вам придется оплатить стоимость ремонта...€",
    "Использование джакузи после нанесения любых кремов или масел запрещено.",
    "Не ешьте и не пейте в гидромассажной ванне и не наливайте никакие жидкости, шампунь, мыло... в неё — это может повредить систему фильтрации и насосы, и вам придется оплатить стоимость ремонта ...€...",
    "Открывать крышку джакузи во время использования гриля запрещено.",
    "После каждого использования гидромассажной ванны ЗАКРЫТИЕ КРЫШКИ ОБЯЗАТЕЛЬНО.",
  ];

  const selectedRules = variant === "A" ? rulesA_RU : rulesB_RU;

  return `
  <div style="margin:0;padding:0;background:#f6f3ef;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f3ef;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eae3da;box-shadow:0 6px 22px rgba(17,24,39,0.06);">

            <!-- Logo + date -->
            <tr>
              <td style="padding:18px 22px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="cid:${logoCid}" width="140" alt="Logo" style="display:block;border:0;outline:none;text-decoration:none;">
                    </td>
                    <td align="right" style="vertical-align:middle;font:600 14px Inter,Arial,sans-serif;color:#6b7280;">
                      <div>Напоминание о бронировании</div>
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
                  Привет ${guestName}, важная информация о вашем пребывании
                </div>
                <div style="height:3px;width:96px;background:#bfa58b;border-radius:2px;margin-top:10px;"></div>
              </td>
            </tr>

            <!-- Main copy -->
            <tr>
              <td style="padding:14px 22px 6px;">
                <div style="font:500 15px Inter,Arial,sans-serif;color:#334155;line-height:1.6;">
                  Мы рады принять вас в <strong>${displayName}</strong> <strong>${checkInFmt}</strong>${checkOut ? ` до ${checkOutFmt}` : ""}. Рекомендуем взять резиновые (пляжные) тапочки для прохода по террасе до джакузи. Будете ли вы пользоваться грилем, 10€ (дрова, уголь, решетки, шампуры, инструменты...)? Водите осторожно, в нашем районе много диких животных. В теплое время года мы сдаем в аренду лодки, катамараны и байдарки. В связи с увеличением количества комаров, мух и других насекомых, пожалуйста, примите определенные меры предосторожности. <br/><br/>Пожалуйста, ознакомьтесь с информацией о доме и правилами ниже.
                </div>
              </td>
            </tr>

            <!-- Quick details -->
            <tr>
              <td style="padding:12px 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #f0eadf;border-radius:12px;background:#fffcf9;">
                  <tr>
                    <td style="padding:12px 16px;border-right:1px solid #f0eadf;width:50%;">
                      <div style="font:600 12px Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">Заезд</div>
                      <div style="font:600 16px Inter,Arial,sans-serif;color:#0f172a;margin-top:6px;">${checkInFmt}</div>
                    </td>
                    <td style="padding:12px 16px;width:50%;">
                      <div style="font:600 12px Inter,Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">Гостей</div>
                      <div style="font:600 16px Inter,Arial,sans-serif;color:#0f172a;margin-top:6px;">${nGuests}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- House Rules (RU version) -->
            <tr>
              <td style="padding:6px 22px 0;">
                <div style="font:700 18px Georgia, 'Times New Roman', serif;color:#214235;">Правила дома</div>
                <div style="font:500 14px Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">Пожалуйста, внимательно прочитайте</div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 22px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
                  <tbody>
                    <tr>
                      <td style="padding:12px 14px;font:14px/1.6 Inter, Arial, sans-serif;color:#334155;">
                        <ul style="margin:0;padding-left:18px;">
                          ${selectedRules.map((rule) => `<li style="margin:6px 0;">${rule}</li>`).join("")}
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            <!-- Jacuzzi Rules -->
            <tr>
              <td style="padding:6px 22px 0;">
                <div style="font:700 18px Georgia, 'Times New Roman', serif;color:#214235;">Правила джакузи</div>
                <div style="font:500 14px Inter,Arial,sans-serif;color:#6b7280;margin-top:6px;">Информация об использовании</div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 22px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
                  <tbody>
                    <tr>
                      <td style="padding:12px 14px;font:14px/1.6 Inter, Arial, sans-serif;color:#334155;">
                        <ul style="margin:0;padding-left:18px;">
                          ${jacuzziRules_RU.map((rule) => `<li style="margin:6px 0;">${rule}</li>`).join("")}
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            ${notes ? `<tr><td style="padding:12px 22px 12px;"><div style="font:600 13px Inter,Arial,sans-serif;color:#6b7280;">Заметки</div><div style="font:14px Inter,Arial,sans-serif;color:#334155;margin-top:6px;">${notes}</div></td></tr>` : ""}

            <!-- CTA / contact -->
            <tr>
              <td align="center" style="padding:12px 22px 20px;">
                <div style="font:13px Inter,Arial,sans-serif;color:#6b7280;margin-top:10px;">Нужна помощь? Ответьте на это письмо или свяжитесь с нами по адресу <a href="mailto:info@rubikiailux.lt" style="color:#214235;text-decoration:underline;">info@rubikiailux.lt</a>.</div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:12px 22px 28px;border-top:1px solid #f0eadf;">
                <div style="font:400 12px Inter,Arial,sans-serif;color:#6b7280;text-align:center;">
                  Мы с нетерпением ждем вашего приезда. Пожалуйста, проверьте требования к поездке и местные правила перед приездом.
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>`;
}
