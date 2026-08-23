import type { Cents } from './types';

/**
 * Dinero en céntimos (§6).
 * Ninguna operación monetaria de la app usa float. Todos los helpers viven aquí.
 */

export const LOCALE = 'es-ES' as const;
export const CURRENCY = 'EUR' as const;

const eurosFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const roundedFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

const plainFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const plainRoundedFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

export type DecimalMode = 'auto' | 'always' | 'never';

export interface FormatOptions {
  /** `auto` (por defecto) oculta los decimales cuando el importe es redondo. */
  decimals?: DecimalMode;
  /** Añade `+` delante de los positivos. */
  signed?: boolean;
  /** Devuelve el número sin el símbolo €. */
  bare?: boolean;
}

/** 8743 → "87,43 €" · 32700 → "327 €" */
export function formatCurrency(cents: Cents, options: FormatOptions = {}): string {
  const { decimals = 'auto', signed = false, bare = false } = options;
  const value = Math.trunc(cents);
  const withDecimals = decimals === 'always' || (decimals === 'auto' && value % 100 !== 0);
  const abs = Math.abs(value) / 100;
  const formatter = bare
    ? withDecimals
      ? plainFormatter
      : plainRoundedFormatter
    : withDecimals
      ? eurosFormatter
      : roundedFormatter;
  const body = formatter.format(abs);
  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  return `${sign}${body}`;
}

/** Sólo el número, sin símbolo. Útil dentro de inputs. */
export function formatAmount(cents: Cents, decimals: DecimalMode = 'auto'): string {
  return formatCurrency(cents, { decimals, bare: true });
}

/**
 * "87,43" · "1.234,56" · "1234.56" · "87,4" · "87" → céntimos.
 * Devuelve 0 ante entradas no interpretables.
 */
export function parseCurrency(input: string): Cents {
  if (typeof input !== 'string') return 0;
  const cleaned = input.replace(/[^\d,.\-−]/g, '').replace(/−/g, '-');
  if (!cleaned || cleaned === '-') return 0;

  const negative = cleaned.trimStart().startsWith('-');
  const digitsOnly = cleaned.replace(/-/g, '');

  const lastComma = digitsOnly.lastIndexOf(',');
  const lastDot = digitsOnly.lastIndexOf('.');
  const decimalSepIndex = Math.max(lastComma, lastDot);

  let integerPart: string;
  let decimalPart: string;

  if (decimalSepIndex === -1) {
    integerPart = digitsOnly;
    decimalPart = '';
  } else {
    const tail = digitsOnly.slice(decimalSepIndex + 1);
    // Un separador con 3 dígitos detrás y sin otro separador decimal es de millares.
    const isThousandsSeparator = tail.length === 3 && lastComma !== lastDot;
    if (isThousandsSeparator) {
      integerPart = digitsOnly;
      decimalPart = '';
    } else {
      integerPart = digitsOnly.slice(0, decimalSepIndex);
      decimalPart = tail;
    }
  }

  const euros = Number(integerPart.replace(/[.,]/g, '') || '0');
  const centsPart = Number(((decimalPart || '').replace(/[.,]/g, '') + '00').slice(0, 2));
  const total = euros * 100 + centsPart;
  return negative ? -total : total;
}

export function addMoney(...values: Cents[]): Cents {
  let total = 0;
  for (const value of values) total += Math.trunc(value);
  return total;
}

export function subtractMoney(base: Cents, ...values: Cents[]): Cents {
  let total = Math.trunc(base);
  for (const value of values) total -= Math.trunc(value);
  return total;
}

export function sumBy<T>(items: readonly T[], selector: (item: T) => Cents): Cents {
  let total = 0;
  for (const item of items) total += Math.trunc(selector(item));
  return total;
}

/** Multiplica por un ratio con redondeo a céntimo (bankers-free, half away from zero). */
export function multiplyMoney(cents: Cents, ratio: number): Cents {
  const raw = cents * ratio;
  return raw < 0 ? -Math.round(-raw) : Math.round(raw);
}

/** Reparte `cents` según un porcentaje entero, sin perder céntimos. */
export function splitMoney(cents: Cents, percentA: number): [Cents, Cents] {
  const a = multiplyMoney(cents, percentA / 100);
  return [a, cents - a];
}

/** Porcentaje 0..1 protegido de divisiones por cero. */
export function ratio(part: Cents, total: Cents): number {
  if (!total) return 0;
  return part / total;
}

/** Variación porcentual entre dos importes. `null` si no hay base con la que comparar. */
export function percentChange(current: Cents, previous: Cents): number | null {
  if (!previous) return null;
  return (current - previous) / Math.abs(previous);
}

export function formatPercent(value: number, digits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatSignedPercent(value: number, digits = 0): string {
  const sign = value > 0 ? '↑ ' : value < 0 ? '↓ ' : '';
  return `${sign}${formatPercent(Math.abs(value), digits)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
