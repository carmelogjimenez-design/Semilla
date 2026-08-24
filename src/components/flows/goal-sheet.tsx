'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, Field, TextInput } from '@/components/ui/primitives';
import { addMonths, firstDayOfMonth, monthKeyOf, nowISO, systemToday } from '@/domain/dates';
import { formatAmount, parseCurrency } from '@/domain/money';
import type { FinancialGoal } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * Crear o editar el objetivo activo (§34).
 *
 * No se llama «Plan 12» ni tiene una duración impuesta: cualquier periodo vale.
 * Los tres objetivos son opcionales; con uno solo ya funciona la pantalla.
 */
export function GoalSheet({
  open,
  onClose,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  goal: FinancialGoal | null;
}) {
  const { data, actions } = useSemilla();

  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [savings, setSavings] = useState('');
  const [debt, setDebt] = useState('');
  const [weeks, setWeeks] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const today = systemToday();
    const month = monthKeyOf(today);
    setName(goal?.name ?? 'Nuestro primer año');
    setStart(goal?.startDate ?? firstDayOfMonth(month));
    setEnd(goal?.endDate ?? firstDayOfMonth(addMonths(month, 12)));
    setSavings(goal?.savingsTarget ? formatAmount(goal.savingsTarget, 'never') : '');
    setDebt(goal?.extraDebtTarget ? formatAmount(goal.extraDebtTarget, 'never') : '');
    setWeeks(goal?.greenWeeksTarget ? String(goal.greenWeeksTarget) : '');
    setConfirmDelete(false);
    setError(null);
  }, [open, goal]);

  async function save() {
    if (!name.trim()) return;
    if (end <= start) {
      setError('La fecha de fin tiene que ser posterior a la de inicio.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await actions.saveGoal({
        id: goal?.id ?? crypto.randomUUID(),
        householdId: data.household.id,
        name: name.trim(),
        startDate: start,
        endDate: end,
        savingsTarget: parseCurrency(savings),
        extraDebtTarget: parseCurrency(debt),
        greenWeeksTarget: Math.max(0, Math.round(Number(weeks) || 0)),
        active: true,
        createdAt: goal?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!goal) return;
    setSaving(true);
    try {
      await actions.deleteGoal(goal.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={goal ? 'Editar objetivo' : 'Nuevo objetivo'}
      subtitle="Una dirección con fecha. Los tres objetivos son opcionales."
      footer={
        <div className="space-y-2">
          <Button full onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          {goal ? (
            confirmDelete ? (
              <Button variant="danger" full onClick={remove} disabled={saving}>
                <Trash2 size={16} /> Confirmar borrado
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 text-[13px] font-medium text-muted"
              >
                Eliminar objetivo
              </button>
            )
          ) : null}
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nuestro primer año"
            autoFocus={!goal}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <TextInput type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </Field>
          <Field label="Hasta">
            <TextInput type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </Field>
        </div>

        <Field label="Ahorrar" hint="Cuánto queréis tener guardado al final del periodo.">
          <TextInput
            inputMode="decimal"
            value={savings}
            onChange={(event) => setSavings(event.target.value)}
            placeholder="15.000"
          />
        </Field>

        <Field label="Amortizar de más" hint="Sólo amortizaciones extraordinarias, no las cuotas.">
          <TextInput
            inputMode="decimal"
            value={debt}
            onChange={(event) => setDebt(event.target.value)}
            placeholder="30.000"
          />
        </Field>

        <Field label="Semanas verdes" hint="Semanas cerradas dentro del presupuesto.">
          <TextInput
            inputMode="numeric"
            value={weeks}
            onChange={(event) => setWeeks(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="40"
          />
        </Field>

        {error ? <p className="text-[13px] font-medium text-coral-deep">{error}</p> : null}
      </div>
    </BottomSheet>
  );
}
