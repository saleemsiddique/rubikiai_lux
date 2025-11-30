/**
 * Helper para obtener el template de email correcto según tipo y locale
 */

export type EmailLocale = 'lt' | 'en' | 'ru';
export type EmailType = 'booking-reminder' | 'coupon-purchase' | 'reservation-confirmation';

export interface BookingReminderParams {
    reservationId?: string;
  guestName: string;
  houseName: string;
  checkIn: string;
  checkOut?: string;
  nGuests?: number;
  variant?: "A" | "B"; // A = house L0TeFf2LmrWGAaAyS8NY, B = otros
  notes?: string;
  logoCid?: string;
  houseImageCid?: string;
}

export interface CouponPurchaseParams {
  unitAmount: number;
  quantity: number;
  currency?: string;
  codes: { code: string; remaining: number }[];
  expiresAt: string; // ISO (YYYY-MM-DD)
  logoCid?: string; // CID de la imagen del logo adjunta en el email
}

export interface ReservationConfirmationParams {
  reservationId: string;
  guestName: string;
  bookingDate: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomType: string; // House ID or name
  guests: number;
  paidNow: number; // lo que se pagó ahora
  payAtArrival: number; // lo que queda por pagar
  totalStay: number; // total de la estancia
  discountApplied?: number; // lo descontado del cupón/porcentaje
  currency?: string;
  hotelName?: string;
  hotelContactEmail?: string;
  hotelContactPhone?: string;
  logoCid?: string;
}

/**
 * Dinamically load email template based on type and locale
 */
export async function getBookingReminderTemplate(locale: EmailLocale) {
  switch (locale) {
    case 'lt':
      const { BookingReminderEmailHtml_lt } = await import('@/app/[locale]/emails/BookingReminderEmailHtml_lt');
      return BookingReminderEmailHtml_lt;
    case 'en':
      const { BookingReminderEmailHtml_en } = await import('@/app/[locale]/emails/BookingReminderEmailHtml_en');
      return BookingReminderEmailHtml_en;
    case 'ru':
      const { BookingReminderEmailHtml_ru } = await import('@/app/[locale]/emails/BookingReminderEmailHtml_ru');
      return BookingReminderEmailHtml_ru;
    default:
      const { BookingReminderEmailHtml_lt: defaultTemplate } = await import('@/app/[locale]/emails/BookingReminderEmailHtml_lt');
      return defaultTemplate;
  }
}

export async function getCouponPurchaseTemplate(locale: EmailLocale) {
  switch (locale) {
    case 'lt':
      const { CouponPurchaseEmailHtml_lt } = await import('@/app/[locale]/emails/CouponPurchaseEmailHtml_lt');
      return CouponPurchaseEmailHtml_lt;
    case 'en':
      const { CouponPurchaseEmailHtml_en } = await import('@/app/[locale]/emails/CouponPurchaseEmailHtml_en');
      return CouponPurchaseEmailHtml_en;
    case 'ru':
      const { CouponPurchaseEmailHtml_ru } = await import('@/app/[locale]/emails/CouponPurchaseEmailHtml_ru');
      return CouponPurchaseEmailHtml_ru;
    default:
      const { CouponPurchaseEmailHtml_lt: defaultTemplate } = await import('@/app/[locale]/emails/CouponPurchaseEmailHtml_lt');
      return defaultTemplate;
  }
}

export async function getReservationConfirmationTemplate(locale: EmailLocale) {
  switch (locale) {
    case 'lt':
      const { ReservationConfirmationEmailHtml_lt } = await import('@/app/[locale]/emails/ReservationConfirmationEmailHtml_lt');
      return ReservationConfirmationEmailHtml_lt;
    case 'en':
      const { ReservationConfirmationEmailHtml_en } = await import('@/app/[locale]/emails/ReservationConfirmationEmailHtml_en');
      return ReservationConfirmationEmailHtml_en;
    case 'ru':
      const { ReservationConfirmationEmailHtml_ru } = await import('@/app/[locale]/emails/ReservationConfirmationEmailHtml_ru');
      return ReservationConfirmationEmailHtml_ru;
    default:
      const { ReservationConfirmationEmailHtml_lt: defaultTemplate } = await import('@/app/[locale]/emails/ReservationConfirmationEmailHtml_lt');
      return defaultTemplate;
  }
}

/**
 * Get subject line for email type in the given locale
 */
export function getEmailSubject(type: EmailType, locale: EmailLocale, params?: any): string {
  const subjects = {
    'booking-reminder': {
      lt: `Priminimasapie jūsų rezervaciją - ${params?.houseName || 'Rubikiai Lux'}`,
      en: `Reminder about your reservation - ${params?.houseName || 'Rubikiai Lux'}`,
      ru: `Напоминание о вашем бронировании - ${params?.houseName || 'Rubikiai Lux'}`,
    },
    'coupon-purchase': {
      lt: 'Jūsų dovanų kuponas - Rubikiai Lux',
      en: 'Your Gift Voucher - Rubikiai Lux',
      ru: 'Ваш подарочный сертификат - Rubikiai Lux',
    },
    'reservation-confirmation': {
      lt: `Rezervacijos patvirtinimas - ${params?.reservationId || ''}`,
      en: `Reservation Confirmation - ${params?.reservationId || ''}`,
      ru: `Подтверждение бронирования - ${params?.reservationId || ''}`,
    },
  };

  return subjects[type][locale] || subjects[type]['lt'];
}
