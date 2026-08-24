'use client';

import { useEffect, useMemo, useState } from 'react';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, Field, Segmented, TextInput } from '@/components/ui/primitives';
import { allocationTransactions, buildWeeklyClose, type WeekCloseDraft } from '@/domain/closing';
import { formatRange, nowISO } from '@/domain/dates';
import { formatAmount, formatCurrency, parseCurrency } from '@/domain/money';
import type { MarginAllocationType } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * CIERRE DE SEMANA (§30, §31).
 *
 * El cierre no es un informe: es una decisión. Lo que sobró va a algún sitio, y
 * decidirlo aquí es lo que convierte una semana buena en algo que se nota.
 *
 * Una semana que se pasó del presupuesto también se cierra, sin adornos y sin
 * regañina: se dice cuánto, se recuerda que la siguiente empieza limpia y ya.
 */
export function WeekCloseSheet({
  open,
  onClose,
  draft,
}: {
  open: boolean;
  onClose: () => void;
  draft: WeekCloseDraft | null;
}) {
  const { data, actions, currentUserId } = useSemilla();

  const pockets = useMemo(() => data.pockets.filter((p) => !p.archived), [data.pockets]);
  const debts = useMemo(() => data.debts.filter((d) => !d.archived), [data.debts]);
  const mainAccount = data.accounts.find((a) => !a.archived && a.type === 'main') ?? data.accounts[0] ?? null;

  const [type, setType] = useState<MarginAllocationType>('save');
  const [pocketId, setPocketId] = useState<string>('');
  const [debtId, setDebtId] = useState<string>('');
  const [savingAmount, setSavingAmount] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const margin = draft?.margin ?? 0;

  useEffect(() => {
    if (!open || !draft) return;
    const first = pockets[0]?.id ?? '';
    const firstDebt = debts[0]?.id ?? '';
    setPocketId(first);
    setDebtId(firstDebt);
    setType(first ? 'save' : firstDebt ? 'debt' : 'keep');
    setSavingAmount(formatAmount(Math.max(0, draft.margin), 'never'));
    setDebtAmount(formatAmount(Math.max(0, draft.margin), 'never'));
    setBusy(false);
  }, [open, draft, pockets, debts]);

  if (!draft) return null;

  const saving = type === 'save' ? parseCurrency(savingAmount) : type === 'split' ? parseCurrency(savingAmount) : 0;
  const toDebt = type === 'debt' ? parseCurrency(debtAmount) : type === 'split' ? parseCurrency(debtAmount) : 0;
  const assigned = saving + toDebt;
  const tooMuch = margin > 0 && assigned > margin;

  const options: { value: MarginAllocationType; label: string }[] = [
    ...(pockets.length > 0 ? [{ value: 'save' as const, label: 'Hucha' }] : []),
    ...(debts.length > 0 ? [{ value: 'debt' as const, label: 'Deuda' }] : []),
    ...(pockets.length > 0 && debts.length > 0 ? [{ value: 'split' as const, label: 'Repartir' }] : []),
    { value: 'keep', label: 'Dejarlo' },
  ];

  async function confirm() {
    if (!draft) return;
    setBusy(true);
    try {
      const now = nowISO();
      const allocation =
        margin > 0 && type !== 'keep'
          ? {
              type,
              savingCents: saving,
              debtCents: toDebt,
              pocketId: saving > 0 ? pocketId : null,
              debtId: toDebt > 0 ? debtId : null,
            }
          : margin > 0
            ? { type: 'keep' as const, savingCents: 0, debtCents: 0, pocketId: null, debtId: null }
            : null;

      if (allocation) {
        const created = allocationTransactions({
          allocation,
          draft,
          householdId: data.household.id,
          userId: currentUserId,
          accountId: mainAccount?.id ?? null,
          now,
          ids: [crypto.randomUUID(), crypto.randomUUID()],
        });
        for (const transaction of created) await actions.addTransaction(transaction);
      }

      await actions.saveWeeklyClose(
        buildWeeklyClose({
          draft,
          householdId: data.household.id,
          userId: currentUserId,
          allocation,
          now,
          id: crypto.randomUUID(),
        }),
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Cerrar la semana ${draft.week.index}`}
      subtitle={formatRange(draft.week.start, draft.week.end)}
      /* Repartir de más avisa, pero no bloquea: la app orienta, no manda (§53). */
      footer={
        <Button full onClick={confirm} disabled={busy}>
          {busy ? 'Cerrando…' : 'Cerrar la semana'}
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        {/* El resultado, sin adornos. Una semana pasada de presupuesto no se pinta
            de verde: se dice en tono neutro, que no es lo mismo que en tono grave. */}
        <div className={`rounded-3xl px-5 py-5 ${margin >= 0 ? 'bg-sage' : 'bg-warm'}`}>
          <p
            className={`text-[12px] font-semibold uppercase tracking-wide ${
              margin >= 0 ? 'text-seed-800/70' : 'text-muted'
            }`}
          >
            {draft.planned === 0 ? 'Gastado' : margin >= 0 ? 'Os sobró' : 'Os pasasteis'}
          </p>
          <p className={`mt-1 text-display tnum ${margin >= 0 ? 'text-seed-900' : 'text-ink'}`}>
            {formatCurrency(draft.planned === 0 ? draft.spent : Math.abs(margin))}
          </p>
          {draft.planned > 0 ? (
            <p
              className={`mt-2 text-[13px] leading-relaxed tnum ${
                margin >= 0 ? 'text-seed-800/80' : 'text-muted'
              }`}
            >
              {formatCurrency(draft.spent)} de {formatCurrency(draft.planned)}.{' '}
              {margin >= 0
                ? 'Ese dinero es real y podéis moverlo ahora.'
                : 'La semana que viene empieza limpia: esto no se arrastra.'}
            </p>
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Esta semana no tenía presupuesto, así que no hay margen que repartir.
            </p>
          )}
        </div>

        {margin > 0 ? (
          <>
            <Field label="¿Qué hacéis con lo que sobró?">
              <Segmented options={options} value={type} onChange={setType} />
            </Field>

            {type === 'save' || type === 'split' ? (
              <>
                <Field label="A la hucha">
                  <select
                    value={pocketId}
                    onChange={(event) => setPocketId(event.target.value)}
                    className="w-full rounded-2xl border border-stone-200 bg-surface px-4 py-3 text-[16px] text-ink"
                  >
                    {pockets.map((pocket) => (
                      <option key={pocket.id} value={pocket.id}>
                        {pocket.emoji} {pocket.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cuánto ahorráis">
                  <TextInput
                    inputMode="decimal"
                    value={savingAmount}
                    onChange={(event) => setSavingAmount(event.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {type === 'debt' || type === 'split' ? (
              <>
                <Field label="A la deuda">
                  <select
                    value={debtId}
                    onChange={(event) => setDebtId(event.target.value)}
                    className="w-full rounded-2xl border border-stone-200 bg-surface px-4 py-3 text-[16px] text-ink"
                  >
                    {debts.map((debt) => (
                      <option key={debt.id} value={debt.id}>
                        {debt.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cuánto amortizáis" hint="Va como amortización extraordinaria, no como cuota.">
                  <TextInput
                    inputMode="decimal"
                    value={debtAmount}
                    onChange={(event) => setDebtAmount(event.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {type === 'keep' ? (
              <p className="rounded-2xl bg-warm px-4 py-3 text-[13px] leading-relaxed text-ink">
                Se queda en la cuenta. También es una decisión: tener colchón disponible no es no hacer nada.
              </p>
            ) : null}

            {tooMuch ? (
              <p className="text-[13px] font-medium text-coral-deep tnum">
                Estáis repartiendo {formatCurrency(assigned)} y sólo sobraron {formatCurrency(margin)}. Podéis
                hacerlo si el dinero está, pero conviene revisarlo.
              </p>
            ) : null}
          </>
        ) : null}

        <p className="text-[12px] leading-relaxed text-stone-400">
          Cerrar una semana no bloquea nada: podéis reabrirla desde el histórico si aparece un movimiento
          que faltaba.
        </p>
      </div>
    </BottomSheet>
  );
}
