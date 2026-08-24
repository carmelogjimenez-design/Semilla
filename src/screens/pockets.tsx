'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Minus, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddTransactionSheet } from '@/components/flows/add-transaction-sheet';
import { PocketSheet } from '@/components/flows/pocket-sheet';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { BudgetBar, GrowthMark, PocketGlass } from '@/components/ui/progress';
import { Button, Card, EmptyState, SectionTitle } from '@/components/ui/primitives';
import { formatDayLong } from '@/domain/dates';
import { formatCurrency, formatPercent } from '@/domain/money';
import { pocketsWithBalance } from '@/domain/selectors';
import type { SavingsPocket } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * HUCHAS responde a: ¿qué estamos construyendo? (§27, §28, §135)
 *
 * Dos cosas que suman pero no significan lo mismo:
 *   · Ahorro     — dinero que se queda.
 *   · Reservado  — dinero que ya tiene destino, un gasto futuro apartado.
 */
export function PocketsScreen() {
  const { data, view } = useSemilla();
  const [editing, setEditing] = useState<SavingsPocket | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<SavingsPocket | null>(null);
  const [movement, setMovement] = useState<{ pocketId: string; direction: 'in' | 'out' } | null>(null);

  const rows = useMemo(
    () => pocketsWithBalance(data.pockets, data.transactions),
    [data.pockets, data.transactions],
  );

  const savings = rows.filter((row) => row.pocket.type === 'savings');
  const reserved = rows.filter((row) => row.pocket.type === 'reserved');
  const selectedRow = selected ? rows.find((row) => row.pocket.id === selected.id) : null;

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <Link href="/mas" className="text-[13px] font-medium text-muted">
          ‹ Más
        </Link>
        <h1 className="mt-1 text-title text-ink">Huchas</h1>
        <p className="mt-0.5 text-[13px] text-muted">Qué estáis construyendo</p>
      </header>

      {/* Los dos totales, separados a propósito */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-4">
          <p className="label">Ahorro</p>
          <p className="mt-1.5 text-[22px] font-semibold tnum text-seed-700">
            {formatCurrency(view.savingsTotal)}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-muted">Dinero que se queda</p>
        </Card>
        <Card className="py-4">
          <p className="label">Reservado</p>
          <p className="mt-1.5 text-[22px] font-semibold tnum text-ink">
            {formatCurrency(view.reservedTotal)}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-muted">Ya tiene destino</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            emoji="🫙"
            title="Todavía no hay huchas"
            body="Una hucha es algo concreto que queréis ver crecer: un colchón, un coche, la Navidad."
            action={<Button onClick={() => setCreating(true)}>Crear la primera</Button>}
          />
        </div>
      ) : (
        <>
          {savings.length > 0 ? (
            <PocketGroup title="Ahorro" rows={savings} onSelect={setSelected} />
          ) : null}
          {reserved.length > 0 ? (
            <PocketGroup title="Reservado para un gasto futuro" rows={reserved} onSelect={setSelected} />
          ) : null}

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-5 flex w-full touch items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 py-4 text-[14px] font-semibold text-muted active:bg-stone-100"
          >
            <Plus size={18} /> Nueva hucha
          </button>
        </>
      )}

      {/* Acciones de una hucha */}
      <BottomSheet
        open={selectedRow !== null}
        onClose={() => setSelected(null)}
        title={selectedRow ? `${selectedRow.pocket.emoji} ${selectedRow.pocket.name}` : ''}
        subtitle={
          selectedRow?.pocket.type === 'savings' ? 'Ahorro' : 'Dinero reservado para un gasto futuro'
        }
      >
        {selectedRow ? (
          <div className="pb-4">
            <p className="py-4 text-center text-hero tnum text-ink">
              {formatCurrency(selectedRow.balance)}
            </p>

            {selectedRow.pocket.targetAmount ? (
              <>
                <div className="mb-2 flex items-baseline justify-between text-[13px] text-muted tnum">
                  <span>Objetivo {formatCurrency(selectedRow.pocket.targetAmount)}</span>
                  <span>{formatPercent(selectedRow.ratio)}</span>
                </div>
                <BudgetBar value={selectedRow.ratio} status="green" height={10} />
                {selectedRow.pocket.targetDate ? (
                  <p className="mt-2 text-[12px] text-muted">
                    Fecha objetivo: {formatDayLong(selectedRow.pocket.targetDate)}
                  </p>
                ) : null}
              </>
            ) : null}

            <div className="mt-6 grid grid-cols-3 gap-2">
              <ActionTile
                icon={<Plus size={18} />}
                label="Guardar"
                onClick={() => setMovement({ pocketId: selectedRow.pocket.id, direction: 'in' })}
              />
              <ActionTile
                icon={<Minus size={18} />}
                label="Sacar"
                onClick={() => setMovement({ pocketId: selectedRow.pocket.id, direction: 'out' })}
              />
              <ActionTile
                icon={<Pencil size={18} />}
                label="Editar"
                onClick={() => {
                  setEditing(selectedRow.pocket);
                  setSelected(null);
                }}
              />
            </div>
          </div>
        ) : null}
      </BottomSheet>

      <PocketSheet open={creating} onClose={() => setCreating(false)} pocket={null} />
      <PocketSheet open={editing !== null} onClose={() => setEditing(null)} pocket={editing} />

      <AddTransactionSheet
        open={movement !== null}
        onClose={() => {
          setMovement(null);
          setSelected(null);
        }}
        preset={
          movement
            ? { kind: 'saving', pocketId: movement.pocketId, savingDirection: movement.direction }
            : undefined
        }
      />
    </div>
  );
}

