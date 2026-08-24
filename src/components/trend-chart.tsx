'use client';

import { useState } from 'react';

import { formatCurrency } from '@/domain/money';
import type { Cents } from '@/domain/types';

/**
 * Evolución mensual de una sola magnitud (§67: pocos gráficos, buenos).
 *
 * Una sola serie, así que no lleva leyenda: el título de la sección la nombra.
 * Sólo van etiquetados los extremos —nunca una cifra sobre cada punto— y el eje
 * incluye siempre el cero, para que el patrimonio negativo se lea como lo que es
 * y una subida pequeña no parezca un despegue.
 *
 * Cada punto es tocable y muestra su mes y su importe; debajo queda una lista
 * con los mismos datos para quien no pueda leer la forma.
 */

export interface TrendPoint {
  /** Etiqueta corta del eje: «MAR». */
  label: string;
  value: Cents;
  /** Nombre completo del mes, para poder escribirlo en una frase. */
  full?: string;
}

export function TrendChart({
  points,
  emptyHint,
  positiveIsGood = true,
}: {
  points: TrendPoint[];
  emptyHint?: string;
  /** En deuda, bajar es bueno: invierte el color del cambio. */
  positiveIsGood?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <p className="text-[12px] leading-relaxed text-muted">
        {emptyHint ?? 'Hace falta más de un mes de recorrido para dibujar la evolución.'}
      </p>
    );
  }

  const width = 320;
  const height = 116;
  /* Los laterales dejan sitio a las etiquetas de mes: centradas en el primer y
     último punto, con menos margen quedarían cortadas por el borde. */
  const pad = { top: 14, right: 22, bottom: 22, left: 22 };

  const values = points.map((point) => point.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);

  const x = (index: number) =>
    pad.left + (index / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (value: Cents) =>
    pad.top + (1 - (value - min) / range) * (height - pad.top - pad.bottom);

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`).join(' ');
  const base = y(0);
  const area = `${line} L${x(points.length - 1)},${base} L${x(0)},${base} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const delta = (last?.value ?? 0) - (first?.value ?? 0);
  const improving = positiveIsGood ? delta >= 0 : delta <= 0;
  const activePoint = active !== null ? points[active] : null;

  /* La superficie va entre la línea y el cero. Si toda la serie está por debajo
     del cero —patrimonio negativo mientras queda deuda por pagar— pintarla de
     verde diría lo contrario de lo que pasa: ahí se queda en gris, y el color
     del cambio lo lleva la línea. */
  const belowZero = max <= 0 && min < 0;
  /* Bajo cero no se rellena: la superficie sería un bloque enorme que tapa la
     forma de la línea, y en verde diría además lo contrario de lo que pasa.
     El hueco hasta el cero ya cuenta cuánto falta para salir de números rojos. */
  const areaClass = belowZero ? 'fill-none' : improving ? 'fill-sage' : 'fill-stone-100';
  const since = first?.full ?? first?.label.toLowerCase() ?? '';

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Evolución de ${first?.label} a ${last?.label}: de ${formatCurrency(
          first?.value ?? 0,
        )} a ${formatCurrency(last?.value ?? 0)}.`}
      >
        {/* El cero, siempre visible */}
        <line
          x1={min < 0 ? pad.left + 20 : pad.left}
          x2={width - pad.right}
          y1={base}
          y2={base}
          className="stroke-stone-300"
          strokeWidth={1}
          strokeDasharray={min < 0 ? '3 3' : undefined}
        />
        {min < 0 ? (
          <text x={pad.left} y={base - 4} className="fill-muted" style={{ fontSize: 9 }}>
            0 €
          </text>
        ) : null}

        <path d={area} className={areaClass} />
        <path
          d={line}
          fill="none"
          className={improving ? 'stroke-forest' : 'stroke-stone-400'}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point, index) => (
          <g key={point.label}>
            {/* Área táctil generosa, invisible */}
            <rect
              x={x(index) - 14}
              y={0}
              width={28}
              height={height - pad.bottom}
              fill="transparent"
              onClick={() => setActive(active === index ? null : index)}
              style={{ cursor: 'pointer' }}
            />
            {index === points.length - 1 || active === index ? (
              <circle
                cx={x(index)}
                cy={y(point.value)}
                r={4}
                className="fill-forest stroke-surface"
                strokeWidth={2}
              />
            ) : null}
            <text
              x={x(index)}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted"
              style={{ fontSize: 9 }}
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Sólo los extremos llevan cifra; el resto se consulta tocando el punto. */}
      <div className="mt-1 flex items-baseline justify-between text-[11px] text-muted tnum">
        <span>{formatCurrency(first?.value ?? 0)}</span>
        <span className="font-semibold text-ink">{formatCurrency(last?.value ?? 0)}</span>
      </div>

      <p className={`mt-2 text-[12px] font-semibold tnum ${improving ? 'text-seed-700' : 'text-ink'}`}>
        {delta === 0
          ? `Igual que en ${since}`
          : `${formatCurrency(Math.abs(delta))} ${delta > 0 ? 'más' : 'menos'} que en ${since}`}
      </p>

      {activePoint ? (
        <p className="mt-2 rounded-xl bg-sage px-3 py-2 text-center text-[12px] text-seed-800 tnum">
          {activePoint.label} · {formatCurrency(activePoint.value)}
        </p>
      ) : null}
    </div>
  );
}
