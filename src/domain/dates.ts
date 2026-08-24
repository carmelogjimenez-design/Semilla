import type { ISODate, MonthKey, WeekKey } from './types';
import { LOCALE } from './money';

/**
 * Fechas civiles (Europe/Madrid) manipuladas en UTC para evitar saltos de horario.
 * Una `ISODate` es siempre `YYYY-MM-DD`.
 */

export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

export const WEEKDAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

export const WEEKDAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

export function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function toISO(date: Date): ISODate {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Fecha de hoy en Europe/Madrid. */
export function systemToday(): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = fromISO(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + delta, 1));
  return monthKeyOf(toISO(date));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

export function monthKeyOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function monthIndex(month: MonthKey): number {
  return Number(month.slice(5, 7)) - 1;
}

export function monthYear(month: MonthKey): number {
  return Number(month.slice(0, 4));
}

export function daysInMonth(month: MonthKey): number {
  return new Date(Date.UTC(monthYear(month), monthIndex(month) + 1, 0)).getUTCDate();
}

export function firstDayOfMonth(month: MonthKey): ISODate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: MonthKey): ISODate {
  return `${month}-${pad(daysInMonth(month))}`;
}

export function monthLabel(month: MonthKey, opts: { year?: boolean; capitalize?: boolean } = {}): string {
  const name = MONTH_NAMES[monthIndex(month)] ?? '';
  const label = opts.capitalize === false ? name : name.charAt(0).toUpperCase() + name.slice(1);
  return opts.year ? `${label} ${monthYear(month)}` : label;
}

export function monthLabelShort(month: MonthKey): string {
  return `${(MONTH_SHORT[monthIndex(month)] ?? '').toUpperCase()} ${monthYear(month)}`;
}

/* ------------------------------------------------------------------ *
 * Semanas dentro del mes — §22 admite semanas parciales
 * ------------------------------------------------------------------ */

export interface WeekSpan {
  index: number;
  key: WeekKey;
  month: MonthKey;
  start: ISODate;
  end: ISODate;
  days: number;
  partial: boolean;
}

export function weekKeyOf(month: MonthKey, index: number): WeekKey {
  return `${month}-W${index}`;
}

/**
 * Divide un mes en semanas naturales (lunes → domingo) recortadas por el mes.
 * Septiembre 2026 → 1–6, 7–13, 14–20, 21–27, 28–30.
 */
export function getMonthWeeks(month: MonthKey): WeekSpan[] {
  const total = daysInMonth(month);
  const weeks: WeekSpan[] = [];
  let cursor = firstDayOfMonth(month);
  let index = 1;

  while (Number(cursor.slice(8, 10)) <= total) {
    const startDow = fromISO(cursor).getUTCDay(); // 0 domingo … 1 lunes
    const daysUntilSunday = startDow === 0 ? 0 : 7 - startDow;
    let end = addDays(cursor, daysUntilSunday);
    if (monthKeyOf(end) !== month) end = lastDayOfMonth(month);

    const days = daysBetween(cursor, end) + 1;
    weeks.push({
      index,
      key: weekKeyOf(month, index),
      month,
      start: cursor,
      end,
      days,
      partial: days < 7,
    });

    if (end === lastDayOfMonth(month)) break;
    cursor = addDays(end, 1);
    index += 1;
  }

  return weeks;
}

export function findWeek(weeks: WeekSpan[], date: ISODate): WeekSpan | null {
  return weeks.find((w) => date >= w.start && date <= w.end) ?? null;
}

export function weekOfDate(date: ISODate): WeekSpan | null {
  return findWeek(getMonthWeeks(monthKeyOf(date)), date);
}

/** Días transcurridos (incluido hoy) y días restantes dentro de la semana. */
export function weekProgress(week: WeekSpan, today: ISODate): { elapsed: number; remaining: number } {
  if (today < week.start) return { elapsed: 0, remaining: week.days };
  if (today > week.end) return { elapsed: week.days, remaining: 0 };
  const elapsed = daysBetween(week.start, today) + 1;
  return { elapsed, remaining: week.days - elapsed };
}

/* ------------------------------------------------------------------ *
 * Formato (§121)
 * ------------------------------------------------------------------ */

/** "23 ago" */
export function formatDayShort(iso: ISODate): string {
  const date = fromISO(iso);
  return `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;
}

/** "23 agosto" */
export function formatDayLong(iso: ISODate): string {
  const date = fromISO(iso);
  return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`;
}

/** "23 agosto 2026" — para periodos que cruzan de año y necesitan decir cuál. */
export function formatDayFull(iso: ISODate): string {
  return `${formatDayLong(iso)} ${fromISO(iso).getUTCFullYear()}`;
}

/** "domingo 23" */
export function formatWeekday(iso: ISODate): string {
  const date = fromISO(iso);
  return `${WEEKDAY_NAMES[date.getUTCDay()]} ${date.getUTCDate()}`;
}

/** "14–20 septiembre" · "28 septiembre – 4 octubre" */
export function formatRange(start: ISODate, end: ISODate): string {
  if (start === end) return formatDayLong(start);
  const a = fromISO(start);
  const b = fromISO(end);
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTH_NAMES[b.getUTCMonth()]}`;
  }
  return `${formatDayLong(start)} – ${formatDayLong(end)}`;
}

/** "Hoy" · "Ayer" · "domingo 23" · "23 agosto" */
export function formatRelativeDay(iso: ISODate, today: ISODate): string {
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, -1)) return 'Ayer';
  if (iso === addDays(today, 1)) return 'Mañana';
  const diff = Math.abs(daysBetween(iso, today));
  if (diff < 7) return capitalize(formatWeekday(iso));
  if (monthKeyOf(iso) === monthKeyOf(today)) return capitalize(formatWeekday(iso));
  return formatDayLong(iso);
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatDateInput(iso: ISODate): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(fromISO(iso));
}

export function isWithin(iso: ISODate, start: ISODate, end: ISODate): boolean {
  return iso >= start && iso <= end;
}

/** Lista de meses entre dos fechas, ambos incluidos. */
export function monthsBetween(startMonth: MonthKey, endMonth: MonthKey): MonthKey[] {
  const result: MonthKey[] = [];
  let cursor = startMonth;
  let guard = 0;
  while (cursor <= endMonth && guard < 600) {
    result.push(cursor);
    cursor = addMonths(cursor, 1);
    guard += 1;
  }
  return result;
}
