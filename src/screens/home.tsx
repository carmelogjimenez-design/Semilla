'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Info } from 'lucide-react';
import { useMemo, useState } from 'react';

import { TransactionRow } from '@/components/transaction-row';
import { TransactionDetailSheet } from '@/components/flows/transaction-detail-sheet';
import { BudgetBar } from '@/components/ui/progress';
import { Avatar, Card, EmptyState, SectionTitle, StatusChip } from '@/components/ui/primitives';
import { SemillaMark } from '@/components/ui/logo';
import { paceLabel, statusLabel } from '@/domain/calculations';
import { isMonthClosable } from '@/domain/closing';
import { capitalize, formatDayShort, formatRange, monthKeyOf, monthLabel } from '@/domain/dates';
import { formatCurrency } from '@/domain/money';
import type { Transaction } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * INICIO responde a una sola pregunta: ¿cómo vamos? (§135)
 * El primer viewport enseña la semana, el estado y el dinero libre. Sin scroll.
 */
export function HomeScreen() {
  const { data, view, today, month, currentMember } = useSemilla();
  const [selected, setSelected] = useState<Transaction | null>(null);

  const week = view.currentWeek;
  const names = data.members.map((m) => m.name);
  const greeting =
    names.length === 0
      ? 'Hola'
      : names.length === 1
        ? `Hola, ${names[0]}`
        : `Hola, ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;

  const recent = data.transactions.slice(0, 6);
  const memberFor = (userId: string | null) =>
    data.members.find((m) => m.userId === userId) ?? null;

  const hasWeekBudget = Boolean(week && week.planned > 0);
  const span = view.currentWeekSpan;
  const elapsedRatio = span ? (span.days - view.daysLeftInWeek) / span.days : 0;
  /* Comparar contra el ritmo esperado a estas alturas de la semana, no contra el total. */
  const paceVariance = week ? Math.round(week.planned * elapsedRatio) - week.spent : 0;
  const next = view.upcoming.items[0] ?? null;

  /* El mes anterior sólo se recuerda si terminó, tuvo movimientos y sigue abierto. */
  const monthToClose = useMemo(() => {
    const previous = view.previousMonth;
    if (!isMonthClosable(previous, today)) return null;
    const hasActivity = data.transactions.some((t) => monthKeyOf(t.date) === previous);
    const alreadyClosed = data.monthlyCloses.some(
      (close) => close.month === previous && close.reopenedAt === null,
    );
    return hasActivity && !alreadyClosed ? previous : null;
  }, [view.previousMonth, today, data.transactions, data.monthlyCloses]);

  return (
    <div className="px-5 pb-nav pt-safe">
      {/* Cabecera */}
      <header className="flex items-start justify-between gap-3 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SemillaMark size={22} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-forest">Semilla</span>
          </div>
          <h1 className="mt-3 truncate text-title text-ink">{greeting}</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {capitalize(monthLabel(month))}
            {week ? ` · Semana ${week.week.index}` : ''}
          </p>
        </div>
        <Link href="/mas" aria-label="Familia y ajustes" className="flex -space-x-2 pt-1">
          {data.members.slice(0, 3).map((member) => (
            <Avatar
              key={member.id}
              initials={member.initials}
              accent={member.accent}
              size={32}
              className="ring-2 ring-bg"
            />
          ))}
        </Link>
      </header>

      {/* HERO — la semana (§17) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-[28px] bg-forest px-6 pb-6 pt-7 text-white shadow-raised"
      >
        {week ? (
          <>
            <p className="text-label text-white/55">
              {!hasWeekBudget
                ? 'Gastado esta semana'
                : week.available >= 0
                  ? 'Disponibles esta semana'
                  : 'Por encima esta semana'}
            </p>
            <p className="mt-2 text-hero tnum">
              {formatCurrency(hasWeekBudget ? Math.abs(week.available) : week.spent)}
            </p>

            {hasWeekBudget ? (
              <>
                <p className="mt-2 text-[13px] text-white/70 tnum">
                  {formatCurrency(week.spent)} de {formatCurrency(week.planned)}
                </p>
                <div className="mt-4">
                  <BudgetBar
                    value={week.ratio}
                    status={week.status}
                    height={10}
                    className="bg-white/15"
                    marker={elapsedRatio}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <StatusChip status={week.status} onDark>
                    {statusLabel(week.status)}
                  </StatusChip>
                  {elapsedRatio > 0.1 ? (
                    <p className="text-[13px] text-white/75 tnum">
                      {paceLabel(week.status, paceVariance)}
                    </p>
                  ) : (
                    <p className="text-[13px] text-white/75">Semana recién empezada</p>
                  )}
                </div>
                {view.daysLeftInWeek > 0 ? (
                  <p className="mt-3 text-[12px] text-white/50 tnum">
                    Quedan {view.daysLeftInWeek} {view.daysLeftInWeek === 1 ? 'día' : 'días'} · ritmo{' '}
                    {formatCurrency(view.pacePerDay)}/día. No es un objetivo de gasto.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 max-w-[30ch] text-[13px] leading-relaxed text-white/65">
                {formatRange(week.week.start, week.week.end)}. Cuando pongáis presupuesto semanal, aquí veréis
                cuánto os queda.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-label text-white/55">Esta semana</p>
            <p className="mt-2 text-hero tnum">{formatCurrency(0)}</p>
            <p className="mt-3 text-[13px] text-white/65">Todavía no hay movimientos este mes.</p>
          </>
        )}
      </motion.section>

      {/* DINERO LIBRE (§18) */}
      <FreeMoneyCard />

      {/* ESTE MES (§19) */}
      <section className="mt-4">
        <Card>
          <SectionTitle>Este mes</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <MonthFigure label="Ingresos" value={formatCurrency(view.monthSummary.income)} tone="leaf" />
            <MonthFigure label="Gastos" value={formatCurrency(view.monthSummary.expenses)} />
            <MonthFigure label="Pendiente" value={formatCurrency(view.monthSummary.pending)} tone="muted" />
          </div>
          {view.monthSummary.budget > 0 ? (
            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-between text-[12px] text-muted tnum">
                <span>{formatCurrency(view.monthSummary.budget)} de presupuesto</span>
                <span>{Math.round(view.monthSummary.usedRatio * 100)} %</span>
              </div>
              <BudgetBar value={view.monthSummary.usedRatio} status={view.monthSummary.status} />
            </div>
          ) : null}
        </Card>
      </section>

      {/* CIERRE DE MES PENDIENTE (§32) — un recordatorio, no una alarma */}
      {monthToClose ? (
        <section className="mt-4">
          <Link href="/mas/historico" className="block">
            <Card className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage text-lg" aria-hidden>
                📗
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink">
                  {capitalize(monthLabel(monthToClose))} ya terminó
                </span>
                <span className="block text-[13px] text-muted">
                  Cerradlo y queda guardado cómo fue
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-stone-400" />
            </Card>
          </Link>
        </section>
      ) : null}

      {/* ESTÁ CRECIENDO (§33) */}
      <section className="mt-4">
        <SectionTitle>Está creciendo</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <GrowthTile
            emoji="🛡️"
            label="Ahorro"
            value={formatCurrency(view.savingsTotal)}
            href="/mas/huchas"
          />
          <GrowthTile
            emoji="⚔️"
            label="Deuda reducida"
            value={formatCurrency(view.debtReducedSinceStart)}
            href="/mas/deudas"
          />
          <GrowthTile
            emoji="🔥"
            label="Racha"
            value={`${view.currentStreak} ${view.currentStreak === 1 ? 'semana' : 'semanas'}`}
          />
        </div>
      </section>

      {/* PRÓXIMO (§63) */}
      {next ? (
        <section className="mt-4">
          <SectionTitle>Próximo</SectionTitle>
          <Card className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warm text-lg" aria-hidden>
              📌
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-ink">{next.planned.name}</span>
              <span className="block text-[13px] text-muted">
                {next.status === 'overdue'
                  ? `Pendiente desde el ${formatDayShort(next.dueDate)}`
                  : formatDayShort(next.dueDate)}
              </span>
            </span>
            <span className="text-[15px] font-semibold tnum text-ink">
              {formatCurrency(next.expectedAmount)}
            </span>
          </Card>
        </section>
      ) : null}

      {/* ACTIVIDAD (§34) */}
      <section className="mt-4">
        <SectionTitle
          action={
            <Link href="/movimientos" className="flex items-center gap-0.5 text-[13px] font-medium text-forest">
              Ver todos <ChevronRight size={15} />
            </Link>
          }
        >
          Actividad
        </SectionTitle>

        {recent.length === 0 ? (
          <EmptyState
            title="Aún no hay movimientos"
            body="Planta la primera semilla: pulsa el botón + y registra lo primero que se os ocurra."
          />
        ) : (
          <Card className="px-3 py-2">
            <div className="divide-y divide-stone-100">
              {recent.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  data={data}
                  member={memberFor(transaction.ownerUserId)}
                  onPress={() => setSelected(transaction)}
                />
              ))}
            </div>
          </Card>
        )}
      </section>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-stone-400">
        Lo importante no es gastar perfecto.
        <br />
        Es saber dónde estáis.
      </p>

      <TransactionDetailSheet
        transaction={selected}
        onClose={() => setSelected(null)}
        currentMemberName={currentMember?.name ?? ''}
        today={today}
      />
    </div>
  );
}

function FreeMoneyCard() {
  const { view } = useSemilla();
  const [open, setOpen] = useState(false);
  const { free, balance, pendingPayments, reserved, savings } = view.freeMoney;

  return (
    <section className="mt-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label">Dinero libre</p>
            <p className="mt-1.5 text-display tnum text-ink">{formatCurrency(free)}</p>
            <p className="mt-1 text-[13px] text-muted">Después de cubrir lo que ya está comprometido.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Cómo se calcula el dinero libre"
            aria-expanded={open}
            className="touch -mr-2 -mt-1 rounded-full p-2 text-stone-400 active:bg-stone-100"
          >
            <Info size={18} />
          </button>
        </div>

        {open ? (
          <dl className="mt-4 space-y-1.5 rounded-2xl bg-warm p-4 text-[13px]">
            <Line label="Saldo en cuentas" value={formatCurrency(balance)} />
            <Line label="− Pagos pendientes" value={formatCurrency(pendingPayments)} />
            <Line label="− Dinero reservado" value={formatCurrency(reserved)} />
            <Line label="− Ahorro" value={formatCurrency(savings)} />
            <div className="!mt-3 flex justify-between border-t border-stone-200 pt-3 font-semibold text-ink">
              <span>Dinero libre</span>
              <span className="tnum">{formatCurrency(free)}</span>
            </div>
          </dl>
        ) : null}
      </Card>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}

function MonthFigure({
  label,
  value,
  tone = 'ink',
}: {
  label: string;
  value: string;
  tone?: 'ink' | 'leaf' | 'muted';
}) {
  const color = tone === 'leaf' ? 'text-seed-700' : tone === 'muted' ? 'text-muted' : 'text-ink';
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-[17px] font-semibold tnum ${color}`}>{value}</p>
    </div>
  );
}

function GrowthTile({
  emoji,
  label,
  value,
  href,
}: {
  emoji: string;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="text-lg" aria-hidden>
        {emoji}
      </span>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tnum text-ink">{value}</p>
    </>
  );
  const className = 'block rounded-3xl bg-surface p-4 text-left shadow-card transition active:bg-warm';
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
