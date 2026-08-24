'use client';

import { ArrowLeftRight, Flame, PiggyBank } from 'lucide-react';

import { Avatar } from '@/components/ui/primitives';
import { formatCurrency } from '@/domain/money';
import type { HouseholdData, Member, Transaction } from '@/domain/types';

/**
 * Una fila de la línea de tiempo (§42).
 * El signo lo da el tipo de movimiento, nunca un importe negativo guardado.
 */

export interface TransactionPresentation {
  title: string;
  subtitle: string;
  amountLabel: string;
  amountClass: string;
  icon: React.ReactNode;
}

export function presentTransaction(
  transaction: Transaction,
  data: Pick<HouseholdData, 'categories' | 'pockets' | 'debts' | 'incomeSources' | 'accounts' | 'members'>,
): TransactionPresentation {
  switch (transaction.kind) {
    case 'expense': {
      const category = data.categories.find((c) => c.id === transaction.categoryId);
      const sub = category?.subcategories.find((s) => s.id === transaction.subcategoryId);
      return {
        title: transaction.description || category?.name || 'Gasto',
        subtitle: [category?.name, sub?.name].filter(Boolean).join(' · ') || 'Gasto',
        amountLabel: `−${formatCurrency(transaction.amount)}`,
        amountClass: 'text-ink',
        icon: <span className="text-xl">{category?.emoji ?? '•'}</span>,
      };
    }
    case 'income': {
      const source = data.incomeSources.find((s) => s.id === transaction.sourceId);
      return {
        title: source?.name ?? 'Ingreso',
        subtitle: transaction.recurrence === 'recurring' ? 'Ingreso recurrente' : 'Ingreso puntual',
        amountLabel: `+${formatCurrency(transaction.amount)}`,
        amountClass: 'text-seed-700',
        icon: <span className="text-xl">💶</span>,
      };
    }
    case 'saving': {
      const pocket = data.pockets.find((p) => p.id === transaction.pocketId);
      const inbound = transaction.direction === 'in';
      return {
        title: inbound ? 'Ahorro' : 'Retirada',
        subtitle: pocket?.name ?? 'Hucha',
        amountLabel: `${inbound ? '+' : '−'}${formatCurrency(transaction.amount)}`,
        amountClass: inbound ? 'text-seed-700' : 'text-ink',
        icon: pocket?.emoji ? (
          <span className="text-xl">{pocket.emoji}</span>
        ) : (
          <PiggyBank size={20} className="text-seed-700" />
        ),
      };
    }
    case 'debtPayment': {
      const debt = data.debts.find((d) => d.id === transaction.debtId);
      return {
        title: transaction.paymentType === 'extra' ? 'Amortización' : 'Cuota',
        subtitle: debt?.name ?? 'Deuda',
        amountLabel: `−${formatCurrency(transaction.amount)}`,
        amountClass: 'text-ink',
        icon: <Flame size={20} className="text-seed-700" />,
      };
    }
    default: {
      const from = data.accounts.find((a) => a.id === transaction.fromAccountId);
      const to = data.accounts.find((a) => a.id === transaction.toAccountId);
      return {
        title: 'Transferencia',
        subtitle: `${from?.name ?? '—'} → ${to?.name ?? '—'}`,
        amountLabel: formatCurrency(transaction.amount),
        amountClass: 'text-muted',
        icon: <ArrowLeftRight size={20} className="text-muted" />,
      };
    }
  }
}

export function TransactionRow({
  transaction,
  data,
  member,
  onPress,
}: {
  transaction: Transaction;
  data: Pick<HouseholdData, 'categories' | 'pockets' | 'debts' | 'incomeSources' | 'accounts' | 'members'>;
  member: Member | null;
  onPress?: () => void;
}) {
  const presentation = presentTransaction(transaction, data);

  return (
    <button
      type="button"
      onClick={onPress}
      className="flex w-full touch items-center gap-3 rounded-2xl px-1 py-2.5 text-left transition active:bg-stone-100"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warm">
        {presentation.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{presentation.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-muted">
          {member ? <Avatar initials={member.initials} accent={member.accent} size={16} /> : null}
          <span className="truncate">{presentation.subtitle}</span>
        </span>
      </span>
      <span className={`shrink-0 text-[15px] font-semibold tnum ${presentation.amountClass}`}>
        {presentation.amountLabel}
      </span>
    </button>
  );
}