function PocketGroup({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: { pocket: SavingsPocket; balance: number; ratio: number }[];
  onSelect: (pocket: SavingsPocket) => void;
}) {
  return (
    <section className="mt-6">
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-3">
        {rows.map((row) => {
          const milestone = milestoneOf(row.ratio, Boolean(row.pocket.targetAmount));
          return (
            <motion.button
              key={row.pocket.id}
              type="button"
              onClick={() => onSelect(row.pocket)}
              whileTap={{ scale: 0.99 }}
              className="flex w-full items-center gap-4 rounded-3xl bg-surface p-4 text-left shadow-card"
            >
              <PocketGlass ratio={row.ratio} emoji={row.pocket.emoji} size={54} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                    {row.pocket.name}
                  </span>
                  {milestone ? (
                    <span className="shrink-0 rounded-full bg-sage px-2 py-0.5 text-[11px] font-semibold text-seed-800">
                      {milestone}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] tnum text-muted">
                  <span className="font-semibold text-ink">{formatCurrency(row.balance)}</span>
                  {row.pocket.targetAmount ? ` de ${formatCurrency(row.pocket.targetAmount)}` : ''}
                </p>
                {row.pocket.targetAmount ? (
                  <div className="mt-2 flex items-center gap-2">
                    <BudgetBar value={row.ratio} status="green" height={6} className="flex-1" />
                    <GrowthMark progress={row.ratio} className="text-[13px]" />
                  </div>
                ) : null}
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

/** §28 — pequeñas celebraciones al cruzar cada cuarto del camino. */
function milestoneOf(ratio: number, hasTarget: boolean): string | null {
  if (!hasTarget) return null;
  if (ratio >= 1) return '¡Completa!';
  if (ratio >= 0.75) return '75 %';
  if (ratio >= 0.5) return 'Mitad';
  if (ratio >= 0.25) return '25 %';
  return null;
}

function ActionTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex touch flex-col items-center justify-center gap-1.5 rounded-2xl bg-stone-100 py-3.5 text-[13px] font-semibold text-ink transition active:scale-[0.98]"
    >
      {icon}
      {label}
    </button>
  );
}
