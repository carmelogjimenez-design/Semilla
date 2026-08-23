'use client';

import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { AddTransactionSheet } from '@/components/flows/add-transaction-sheet';
import { presentTransaction } from '@/components/transaction-row';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Avatar, Button } from '@/components/ui/primitives';
import { formatCurrency } from '@/domain/money';
import { formatWeekday, capitalize, formatDayLong, nowISO } from '@/domain/dates';
import type { ISODate, Transaction } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * Detalle de un movimiento: editar, duplicar y eliminar (§79, §80, §96).
 * Eliminar pide confirmación y deja deshacer desde el aviso.
 */
export function TransactionDetailSheet({
  transaction,
  onClose,
  today,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  currentMemberName?: string;
  today: ISODate;
}) {
  const { data, actions, currentUserId } = useSemilla();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!transaction) return null;

  const presentation = presentTransaction(transaction, data);
  const owner = data.members.find((m) => m.userId === transaction.ownerUserId) ?? null;
  const author = data.members.find((m) => m.userId === transaction.createdByUserId) ?? null;
  const editor = data.members.find((m) => m.userId === transaction.updatedByUserId) ?? null;
  const tags = data.tags.filter((tag) => transaction.tagIds.includes(tag.id));
  const method = data.paymentMethods.find((m) => m.id === transaction.paymentMethodId) ?? null;

  async function duplicate() {
    if (!transaction) return;
    const copy: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
      date: today,
      createdByUserId: currentUserId,
      updatedByUserId: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await actions.addTransaction(copy, { title: 'Gasto repetido', detail: formatCurrency(copy.amount) });
    onClose();
  }

  async function remove() {
    if (!transaction) return;
    await actions.deleteTransaction(transaction.id);
    setConfirming(false);
    onClose();
  }

  return (
    <>
      <BottomSheet
        open={Boolean(transaction) && !editing}
        onClose={onClose}
        title={presentation.title}
        subtitle={capitalize(formatWeekday(transaction.date))}
      >
        <div className="pb-4">
          <p className={`py-4 text-center text-hero tnum ${presentation.amountClass}`}>
            {presentation.amountLabel}
          </p>

          <dl className="space-y-1 rounded-2xl bg-warm p-4 text-[13px]">
            <Row label="Concepto" value={presentation.subtitle} />
            <Row label="Fecha" value={formatDayLong(transaction.date)} />
            {owner ? (
              <Row
                label="Corresponde a"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar initials={owner.initials} accent={owner.accent} size={16} />
                    {owner.name}
                  </span>
                }
              />
            ) : null}
            {method ? <Row label="Medio de pago" value={method.name} /> : null}
            {transaction.kind === 'expense' ? (
              <>
                <Row
                  label="Tipo"
                  value={transaction.frequency === 'extraordinary' ? 'Extraordinario' : 'Ordinario'}
                />
                <Row
                  label="Clasificación"
                  value={transaction.necessity === 'necessary' ? 'Necesario' : 'Discrecional'}
                />
                {transaction.expectedAmount !== null && transaction.expectedAmount !== transaction.amount ? (
                  <Row
                    label="Previsto"
                    value={`${formatCurrency(transaction.expectedAmount)} · ${formatCurrency(
                      transaction.amount - transaction.expectedAmount,
                      { signed: true },
                    )}`}
                  />
                ) : null}
              </>
            ) : null}
            {transaction.kind === 'debtPayment' ? (
              <Row
                label="Tipo de pago"
                value={transaction.paymentType === 'extra' ? 'Amortización extraordinaria' : 'Cuota ordinaria'}
              />
            ) : null}
            {transaction.note ? <Row label="Comentario" value={transaction.note} /> : null}
          </dl>

          {tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag.id} className="rounded-full bg-sage px-2.5 py-1 text-[12px] text-seed-800">
                  #{tag.name}
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-[12px] text-stone-400">
            Registrado por {author?.name ?? 'alguien del hogar'}
            {editor && editor.userId !== author?.userId ? ` · editado por ${editor.name}` : ''}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <ActionButton icon={<Pencil size={18} />} label="Editar" onClick={() => setEditing(true)} />
            <ActionButton icon={<Copy size={18} />} label="Repetir" onClick={duplicate} />
            <ActionButton
              icon={<Trash2 size={18} />}
              label="Eliminar"
              tone="danger"
              onClick={() => setConfirming(true)}
            />
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Eliminar el movimiento?"
        subtitle="Podrás deshacerlo justo después."
        footer={
          <div className="space-y-2">
            <Button variant="danger" full onClick={remove}>
              Eliminar
            </Button>
            <Button variant="ghost" full onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        }
      >
        <p className="pb-2 text-[14px] leading-relaxed text-muted">
          {presentation.title} · {presentation.amountLabel}
        </p>
      </BottomSheet>

      <AddTransactionSheet
        open={editing}
        editing={transaction}
        onClose={() => {
          setEditing(false);
          onClose();
        }}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex touch flex-col items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-semibold transition active:scale-[0.98] ${
        tone === 'danger' ? 'bg-coral-bg text-coral-deep' : 'bg-stone-100 text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
