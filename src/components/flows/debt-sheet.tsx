'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, Field, TextInput } from '@/components/ui/primitives';
import { nowISO, systemToday } from '@/domain/dates';
import { formatAmount, parseCurrency } from '@/domain/money';
import type { Debt, DebtType } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * Crear o editar una deuda (§30).
 *
 * `balanceAtStart` es el saldo el día que empezáis a registrarla en Semilla;
 * `initialBalance` es el importe original del préstamo. Con esos dos números
 * la app puede decir a la vez «cuánto queda» y «cuánto lleváis eliminado».
 */

const TYPES: { value: DebtType; label: string }[] = [
  { value: 'mortgage', label: 'Hipoteca' },
  { value: 'loan', label: 'Préstamo' },
  { value: 'vehicle', label: 'Vehículo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otra' },
];

export function DebtSheet({
  open,
  onClose,
  debt,
}: {
  open: boolean;
  onClose: () => void;
  debt: Debt | null;
}) {
  const { data, actions } = useSemilla();

  const [name, setName] = useState('');
  const [type, setType] = useState<DebtType>('loan');
  const [initial, setInitial] = useState('');
  const [current, setCurrent] = useState('');
  const [installment, setInstallment] = useState('');
  const [interest, setInterest] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(debt?.name ?? '');
    setType(debt?.type ?? 'loan');
    setInitial(debt?.initialBalance ? formatAmount(debt.initialBalance, 'never') : '');
    setCurrent(debt?.balanceAtStart ? formatAmount(debt.balanceAtStart, 'never') : '');
    setInstallment(debt?.installment ? formatAmount(debt.installment, 'never') : '');
    setInterest(debt ? String(debt.interestBps / 100).replace('.', ',') : '');
    setEndDate(debt?.endDate ?? '');
    setNotes(debt?.notes ?? '');
    setConfirmDelete(false);
  }, [open, debt]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const balanceAtStart = parseCurrency(current);
    const initialBalance = parseCurrency(initial) || balanceAtStart;
    const rate = Number(interest.replace(',', '.'));
    try {
      await actions.saveDebt({
        id: debt?.id ?? crypto.randomUUID(),
        householdId: data.household.id,
        name: name.trim(),
        type,
        initialBalance: Math.max(initialBalance, balanceAtStart),
        balanceAtStart,
        trackingStart: debt?.trackingStart ?? systemToday(),
        installment: parseCurrency(installment),
        interestBps: Number.isFinite(rate) ? Math.round(rate * 100) : 0,
        startDate: debt?.startDate ?? null,
        endDate: endDate || null,
        priority: debt?.priority ?? data.debts.length,
        notes: notes.trim(),
        archived: false,
        createdAt: debt?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!debt) return;
    setSaving(true);
    try {
      await actions.deleteDebt(debt.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={debt ? 'Editar deuda' : 'Nueva deuda'}
      subtitle={debt ? debt.name : 'Verla escrita es el primer paso para verla bajar'}
      footer={
        <div className="space-y-2">
          <Button full onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          {debt ? (
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
                Eliminar deuda
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
            placeholder="ING"
            autoFocus={!debt}
          />
        </Field>

        <Field label="Tipo">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition ${
                  type === option.value ? 'bg-forest text-white' : 'bg-stone-100 text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Saldo pendiente hoy" hint="Lo que queda por pagar ahora mismo.">
          <TextInput
            inputMode="decimal"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            placeholder="14.200"
          />
        </Field>

        <Field
          label="Importe original"
          hint="Lo que pedisteis al principio. Sirve para ver cuánto lleváis eliminado. Si no lo sabéis, déjalo vacío."
        >
          <TextInput
            inputMode="decimal"
            value={initial}
            onChange={(event) => setInitial(event.target.value)}
            placeholder="25.000"
          />
        </Field>

        <Field label="Cuota mensual">
          <TextInput
            inputMode="decimal"
            value={installment}
            onChange={(event) => setInstallment(event.target.value)}
            placeholder="475"
          />
        </Field>

        <Field label="Interés (TIN %)" hint="Opcional.">
          <TextInput
            inputMode="decimal"
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            placeholder="6,15"
          />
        </Field>

        <Field label="Vencimiento" hint="Opcional.">
          <TextInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </Field>

        <Field label="Observaciones" hint="Opcional.">
          <TextInput
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Prioridad para amortizar"
          />
        </Field>

        <p className="rounded-2xl bg-warm px-4 py-3 text-[12px] leading-relaxed text-muted">
          Las cuotas y las amortizaciones se registran con el botón <strong>+</strong>. Semilla las
          distingue: la cuota es lo normal, la amortización extraordinaria es la que de verdad acorta el
          préstamo.
        </p>
      </div>
    </BottomSheet>
  );
}
