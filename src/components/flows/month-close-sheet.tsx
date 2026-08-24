'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/primitives';
import { buildMonthlyClose, type MonthCloseDraft } from '@/domain/closing';
import { capitalize, monthLabel, nowISO } from '@/domain/dates';
import { formatCurrency } from '@/domain/money';
import { useSemilla } from '@/state/semilla-provider';

/**
 * CIERRE DE MES (§32).
 *
 * Un mes se cierra leyendo lo que pasó, no rellenando nada. Las frases se generan
 * con reglas, no con IA: cada una sale de una comparación real, y si no hay base
 * para decir algo, no se dice.
 */
export function MonthCloseSheet({
  open,
  onClose,
  draft,
}: {
  open: boolean;
  onClose: () => void;
  draft: MonthCloseDraft | null;
}) {
  const { data, actions, currentUserId } = useSemilla();
  const [busy, setBusy] = useState(false);

  if (!draft) return null;

  async function confirm() {
    if (!draft) return;
    setBusy(true);
    try {
      await actions.saveMonthlyClose(
        buildMonthlyClose({
          draft,
          householdId: data.household.id,
          userId: currentUserId,
          now: nowISO(),
          id: crypto.randomUUID(),
        }),
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const positive = draft.result >= 0;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Cerrar ${monthLabel(draft.month, { year: true, capitalize: false })}`}
      subtitle="Lo que pasó, contado tal cual."
      footer={
        <Button full onClick={confirm} disabled={busy}>
          {busy ? 'Cerrando…' : 'Cerrar el mes'}
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <div className={`rounded-3xl px-5 py-5 ${positive ? 'bg-sage' : 'bg-warm'}`}>
          <p
            className={`text-[12px] font-semibold uppercase tracking-wide ${
              positive ? 'text-seed-800' : 'text-muted'
            }`}
          >
            {positive ? 'Resultado del mes' : 'Salió más de lo que entró'}
          </p>
          <p className={`mt-1 text-display tnum ${positive ? 'text-seed-900' : 'text-ink'}`}>
            {formatCurrency(Math.abs(draft.result))}
          </p>
          {/* Si el patrimonio no se movió, la línea no dice nada: mejor callarla
              que escribir «0 €» y dar a entender que se ha medido algo. */}
          {draft.netWorthDelta !== 0 ? (
            <p className={`mt-2 text-[13px] tnum ${positive ? 'text-seed-800' : 'text-muted'}`}>
              Patrimonio: {formatCurrency(draft.netWorthDelta, { signed: true })} este mes.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Figure label="Entró" value={draft.income} />
          <Figure label="Salió" value={draft.expenses} />
          <Figure label="Ahorrado" value={draft.saved} />
          <Figure label="Amortizado de más" value={draft.extraDebtPaid} />
        </div>

        {/* El relato. Una frase por línea, para que se lea despacio. */}
        <div className="space-y-2.5">
          {draft.narrative.map((line, index) => (
            <motion.p
              key={line}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.06, 0.4) }}
              className="text-[15px] leading-relaxed text-ink"
            >
              {line}
            </motion.p>
          ))}
        </div>

        <p className="text-[12px] leading-relaxed text-muted">
          {capitalize(monthLabel(draft.month, { capitalize: false }))} queda guardado tal como está ahora. Si
          después aparece algo que faltaba, se puede reabrir desde el histórico.
        </p>
      </div>
    </BottomSheet>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-warm px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-[17px] font-semibold tnum text-ink">{formatCurrency(value)}</p>
    </div>
  );
}
