import { describe, expect, it } from 'vitest';

import {
  addMoney,
  formatCurrency,
  multiplyMoney,
  parseCurrency,
  percentChange,
  splitMoney,
  subtractMoney,
} from './money';

/** Intl separa el importe del símbolo con un espacio duro; lo normalizamos. */
const eur = (value: string): string => value.replace(/ /g, '\u00a0');

describe('dinero en céntimos', () => {
  it('formatea en español y oculta decimales cuando el importe es redondo', () => {
    expect(formatCurrency(8743)).toBe(eur('87,43 €'));
    expect(formatCurrency(32700)).toBe(eur('327 €'));
    expect(formatCurrency(102900)).toBe(eur('1.029 €'));
    expect(formatCurrency(1500000)).toBe(eur('15.000 €'));
  });

  it('respeta el modo de decimales y el signo', () => {
    expect(formatCurrency(102900, { decimals: 'always' })).toBe(eur('1.029,00 €'));
    expect(formatCurrency(532000, { signed: true })).toBe(eur('+5.320 €'));
    expect(formatCurrency(-11600, { signed: true })).toBe(eur('−116 €'));
  });

  it('interpreta lo que escribe una persona', () => {
    expect(parseCurrency('87,43')).toBe(8743);
    expect(parseCurrency('1.029,00')).toBe(102900);
    expect(parseCurrency('1029')).toBe(102900);
    expect(parseCurrency('15.000')).toBe(1500000);
    expect(parseCurrency('87.43')).toBe(8743);
    expect(parseCurrency('')).toBe(0);
    expect(parseCurrency('abc')).toBe(0);
  });

  it('ida y vuelta sin pérdida', () => {
    for (const cents of [1, 99, 100, 8743, 102900, 1500000]) {
      expect(parseCurrency(formatCurrency(cents, { decimals: 'always', bare: true }))).toBe(cents);
    }
  });

  it('suma y resta sin errores de coma flotante', () => {
    expect(addMoney(10, 20, 3)).toBe(33);
    expect(subtractMoney(1000, 1, 2, 3)).toBe(994);
    // 0.1 + 0.2 en euros sería 0.30000000000000004; en céntimos no.
    expect(addMoney(10, 20)).toBe(30);
  });

  it('reparte un margen sin perder un céntimo', () => {
    const [ahorro, deuda] = splitMoney(66201, 60);
    expect(ahorro + deuda).toBe(66201);
    expect(ahorro).toBe(39721);
  });

  it('multiplica redondeando al céntimo', () => {
    expect(multiplyMoney(10000, 0.6)).toBe(6000);
    expect(multiplyMoney(333, 1 / 3)).toBe(111);
  });

  it('no compara contra una base inexistente', () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(120, 100)).toBeCloseTo(0.2);
  });
});
