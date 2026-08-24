'use client';

import { Check, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, Field, Segmented, TextInput } from '@/components/ui/primitives';
import { MONTH_NAMES, nowISO } from '@/domain/dates';
import { annualCost, frequencyLabel } from '@/domain/planned';
import { formatAmount, formatCurrency, parseCurrency } from '@/domain/money';
import type { ID, PlannedItem, PlannedKind, RecurrenceFrequency } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * Alta y edición de un COMPROMISO (§62).
 *
 * Un previsto no es un movimiento: es una expectativa. Por eso aquí no se
 * registra nada en las cuentas — sólo se dice qué va a caer, cuánto y cuándo.
 * El movimiento real se crea el día que se paga, y entonces se enlaza con éste.
 */
export function PlannedSheet({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: PlannedItem | null;
}) {
  const { data, actions } = useSemilla();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlannedKind>('expense');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [months, setMonths] = useState<number[]>([]);
  const [day, setDay] = useState('1');
  const [categoryId, setCategoryId] = useState<ID | null>(null);
  const [debtId, setDebtId] = useState<ID | null>(null);
  const [extraordinary, setExtraordinary] = useState(false);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = data.categories.filter((category) => !category.archived);
  const debts = data.debts.filter((debt) => !debt.archived);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setKind(item?.kind ?? 'expense');
    setAmount(item ? formatAmount(item.expectedAmount, 'never') : '');
    setFrequency(item?.frequency ?? 'monthly');
    setMonths(item?.months ?? []);
    setDay(String(item?.dayOfMonth ?? 1));
    setCategoryId(item?.categoryId ?? categories[0]?.id ?? null);
    setDebtId(item?.debtId ?? debts[0]?.id ?? null);
    setExtraordinary(item?.extraordinary ?? false);
    setActive(item?.active ?? true);
    setNotes(item?.notes ?? '');
    setConfirmDelete(false);
    setBusy(false);
    // Las listas cambian de identidad en cada render; sólo interesa el momento de abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const expected = parseCurrency(amount);
  const draft: PlannedItem | null = name.trim()
    ? {
        id: item?.id ?? 'preview',
        householdId: data.household.id,
        name: name.trim(),
        kind,
        expectedAmount: expected,
        frequency,
        dayOfMonth: clampDay(day),
        months: frequency === 'custom' && months.length > 0 ? [...months].sort((a, b) => a - b) : null,
        categoryId: kind === 'expense' ? categoryId : null,
        subcategoryId: null,
        sourceId: null,
        debtId: kind === 'debtPayment' ? debtId : null,
        accountId: item?.accountId ?? null,
        ownerUserId: item?.ownerUserId ?? null,
        extraordinary,
        installments: item?.installments ?? null,
        active,
        notes: notes.trim(),
        createdAt: item?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      }
    : null;

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await actions.savePlannedItem({ ...draft, id: item?.id ?? crypto.randomUUID() });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item) return;
    setBusy(true);
    try {
      await actions.deletePlannedItem(item.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={item ? 'Editar compromiso' : 'Nuevo compromiso'}
      subtitle="Lo que ya está decidido antes de empezar el mes."
      footer={
        <div className="space-y-2">
          <Button full onClick={save} disabled={busy || !draft || expected <= 0}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
          {item ? (
            confirmDelete ? (
              <Button variant="danger" full onClick={remove} disabled={busy}>
                <Trash2 size={16} /> Confirmar borrado
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 text-[13px] font-medium text-muted"
              >
                Eliminar
              </button>
            )
          ) : null}
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        <Field label="Qué es">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Internet, seguro del coche, colegio…"
            autoFocus={!item}
          />
        </Field>

        <Field label="Tipo">
          <Segmented
            options={[
              { value: 'expense' as const, label: 'Gasto' },
              { value: 'income' as const, label: 'Ingreso' },
              { value: 'debtPayment' as const, label: 'Cuota' },
            ]}
            value={kind}
            onChange={setKind}
          />
        </Field>

        <Field label="Cuánto suele ser" hint="Si varía, pon lo que sueles pagar. Es una previsión.">
          <TextInput
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="140"
          />
        </Field>

        <Field label="Cada cuánto">
          <Segmented
            options={[
              { value: 'monthly' as const, label: 'Mensual' },
              { value: 'quarterly' as const, label: 'Trimestral' },
              { value: 'yearly' as const, label: 'Anual' },
              { value: 'custom' as const, label: 'Meses' },
            ]}
            value={frequency}
            onChange={setFrequency}
          />
        </Field>

        {frequency === 'custom' ? (
          <Field label="En qué meses">
            <div className="grid grid-cols-4 gap-2">
              {MONTH_NAMES.map((label, index) => {
                const number = index + 1;
                const on = months.includes(number);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setMonths((current) =>
                        current.includes(number)
                          ? current.filter((m) => m !== number)
                          : [...current, number],
                      )
                    }
                    className={`touch rounded-xl px-1 py-2 text-[12px] font-semibold capitalize ${
                      on ? 'bg-forest text-white' : 'bg-stone-100 text-ink'
                    }`}
                  >
                    {label.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </Field>
        ) : null}

        <Field label="Qué día del mes" hint="Si cae en 31 y el mes es más corto, se ajusta solo.">
          <TextInput
            inputMode="numeric"
            value={day}
            onChange={(event) => setDay(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="5"
          />
        </Field>

        {kind === 'expense' && categories.length > 0 ? (
          <Field label="Categoría">
            <select
              value={categoryId ?? ''}
              onChange={(event) => setCategoryId(event.target.value || null)}
              className="w-full rounded-2xl border border-stone-200 bg-surface px-4 py-3 text-[16px] text-ink"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji} {category.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {kind === 'debtPayment' && debts.length > 0 ? (
          <Field label="De qué deuda">
            <select
              value={debtId ?? ''}
              onChange={(event) => setDebtId(event.target.value || null)}
              className="w-full rounded-2xl border border-stone-200 bg-surface px-4 py-3 text-[16px] text-ink"
            >
              {debts.map((debt) => (
                <option key={debt.id} value={debt.id}>
                  {debt.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Toggle
          on={extraordinary}
          onChange={setExtraordinary}
          label="Es extraordinario"
          hint="No es el mes normal: cuenta aparte al leer cómo ha ido."
        />

        <Toggle
          on={active}
          onChange={setActive}
          label="Sigue activo"
          hint="Apágalo si lo habéis dado de baja. No borra el histórico."
        />

        <Field label="Notas">
          <TextInput
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Opcional"
          />
        </Field>

        {/* La cifra que cambia la conversación: lo que cuesta al año. */}
        {draft && expected > 0 ? (
          <p className="rounded-2xl bg-sage px-4 py-3 text-[13px] leading-relaxed text-seed-800 tnum">
            {frequencyLabel(draft)} · {formatCurrency(expected)} cada vez.
            {kind === 'income' ? '' : ` Son ${formatCurrency(annualCost(draft))} al año.`}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-start gap-3 text-left"
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
          on ? 'border-forest bg-forest text-white' : 'border-stone-300 bg-surface'
        }`}
      >
        {on ? <Check size={15} strokeWidth={3} aria-hidden /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        <span className="block text-[12px] leading-snug text-muted">{hint}</span>
      </span>
    </button>
  );
}

/** El día 0 no existe y el 45 tampoco: se guarda entre 1 y 31. */
function clampDay(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(31, Math.max(1, Math.round(parsed)));
}
