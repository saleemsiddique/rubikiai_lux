// utils/date-server.ts - Server-only utilities
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Timestamp } from 'firebase-admin/firestore';

dayjs.extend(utc);
dayjs.extend(timezone);

const LITHUANIA_TIMEZONE = 'Europe/Vilnius';

/**
 * Devuelve el timestamp actual en la timezone de Lituania (Europe/Vilnius)
 * Este timestamp se guarda en Firebase como UTC pero representa el momento actual en Lituania
 */
export function nowInLithuania(): Timestamp {
  const now = dayjs().tz(LITHUANIA_TIMEZONE);
  return Timestamp.fromDate(now.toDate());
}
