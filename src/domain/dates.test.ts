import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, formatRange, getMonthWeeks, weekProgress } from './dates';

describe('semanas del mes', () => {
  it('septiembre de 2026 empieza en martes y termina en miércoles', () => {
    const weeks = getMonthWeeks('2026-09');
    expect(weeks.map((w) => [w.start, w.end, w.days])).toEqual([
      ['2026-09-01', '2026-09-06', 6],
      ['2026-09-07', '2026-09-13', 7],
      ['2026-09-14', '2026-09-20', 7],
      ['2026-09-21', '2026-09-27', 7],
      ['2026-09-28', '2026-09-30', 3],
    ]);
  });

  it('admite semanas parciales al principio y al final (§22)', () => {
    const weeks = getMonthWeeks('2026-09');
    expect(weeks[0]?.partial).toBe(true);
    expect(weeks[4]?.partial).toBe(true);
    expect(weeks[1]?.partial).toBe(false);
  });

  it('cubre el mes entero sin huecos ni solapes', () => {
    for (const month of ['2026-01', '2026-02', '2026-08', '2026-11', '2028-02']) {
      const weeks = getMonthWeeks(month);
      const total = weeks.reduce((sum, week) => sum + week.days, 0);
      expect(total).toBe(daysBetween(`${month}-01`, weeks[weeks.length - 1]?.end ?? '') + 1);
      for (let i = 1; i < weeks.length; i += 1) {
        expect(weeks[i]?.start).toBe(addDays(weeks[i - 1]?.end ?? '', 1));
      }
    }
  });

  it('un mes que empieza en lunes no genera semana parcial inicial', () => {
    const weeks = getMonthWeeks('2026-06'); // 1 de junio de 2026 es lunes
    expect(weeks[0]?.days).toBe(7);
  });

  it('calcula días transcurridos y restantes dentro de la semana', () => {
    const week = getMonthWeeks('2026-09')[2];
    expect(week).toBeDefined();
    if (!week) return;
    expect(weekProgress(week, '2026-09-14')).toEqual({ elapsed: 1, remaining: 6 });
    expect(weekProgress(week, '2026-09-20')).toEqual({ elapsed: 7, remaining: 0 });
    expect(weekProgress(week, '2026-09-01')).toEqual({ elapsed: 0, remaining: 7 });
  });

  it('formatea rangos como los diría una persona', () => {
    expect(formatRange('2026-09-14', '2026-09-20')).toBe('14–20 septiembre');
    expect(formatRange('2026-09-28', '2026-10-04')).toBe('28 septiembre – 4 octubre');
  });
});
