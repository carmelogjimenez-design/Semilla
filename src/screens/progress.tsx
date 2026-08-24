'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { GoalSheet } from '@/components/flows/goal-sheet';
import { TrendChart, type TrendPoint } from '@/components/trend-chart';
import { BudgetBar } from '@/components/ui/progress';
import { Button, Card, Chip, EmptyState, SectionTitle } from '@/components/ui/primitives';
import { evaluateAchievements } from '@/domain/achievements';
import { calculateGoalProgress } from '@/domain/calculations';
import { MONTH_SHORT, formatDayFull, formatDayLong, monthIndex, monthLabel } from '@/domain/dates';
import { formatCurrency, formatPercent } from '@/domain/money';
import {
  buildMonthlySeries,
  calculateMarginGenerated,
  projectAtCurrentPace,
  timeProgress,
} from '@/domain/progress';
import { useSemilla } from '@/state/semilla-provider';

/**
 * PROGRESO responde a: ¿está sirviendo el esfuerzo? (§33, §34, §35, §66, §135)
 *
 * Es la pantalla del ánimo, pero no de la mentira: las proyecciones se muestran
 * como proyecciones, y si no hay recorrido suficiente para estimar, no se estima.
 */

type Series = 'netWorth' | 'savings' | 'debt';

export function ProgressScreen() {
  const { data, view, today, month } = useSemilla();
  const [series, setSeries] = useState<Series>('netWorth');
  const [editingGoal, setEditingGoal] = useState(false);

  const margin = useMemo(() => calculateMarginGenerated(data), [data]);
  const monthly = useMemo(() => buildMonthlySeries(data, month, 6, today), [data, month, today]);

  const goal = data.goals.find((entry) => entry.active) ?? null;
  const goalProgress = goal
    ? calculateGoalProgress(goal, {
        transactions: data.transactions,
        greenWeeks: view.greenWeeks,
        today,
      })
    : null;
  const goalTime = goal ? timeProgress(goal.startDate, goal.endDate, today) : null;
  const projection = goal
    ? projectAtCurrentPace({ data, from: goal.startDate, to: goal.endDate, today })
    : null;

  const achievements = useMemo(
    () => evaluateAchievements(view.achievementContext, data.achievements),
    [view.achievementContext, data.achievements],
  );
  const unlocked = achievements.filter((entry) => entry.unlocked);

  const points: TrendPoint[] = monthly.map((point) => ({
    label: (MONTH_SHORT[monthIndex(point.month)] ?? '').toUpperCase(),
    full: monthLabel(point.month, { capitalize: false }),
    value: series === 'netWorth' ? point.netWorth : series === 'savings' ? point.savings : point.debt,
  }));

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <h1 className="text-title text-ink">Progreso</h1>
        <p className="mt-0.5 text-[13px] text-muted">¿Está sirviendo el esfuerzo?</p>
      </header>

      {/* LO QUE ESTÁ CRECIENDO (§33) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-[28px] bg-forest px-6 py-7 text-white shadow-raised"
      >
        <p className="text-label text-white/55">Lo que está creciendo</p>
        <div className="mt-5 space-y-5">
          <Growing label="Ahorro" value={formatCurrency(view.savingsTotal)} href="/mas/huchas" />
          <Growing
            label="Deuda reducida"
            value={formatCurrency(view.debtReducedTotal)}
            href="/mas/deudas"
          />
          <Growing label="Margen generado" value={formatCurrency(margin)} />
        </div>
      </motion.section>

      {/* OBJETIVO (§34) */}
      <section className="mt-6">
        <SectionTitle
          action={
            goal ? (
              <button
                type="button"
                onClick={() => setEditingGoal(true)}
                className="text-[13px] font-medium text-forest"
              >
                Editar
              </button>
            ) : undefined
          }
        >
          Objetivo
        </SectionTitle>

        {goal && goalProgress && goalTime ? (
          <Card>
            <p className="text-[17px] font-semibold text-ink">{goal.name}</p>
            {/* El año va en el final: un objetivo largo cruza de año y «1 agosto
                → 31 julio» a secas no dice a cuál de los dos se refiere. */}
            <p className="mt-0.5 text-[13px] text-muted">
              {formatDayLong(goal.startDate)} → {formatDayFull(goal.endDate)}
            </p>

            <div className="mt-4 flex items-baseline justify-between text-[12px] text-muted tnum">
              <span>
                Semana {goalTime.weeksElapsed} de {goalTime.weeksTotal}
              </span>
              <span>{formatPercent(goalProgress.overallRatio)} completado</span>
            </div>
            <div className="mt-2">
              <BudgetBar
                value={goalProgress.overallRatio}
                status="green"
                height={10}
                marker={goalTime.ratio}
                label={`Progreso del objetivo ${goal.name}`}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted">
              La marca fina señala por dónde iría el calendario.
            </p>

            <div className="mt-5 space-y-4">
              {goal.savingsTarget > 0 ? (
                <GoalLine
                  label="Ahorrar"
                  current={goalProgress.savings.current}
                  target={goalProgress.savings.target}
                  ratio={goalProgress.savings.ratio}
                />
              ) : null}
              {goal.extraDebtTarget > 0 ? (
                <GoalLine
                  label="Amortizar de más"
                  current={goalProgress.extraDebt.current}
                  target={goalProgress.extraDebt.target}
                  ratio={goalProgress.extraDebt.ratio}
                />
              ) : null}
              {goal.greenWeeksTarget > 0 ? (
                <GoalLine
                  label="Semanas verdes"
                  current={goalProgress.greenWeeks.current}
                  target={goalProgress.greenWeeks.target}
                  ratio={goalProgress.greenWeeks.ratio}
                  unit="semanas"
                />
              ) : null}
            </div>

            {/* Sin esta frase, ver «300 € de 15.000 €» debajo de un ahorro total
                mucho mayor parece un error de la app. Cuenta desde el inicio. */}
            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              Cuenta lo hecho desde el {formatDayLong(goal.startDate)}. Lo que ya teníais ahorrado antes
              sigue ahí, pero no suma a este objetivo.
            </p>
          </Card>
        ) : (
          <EmptyState
            emoji="🎯"
            title="Sin objetivo activo"
            body="Un objetivo con fecha convierte el esfuerzo de cada semana en una dirección."
            action={<Button onClick={() => setEditingGoal(true)}>Crear un objetivo</Button>}
          />
        )}
      </section>

      {/* PROYECCIÓN (§35) */}
      {goal && projection ? (
        <section className="mt-6">
          <SectionTitle>Si mantenéis este ritmo…</SectionTitle>
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ahorro</p>
                <p className="mt-1 text-[19px] font-semibold tnum text-seed-700">
                  {formatCurrency(projection.projectedSavings, { decimals: 'never' })}
                </p>
                <p className="mt-0.5 text-[12px] text-muted tnum">
                  {formatCurrency(projection.savingsPerMonth, { decimals: 'never' })}/mes
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Amortización extra
                </p>
                <p className="mt-1 text-[19px] font-semibold tnum text-ink">
                  {formatCurrency(projection.projectedExtraDebt, { decimals: 'never' })}
                </p>
                <p className="mt-0.5 text-[12px] text-muted tnum">
                  {formatCurrency(projection.extraDebtPerMonth, { decimals: 'never' })}/mes
                </p>
              </div>
            </div>
            {/* Cifras redondeadas a euros a propósito: son una estimación, y los
                céntimos darían una precisión que no tienen. */}
            <p className="mt-4 text-[12px] leading-relaxed text-muted">
              Estimado a {formatDayFull(goal.endDate)} con el ritmo de {observedLabel(projection.daysObserved)}.
              Es una proyección, no una certeza: cambiará según lo que hagáis.
            </p>
          </Card>
        </section>
      ) : null}

      {/* PATRIMONIO (§36) */}
      <section className="mt-6">
        <SectionTitle>Evolución</SectionTitle>
        <Card>
          <div className="mb-4 flex gap-2">
            <Chip active={series === 'netWorth'} onClick={() => setSeries('netWorth')}>
              Patrimonio
            </Chip>
            <Chip active={series === 'savings'} onClick={() => setSeries('savings')}>
              Ahorro
            </Chip>
            <Chip active={series === 'debt'} onClick={() => setSeries('debt')}>
              Deuda
            </Chip>
          </div>

          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {series === 'netWorth' ? 'Patrimonio' : series === 'savings' ? 'Ahorro' : 'Deuda viva'}
          </p>
          <p className="mb-4 text-display tnum text-ink">
            {formatCurrency(
              series === 'netWorth'
                ? view.netWorth.total
                : series === 'savings'
                  ? view.savingsTotal
                  : view.debtTotal,
            )}
          </p>

          <TrendChart points={points} positiveIsGood={series !== 'debt'} />

          {/* Las huchas no se suman aparte: son etiquetas sobre el dinero que ya
              está en las cuentas. Sumarlas sería contarlo dos veces. */}
          {series === 'netWorth' ? (
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Lo que tenéis en las cuentas menos lo que debéis. Las huchas ya están dentro: son etiquetas
              sobre ese mismo dinero, no un saldo aparte. La vivienda no entra: no es dinero disponible.
            </p>
          ) : null}
        </Card>
      </section>

      {/* RACHA Y LOGROS (§37, §38) */}
      <section className="mt-6">
        <SectionTitle
          action={
            <Link href="/mas/logros" className="flex items-center gap-0.5 text-[13px] font-medium text-forest">
              Ver todos <ChevronRight size={15} />
            </Link>
          }
        >
          Constancia
        </SectionTitle>

        <div className="grid grid-cols-2 gap-3">
          <Card className="py-4">
            <span className="text-lg" aria-hidden>
              🔥
            </span>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Racha</p>
            <p className="mt-0.5 text-[17px] font-semibold tnum text-ink">
              {view.currentStreak} {view.currentStreak === 1 ? 'semana' : 'semanas'}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-muted">
              {view.currentStreak > 0
                ? 'Semanas seguidas dentro del plan'
                : 'Esta semana empezamos una nueva'}
            </p>
          </Card>
          <Card className="py-4">
            <span className="text-lg" aria-hidden>
              🏅
            </span>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Logros</p>
            <p className="mt-0.5 text-[17px] font-semibold tnum text-ink">
              {unlocked.length} de {achievements.length}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-muted">Del hogar, no de uno</p>
          </Card>
        </div>

        {/* Una franja que se arrastra tiene que poder recorrerse con el teclado:
            dentro sólo hay texto, así que el foco va en la propia franja. */}
        {unlocked.length > 0 ? (
          <div className="rail mt-3" tabIndex={0} role="group" aria-label="Logros conseguidos">
            {unlocked.slice(-6).map((entry) => (
              <span
                key={entry.id}
                className="flex shrink-0 items-center gap-2 rounded-full bg-sage px-3 py-2 text-[13px] font-medium text-seed-800"
              >
                <span aria-hidden>{entry.emoji}</span>
                {entry.title}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-muted">
        Vuestro ahorro está echando raíces.
      </p>

      <GoalSheet open={editingGoal} onClose={() => setEditingGoal(false)} goal={goal} />
    </div>
  );
}

/** «las últimas 3 semanas» · «los últimos 5 meses» — nunca «los últimos 0,8 meses». */
function observedLabel(days: number): string {
  if (days < 75) {
    const weeks = Math.max(1, Math.round(days / 7));
    return weeks === 1 ? 'la última semana' : `las últimas ${weeks} semanas`;
  }
  const months = Math.max(2, Math.round(days / 30.44));
  return `los últimos ${months} meses`;
}

function Growing({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold uppercase tracking-wide text-white/55">
          {label}
        </span>
        <span className="mt-1 block text-[26px] font-semibold tnum">{value}</span>
      </span>
      {href ? <ChevronRight size={18} className="shrink-0 text-white/60" /> : null}
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-3">
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-3">{content}</div>
  );
}

function GoalLine({
  label,
  current,
  target,
  ratio,
  unit,
}: {
  label: string;
  current: number;
  target: number;
  ratio: number;
  unit?: string;
}) {
  const format = (value: number) => (unit ? `${value} ${unit}` : formatCurrency(value));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
        <span className="text-ink">{label}</span>
        <span className="tnum text-muted">
          <span className="font-semibold text-ink">{format(current)}</span> de {format(target)}
        </span>
      </div>
      <BudgetBar value={ratio} status="green" height={6} />
    </div>
  );
}
