'use client';

import { useMemo, useState } from 'react';

import { formatDayShort } from '@/domain/dates';
import { formatCurrency } from '@/domain/money';
import type { Cents, Debt, ISODate, Transaction } from '@/domain/types';

/**
 * §122 — La deuda, dibujada.
 *
 * Una sola serie: el saldo pendiente en el tiempo. Sin leyenda, porque el título
 * ya dice qué es, y sin una cifra sobre cada punto: sólo van etiquetados los
 * extremos y el importe original.
 *
 * El eje arranca en cero y llega al importe original del préstamo. Eso es
 * deliberado: si escalase al saldo actual, un descenso pequeño parecería enorme
 * y uno grande pasaría desapercibido. Así el hueco de arriba —lo que ya no
 * debéis— se ve a tamaño real.
 *
 * Los puntos marcados son las amortizaciones extraordinarias: los momentos en
 * que decidisteis acelerar.
 */

interface Point {
  date: ISODate;
  balance: Cents;
  extra: boolean;
  amount: Cents;
}

export function DebtChart({
  debt,
  transactions,
  today,
}: {
  debt: Debt;
  transactions: readonly Transaction[];
  today: ISODate;
}) {
  const [active, setActive] = useState<number | null>(null);

  const points = useMemo<Point[]>(() => {
    const payments = transactions
      .filter((t) => t.kind === 'debtPayment' && t.debtId === debt.id && t.date >= debt.trackingStart)
      .sort((a, b) => a.date.localeCompare(b.date));

    const series: Point[] = [
      { date: debt.trackingStart, balance: debt.balanceAtStart, extra: false, amount: 0 },
    ];
    let balance = debt.balanceAtStart;
    for (const payment of payments) {
      balance = Math.max(0, balance - payment.amount);
      series.push({
        date: payment.date,
        balance,
        extra: payment.kind === 'debtPayment' && payment.paymentType === 'extra',
        amount: payment.amount,
      });
    }
    const last = series[series.length - 1];
    if (last && last.date !== today) {
      series.push({ date: today, balance: last.balance, extra: false, amount: 0 });
    }
    return series;
  }, [debt, transactions, today]);

  const width = 320;
  const height = 150;
  const pad = { top: 18, right: 6, bottom: 6, left: 6 };

  /* Techo del eje: el importe original. Ahí es donde empezó todo. */
  const ceiling = Math.max(debt.initialBalance, debt.balanceAtStart, 1);
  const firstDate = points[0]?.date ?? today;
  const lastDate = points[points.length - 1]?.date ?? today;
  const span = Math.max(1, dayDiff(firstDate, lastDate));

  const x = (date: ISODate) => pad.left + (dayDiff(firstDate, date) / span) * (width - pad.left - pad.right);
  const y = (balance: Cents) => pad.top + (1 - balance / ceiling) * (height - pad.top - pad.bottom);
  const floor = height - pad.bottom;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date)},${y(p.balance)}`).join(' ');
  const area = `${line} L${x(lastDate)},${floor} L${x(firstDate)},${floor} Z`;

  const milestones = points.filter((point) => point.extra);
  const current = points[points.length - 1]?.balance ?? debt.balanceAtStart;
  const cleared = Math.max(0, debt.initialBalance - current);
  const activePoint = active !== null ? points[active] : null;
  const hasMovement = points.length > 2 || milestones.length > 0;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${debt.name}: del importe original de ${formatCurrency(
          debt.initialBalance,
        )} quedan ${formatCurrency(current)}. Ya habéis eliminado ${formatCurrency(cleared)}.`}
      >
        {/* Lo que ya no debéis: el hueco entre el original y el saldo */}
        <rect
          x={pad.left}
          y={pad.top}
          width={width - pad.left - pad.right}
          height={Math.max(0, y(current) - pad.top)}
          className="fill-stone-100"
          rx={4}
        />

        {/* Techo: el importe original */}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top}
          y2={pad.top}
          className="stroke-stone-300"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Lo que queda */}
        <path d={area} className="fill-sage" />
        <path
          d={line}
          fill="none"
          className="stroke-forest"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Hitos: sólo las amortizaciones extraordinarias llevan punto */}
        {points.map((point, index) =>
          point.extra ? (
            <circle
              key={`${point.date}-${index}`}
              cx={x(point.date)}
              cy={y(point.balance)}
              r={5}
              className="fill-leaf stroke-surface"
              strokeWidth={2}
              onClick={() => setActive(active === index ? null : index)}
              style={{ cursor: 'pointer' }}
            />
          ) : null,
        )}

        <circle cx={x(lastDate)} cy={y(current)} r={4} className="fill-forest stroke-surface" strokeWidth={2} />
      </svg>

      {/* Etiquetas directas, en tinta, nunca en el color de la serie */}
      <div className="-mt-1 flex items-baseline justify-between text-[11px] text-muted tnum">
        <span>Original {formatCurrency(debt.initialBalance)}</span>
        <span className="font-semibold text-ink">Quedan {formatCurrency(current)}</span>
      </div>

      {cleared > 0 ? (
        <p className="mt-1.5 text-[12px] text-seed-700 tnum">↓ {formatCurrency(cleared)} ya fuera</p>
      ) : null}

      {activePoint ? (
        <p className="mt-2 rounded-xl bg-sage px-3 py-2 text-[12px] text-seed-800 tnum">
          {formatDayShort(activePoint.date)} · amortización de {formatCurrency(activePoint.amount)} → saldo{' '}
          {formatCurrency(activePoint.balance)}
        </p>
      ) : null}

      {/* Equivalente textual de los hitos */}
      {milestones.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3">
          {milestones.slice(-4).map((point, index) => (
            <li key={`${point.date}-${index}`} className="flex justify-between text-[12px] tnum">
              <span className="text-muted">{formatDayShort(point.date)} · amortización</span>
              <span className="font-medium text-ink">−{formatCurrency(point.amount)}</span>
            </li>
          ))}
        </ul>
      ) : !hasMovement ? (
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Todavía no hay pagos registrados. En cuanto registréis el primero, esta línea empezará a bajar.
        </p>
      ) : null}
    </div>
  );
}

function dayDiff(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
