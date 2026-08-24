'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Flame, Pencil, Plus, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddTransactionSheet } from '@/components/flows/add-transaction-sheet';
import { DebtChart } from '@/components/debt-chart';
import { DebtSheet } from '@/components/flows/debt-sheet';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { DebtBar } from '@/components/ui/progress';
import { Button, Card, EmptyState, SectionTitle } from '@/components/ui/primitives';
import { formatDayLong } from '@/domain/dates';
import { formatCurrency, formatPercent } from '@/domain/money';
import { debtsWithBalance } from '@/domain/selectors';
import type { Debt } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * DEUDA responde a: ¿cuánto estamos reduciendo? (§29, §30, §135)
 *
 * La deuda se dibuja como algo que se consume, no como una losa. Lo que manda
 * en la pantalla no es lo que queda: es lo que ya habéis quitado de en medio.
 */
export function DebtsScreen() {
  const { data, view, today } = useSemilla();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [selected, setSelected] = useState<Debt | null>(null);
  const [payment, setPayment] = useState<{ debtId: string; type: 'installment' | 'extra' } | null>(
    null,
  );

  const rows = useMemo(() => debtsWithBalance(data.debts, data.transactions), [data.debts, data.transactions]);
  const selectedRow = selected ? rows.find((row) => row.debt.id === selected.id) : null;

  const totalInitial = rows.reduce((sum, row) => sum + row.debt.initialBalance, 0);
  const globalRatio = totalInitial > 0 ? view.debtReducedTotal / totalInitial : 0;

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <Link href="/mas" className="text-[13px] font-medium text-muted">
          ‹ Más
        </Link>
        <h1 className="mt-1 text-title text-ink">Deuda</h1>
        <p className="mt-0.5 text-[13px] text-muted">Cuánto estáis reduciendo</p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          emoji="🏦"
          title="Ninguna deuda registrada"
          body="Si tenéis préstamos, apuntarlos aquí es lo que permite verlos bajar mes a mes."
          action={<Button onClick={() => setCreating(true)}>Añadir una deuda</Button>}
        />
      ) : (
        <>
          {/* Hero: lo que queda, y sobre todo lo que ya no está */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-[28px] bg-forest px-6 pb-6 pt-7 text-white shadow-raised"
          >
            <p className="text-label text-white/55">Deuda total</p>
            <p className="mt-2 text-hero tnum">{formatCurrency(view.debtTotal)}</p>

            <div className="mt-5">
              <DebtBar paidRatio={globalRatio} className="bg-white/15" />
            </div>

            <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-[13px] text-white/75 tnum">
                ↓ {formatCurrency(view.debtReducedTotal)} eliminados
              </p>
              {totalInitial > 0 ? (
                <p className="text-[13px] text-white/50 tnum">{formatPercent(globalRatio)} del total</p>
              ) : null}
            </div>

            {view.debtReducedSinceStart > 0 ? (
              <p className="mt-3 text-[12px] leading-relaxed text-white/50 tnum">
                Desde que usáis Semilla habéis pagado {formatCurrency(view.debtReducedSinceStart)}, de los
                cuales {formatCurrency(view.extraDebtTotal)} fueron amortizaciones extraordinarias.
              </p>
            ) : null}
          </motion.section>

          <section className="mt-6">
            <SectionTitle>Vuestras deudas</SectionTitle>
            <div className="space-y-3">
              {rows.map((row) => (
                <motion.button
                  key={row.debt.id}
                  type="button"
                  onClick={() => setSelected(row.debt)}
                  whileTap={{ scale: 0.99 }}
                  className="block w-full rounded-3xl bg-surface p-4 text-left shadow-card"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                      {row.debt.name}
                    </span>
                    <span className="text-[17px] font-semibold tnum text-ink">
                      {formatCurrency(row.balance)}
                    </span>
                  </div>

                  <div className="mt-3">
                    <DebtBar paidRatio={row.ratio} />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-muted tnum">
                    {row.debt.installment > 0 ? (
                      <span>Cuota {formatCurrency(row.debt.installment)}</span>
                    ) : null}
                    {row.debt.interestBps > 0 ? (
                      <span>TIN {(row.debt.interestBps / 100).toFixed(2).replace('.', ',')} %</span>
                    ) : null}
                    {row.paid > 0 ? (
                      <span className="text-seed-700">↓ {formatCurrency(row.paid)}</span>
                    ) : null}
                  </div>
                </motion.button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-5 flex w-full touch items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 py-4 text-[14px] font-semibold text-muted active:bg-stone-100"
            >
              <Plus size={18} /> Nueva deuda
            </button>
          </section>

          <p className="mt-6 text-center text-[12px] leading-relaxed text-stone-400">
            Cada mes hay menos.
          </p>
        </>
      )}

      {/* Detalle de una deuda */}
      <BottomSheet
        open={selectedRow !== null}
        onClose={() => setSelected(null)}
        title={selectedRow?.debt.name ?? ''}
        subtitle={selectedRow ? `Desde ${formatDayLong(selectedRow.debt.trackingStart)}` : undefined}
      >
        {selectedRow ? (
          <div className="pb-4">
            <p className="pt-3 text-center text-hero tnum text-ink">
              {formatCurrency(selectedRow.balance)}
            </p>
            <p className="mb-5 text-center text-[13px] text-muted">pendiente</p>

            <Card className="p-4">
              <DebtChart debt={selectedRow.debt} transactions={data.transactions} today={today} />
            </Card>

            <dl className="mt-4 space-y-1 rounded-2xl bg-warm p-4 text-[13px]">
              <Row label="Importe original" value={formatCurrency(selectedRow.debt.initialBalance)} />
              <Row label="Ya eliminado" value={formatCurrency(selectedRow.paid)} />
              {selectedRow.debt.installment > 0 ? (
                <Row label="Cuota mensual" value={formatCurrency(selectedRow.debt.installment)} />
              ) : null}
              {selectedRow.debt.interestBps > 0 ? (
                <Row
                  label="Interés (TIN)"
                  value={`${(selectedRow.debt.interestBps / 100).toFixed(2).replace('.', ',')} %`}
                />
              ) : null}
              {selectedRow.debt.endDate ? (
                <Row label="Vencimiento" value={formatDayLong(selectedRow.debt.endDate)} />
              ) : null}
            </dl>

            {selectedRow.debt.notes ? (
              <p className="mt-3 text-[13px] leading-relaxed text-muted">{selectedRow.debt.notes}</p>
            ) : null}

            <div className="mt-6 grid grid-cols-3 gap-2">
              <ActionTile
                icon={<Flame size={18} />}
                label="Amortizar"
                highlight
                onClick={() => setPayment({ debtId: selectedRow.debt.id, type: 'extra' })}
              />
              <ActionTile
                icon={<Receipt size={18} />}
                label="Cuota"
                onClick={() => setPayment({ debtId: selectedRow.debt.id, type: 'installment' })}
              />
              <ActionTile
                icon={<Pencil size={18} />}
                label="Editar"
                onClick={() => {
                  setEditing(selectedRow.debt);
                  setSelected(null);
                }}
              />
            </div>

            <p className="mt-3 text-center text-[12px] leading-relaxed text-stone-400">
              La cuota es lo normal. La amortización extraordinaria es la que acorta el préstamo.
            </p>
          </div>
        ) : null}
      </BottomSheet>

      <DebtSheet open={creating} onClose={() => setCreating(false)} debt={null} />
      <DebtSheet open={editing !== null} onClose={() => setEditing(null)} debt={editing} />

      <AddTransactionSheet
        open={payment !== null}
        onClose={() => {
          setPayment(null);
          setSelected(null);
        }}
        preset={payment ? { kind: 'debtPayment', debtId: payment.debtId, paymentType: payment.type } : undefined}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tnum text-ink">{value}</dd>
    </div>
  );
}

function ActionTile({
  icon,
  label,
  onClick,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex touch flex-col items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-semibold transition active:scale-[0.98] ${
        highlight ? 'bg-sage text-seed-800' : 'bg-stone-100 text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
