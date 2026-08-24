'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  ChevronDown,
  Flame,
  MinusCircle,
  PiggyBank,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AmountDisplay, NumericKeypad } from '@/components/ui/amount-input';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Avatar, Button, Chip, Field, Segmented, TextInput } from '@/components/ui/primitives';
import { formatCurrency } from '@/domain/money';
import { addDays, formatDayLong, nowISO } from '@/domain/dates';
import type {
  Cents,
  ID,
  ISODate,
  Transaction,
  TransactionKind,
} from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * Registrar un movimiento en menos de 8 segundos (§2, §106).
 *
 * Importe → categoría → guardar. Todo lo demás vive bajo «Añadir detalles»
 * y nunca bloquea el guardado.
 */

export interface AddSheetPreset {
  kind?: TransactionKind;
  amount?: Cents;
  categoryId?: ID | null;
  subcategoryId?: ID | null;
  merchantId?: ID | null;
  merchantName?: string;
  pocketId?: ID | null;
  debtId?: ID | null;
  paymentType?: 'installment' | 'extra';
  savingDirection?: 'in' | 'out';
  frequency?: 'ordinary' | 'extraordinary';
  plannedId?: ID | null;
  description?: string;
}

const KIND_OPTIONS: {
  kind: TransactionKind;
  label: string;
  hint: string;
  icon: typeof PlusCircle;
  className: string;
}[] = [
  {
    kind: 'expense',
    label: 'Gasto',
    hint: 'Lo que sale',
    icon: MinusCircle,
    className: 'bg-warm text-ink',
  },
  {
    kind: 'income',
    label: 'Ingreso',
    hint: 'Lo que entra',
    icon: PlusCircle,
    className: 'bg-sage text-seed-900',
  },
  {
    kind: 'saving',
    label: 'Ahorro',
    hint: 'A una hucha',
    icon: PiggyBank,
    className: 'bg-sage text-seed-900',
  },
  {
    kind: 'debtPayment',
    label: 'Amortización',
    hint: 'Menos deuda',
    icon: Flame,
    className: 'bg-warm text-ink',
  },
  {
    kind: 'transfer',
    label: 'Transferencia',
    hint: 'Entre cuentas',
    icon: ArrowLeftRight,
    className: 'bg-stone-100 text-ink',
  },
];

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function AddTransactionSheet({
  open,
  onClose,
  editing = null,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  preset?: AddSheetPreset;
}) {
  const { data, today, actions, currentUserId } = useSemilla();

  const [kind, setKind] = useState<TransactionKind | null>(null);
  const [amount, setAmount] = useState<Cents>(0);
  const [date, setDate] = useState<ISODate>(today);
  const [ownerUserId, setOwnerUserId] = useState<ID | null>(currentUserId);
  const [categoryId, setCategoryId] = useState<ID | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<ID | null>(null);
  const [merchantName, setMerchantName] = useState('');
  const [sourceId, setSourceId] = useState<ID | null>(null);
  const [pocketId, setPocketId] = useState<ID | null>(null);
  const [debtId, setDebtId] = useState<ID | null>(null);
  const [paymentType, setPaymentType] = useState<'installment' | 'extra'>('extra');
  const [savingDirection, setSavingDirection] = useState<'in' | 'out'>('in');
  const [fromAccountId, setFromAccountId] = useState<ID | null>(null);
  const [toAccountId, setToAccountId] = useState<ID | null>(null);
  const [necessity, setNecessity] = useState<'necessary' | 'discretionary'>('necessary');
  const [frequency, setFrequency] = useState<'ordinary' | 'extraordinary'>('ordinary');
  const [incomeRecurrence, setIncomeRecurrence] = useState<'recurring' | 'extraordinary'>('recurring');
  const [paymentMethodId, setPaymentMethodId] = useState<ID | null>(null);
  const [accountId, setAccountId] = useState<ID | null>(null);
  const [tagIds, setTagIds] = useState<ID[]>([]);
  const [note, setNote] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [details, setDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  const quickCategories = useMemo(() => data.categories.filter((c) => c.quick), [data.categories]);
  const activeCategory = useMemo(
    () => data.categories.find((c) => c.id === categoryId) ?? null,
    [data.categories, categoryId],
  );
  const defaultAccount = useMemo(
    () => data.accounts.find((a) => a.type === 'main') ?? data.accounts[0] ?? null,
    [data.accounts],
  );

  /* Rellena el formulario al abrir. */
  useEffect(() => {
    if (!open) return;
    const source = editing;
    if (source) {
      setKind(source.kind);
      setAmount(source.amount);
      setDate(source.date);
      setOwnerUserId(source.ownerUserId);
      setNote(source.note);
      setTagIds(source.tagIds);
      setAccountId(source.accountId);
      setPaymentMethodId(source.paymentMethodId);
      if (source.kind === 'expense') {
        setCategoryId(source.categoryId);
        setSubcategoryId(source.subcategoryId);
        setNecessity(source.necessity);
        setFrequency(source.frequency);
        setMerchantName(data.merchants.find((m) => m.id === source.merchantId)?.name ?? source.description);
      }
      if (source.kind === 'income') {
        setSourceId(source.sourceId);
        setIncomeRecurrence(source.recurrence);
      }
      if (source.kind === 'saving') {
        setPocketId(source.pocketId);
        setSavingDirection(source.direction);
      }
      if (source.kind === 'debtPayment') {
        setDebtId(source.debtId);
        setPaymentType(source.paymentType);
      }
      if (source.kind === 'transfer') {
        setFromAccountId(source.fromAccountId);
        setToAccountId(source.toAccountId);
      }
      setDetails(true);
      return;
    }

    setKind(preset?.kind ?? null);
    setAmount(preset?.amount ?? 0);
    setDate(today);
    setOwnerUserId(currentUserId);
    setCategoryId(preset?.categoryId ?? null);
    setSubcategoryId(preset?.subcategoryId ?? null);
    setMerchantName(preset?.merchantName ?? '');
    setSourceId(null);
    setPocketId(preset?.pocketId ?? null);
    setDebtId(preset?.debtId ?? null);
    setPaymentType(preset?.paymentType ?? 'extra');
    setSavingDirection(preset?.savingDirection ?? 'in');
    setFromAccountId(defaultAccount?.id ?? null);
    setToAccountId(null);
    setNecessity('necessary');
    setFrequency(preset?.frequency ?? 'ordinary');
    setIncomeRecurrence('recurring');
    setPaymentMethodId(null);
    setAccountId(defaultAccount?.id ?? null);
    setTagIds([]);
    setNote('');
    setShowAll(false);
    setDetails(false);
  }, [open, editing, preset, today, currentUserId, defaultAccount, data.merchants]);

  /* §44 — aprende comercios: al escribir uno conocido, sugiere su categoría. */
  useEffect(() => {
    if (editing || !merchantName.trim() || categoryId) return;
    const match = data.merchants.find((m) => m.normalized === normalize(merchantName));
    if (match?.defaultCategoryId) {
      setCategoryId(match.defaultCategoryId);
      setSubcategoryId(match.defaultSubcategoryId);
    }
  }, [merchantName, data.merchants, categoryId, editing]);

  const canSave = (() => {
    if (!kind || amount <= 0) return false;
    if (kind === 'expense') return Boolean(categoryId);
    if (kind === 'income') return Boolean(sourceId);
    if (kind === 'saving') return Boolean(pocketId);
    if (kind === 'debtPayment') return Boolean(debtId);
    if (kind === 'transfer') return Boolean(fromAccountId && toAccountId && fromAccountId !== toAccountId);
    return false;
  })();

  async function save() {
    if (!kind || !canSave) return;
    setSaving(true);

    let merchantId: ID | null = null;
    if (kind === 'expense' && merchantName.trim()) {
      const existing = data.merchants.find((m) => m.normalized === normalize(merchantName));
      const merchant = await actions.rememberMerchant({
        id: existing?.id ?? crypto.randomUUID(),
        householdId: data.household.id,
        name: merchantName.trim(),
        normalized: normalize(merchantName),
        defaultCategoryId: categoryId,
        defaultSubcategoryId: subcategoryId,
        uses: (existing?.uses ?? 0) + 1,
        lastUsedAt: nowISO(),
        createdAt: existing?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      });
      merchantId = merchant?.id ?? null;
    }

    const base = {
      id: editing?.id ?? crypto.randomUUID(),
      householdId: data.household.id,
      amount,
      date,
      description:
        kind === 'expense'
          ? merchantName.trim() || activeCategory?.name || ''
          : preset?.description ?? editing?.description ?? '',
      note,
      accountId: kind === 'transfer' ? null : accountId,
      paymentMethodId,
      ownerUserId,
      createdByUserId: editing?.createdByUserId ?? currentUserId,
      updatedByUserId: null,
      plannedId: preset?.plannedId ?? editing?.plannedId ?? null,
      tagIds,
      createdAt: editing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
    };

    let transaction: Transaction;
    switch (kind) {
      case 'expense':
        transaction = {
          ...base,
          kind: 'expense',
          categoryId: categoryId ?? '',
          subcategoryId,
          merchantId,
          necessity,
          frequency,
          expectedAmount: editing?.kind === 'expense' ? editing.expectedAmount : null,
        };
        break;
      case 'income':
        transaction = {
          ...base,
          kind: 'income',
          sourceId: sourceId ?? '',
          recurrence: incomeRecurrence,
          expectedAmount:
            editing?.kind === 'income'
              ? editing.expectedAmount
              : (data.incomeSources.find((s) => s.id === sourceId)?.expectedAmount ?? null),
        };
        break;
      case 'saving':
        transaction = { ...base, kind: 'saving', pocketId: pocketId ?? '', direction: savingDirection };
        break;
      case 'debtPayment':
        transaction = { ...base, kind: 'debtPayment', debtId: debtId ?? '', paymentType };
        break;
      default:
        transaction = {
          ...base,
          kind: 'transfer',
          fromAccountId: fromAccountId ?? '',
          toAccountId: toAccountId ?? '',
        };
    }

    try {
      if (editing) {
        await actions.updateTransaction(transaction);
      } else {
        await actions.addTransaction(transaction, feedbackFor(transaction, data));
      }
      onClose();
    } catch {
      // el provider ya avisa
    } finally {
      setSaving(false);
    }
  }

  const title = editing ? 'Editar movimiento' : kind ? KIND_OPTIONS.find((o) => o.kind === kind)?.label : 'Añadir';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={kind ? formatDayLong(date) : 'Elige qué quieres registrar'}
      footer={
        kind ? (
          <div className="space-y-2">
            <Button full onClick={save} disabled={!canSave || saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            {!editing ? (
              <button
                type="button"
                onClick={() => setDetails((value) => !value)}
                className="flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-muted"
              >
                {details ? 'Ocultar detalles' : '+ Añadir detalles'}
                <ChevronDown
                  size={15}
                  className={`transition ${details ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
            ) : null}
          </div>
        ) : null
      }
    >
      <AnimatePresence mode="wait">
        {!kind ? (
          <motion.div
            key="kinds"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-2 pb-4 pt-1"
          >
            {KIND_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => setKind(option.kind)}
                  className={`flex items-center gap-4 rounded-2xl px-4 py-4 text-left transition active:scale-[0.99] ${option.className}`}
                >
                  <Icon size={24} aria-hidden />
                  <span className="flex-1">
                    <span className="block text-[16px] font-semibold">{option.label}</span>
                    <span className="block text-[13px] opacity-70">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pb-2"
          >
            <AmountDisplay cents={amount} tone={kind === 'expense' ? 'ink' : 'leaf'} />

            {/* Selector principal según el tipo */}
            {kind === 'expense' ? (
              <div className="mb-4 grid grid-cols-4 gap-2">
                {(showAll ? data.categories : quickCategories).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(category.id);
                      setSubcategoryId(null);
                    }}
                    className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-3 transition ${
                      categoryId === category.id ? 'bg-forest text-white' : 'bg-stone-100 text-ink'
                    }`}
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {category.emoji}
                    </span>
                    <span className="line-clamp-2 w-full px-0.5 text-center text-[10.5px] font-semibold leading-tight">
                      {category.name}
                    </span>
                  </button>
                ))}
                {!showAll ? (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-stone-100 px-1 py-3 text-ink"
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      •••
                    </span>
                    <span className="text-[10.5px] font-semibold">Más</span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {kind === 'income' ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {data.incomeSources.map((source) => (
                  <Chip
                    key={source.id}
                    active={sourceId === source.id}
                    onClick={() => {
                      setSourceId(source.id);
                      setIncomeRecurrence(source.recurring ? 'recurring' : 'extraordinary');
                      if (source.expectedAmount && amount === 0) setAmount(source.expectedAmount);
                    }}
                  >
                    {source.name}
                  </Chip>
                ))}
                {data.incomeSources.length === 0 ? (
                  <p className="text-[13px] text-muted">
                    Crea una fuente de ingreso en Más → Ajustes para empezar.
                  </p>
                ) : null}
              </div>
            ) : null}

            {kind === 'saving' ? (
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {data.pockets.map((pocket) => (
                    <Chip key={pocket.id} active={pocketId === pocket.id} onClick={() => setPocketId(pocket.id)}>
                      <span aria-hidden>{pocket.emoji}</span>
                      {pocket.name}
                    </Chip>
                  ))}
                </div>
                <Segmented
                  value={savingDirection}
                  onChange={setSavingDirection}
                  options={[
                    { value: 'in', label: 'Guardar' },
                    { value: 'out', label: 'Sacar' },
                  ]}
                />
              </div>
            ) : null}

            {kind === 'debtPayment' ? (
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {data.debts.map((debt) => (
                    <Chip key={debt.id} active={debtId === debt.id} onClick={() => setDebtId(debt.id)}>
                      {debt.name}
                    </Chip>
                  ))}
                </div>
                {/* §32 — cuota ordinaria vs amortización extraordinaria */}
                <Segmented
                  value={paymentType}
                  onChange={setPaymentType}
                  options={[
                    { value: 'extra', label: 'Amortización extra' },
                    { value: 'installment', label: 'Cuota normal' },
                  ]}
                />
              </div>
            ) : null}

            {kind === 'transfer' ? (
              <div className="mb-4 grid gap-3">
                <Field label="Desde">
                  <div className="flex flex-wrap gap-2">
                    {data.accounts.map((account) => (
                      <Chip
                        key={account.id}
                        active={fromAccountId === account.id}
                        onClick={() => setFromAccountId(account.id)}
                      >
                        {account.name}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Hasta">
                  <div className="flex flex-wrap gap-2">
                    {data.accounts.map((account) => (
                      <Chip
                        key={account.id}
                        active={toAccountId === account.id}
                        onClick={() => setToAccountId(account.id)}
                      >
                        {account.name}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <p className="text-[12px] leading-relaxed text-muted">
                  Mover dinero entre cuentas no cuenta como ingreso ni como gasto.
                </p>
              </div>
            ) : null}

            {/* Persona y fecha, siempre visibles: dos toques como mucho */}
            <div className="mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {data.members.map((member) => (
                <Chip
                  key={member.userId}
                  active={ownerUserId === member.userId}
                  onClick={() => setOwnerUserId(member.userId)}
                >
                  <Avatar initials={member.initials} accent={member.accent} size={20} />
                  {member.name}
                </Chip>
              ))}
              <span className="mx-1 h-5 w-px bg-stone-200" aria-hidden />
              <Chip active={date === today} onClick={() => setDate(today)}>
                Hoy
              </Chip>
              <Chip active={date === addDays(today, -1)} onClick={() => setDate(addDays(today, -1))}>
                Ayer
              </Chip>
            </div>

            {!details ? <NumericKeypad value={amount} onChange={setAmount} /> : null}

            <AnimatePresence>
              {details ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden pt-1"
                >
                  <Field label="Importe">
                    <TextInput
                      inputMode="decimal"
                      value={(amount / 100).toFixed(2).replace('.', ',')}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/[^\d]/g, '');
                        setAmount(Number(digits || 0));
                      }}
                    />
                  </Field>

                  <Field label="Fecha">
                    <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                  </Field>

                  {kind === 'expense' ? (
                    <>
                      <Field label="Comercio">
                        <TextInput
                          value={merchantName}
                          onChange={(event) => setMerchantName(event.target.value)}
                          placeholder="Mercadona"
                          list="semilla-merchants"
                        />
                        <datalist id="semilla-merchants">
                          {data.merchants.map((merchant) => (
                            <option key={merchant.id} value={merchant.name} />
                          ))}
                        </datalist>
                      </Field>

                      {activeCategory && activeCategory.subcategories.length > 0 ? (
                        <Field label="Subcategoría">
                          <div className="flex flex-wrap gap-2">
                            {activeCategory.subcategories.map((sub) => (
                              <Chip
                                key={sub.id}
                                active={subcategoryId === sub.id}
                                onClick={() => setSubcategoryId(subcategoryId === sub.id ? null : sub.id)}
                              >
                                {sub.name}
                              </Chip>
                            ))}
                          </div>
                        </Field>
                      ) : null}

                      <Field label="Tipo de gasto" hint="Los extraordinarios no son un fracaso: son contexto.">
                        <Segmented
                          value={frequency}
                          onChange={setFrequency}
                          options={[
                            { value: 'ordinary', label: 'Ordinario' },
                            { value: 'extraordinary', label: 'Extraordinario' },
                          ]}
                        />
                      </Field>

                      <Field label="¿Era necesario?" hint="No es para culpar. Es para aprender.">
                        <Segmented
                          value={necessity}
                          onChange={setNecessity}
                          options={[
                            { value: 'necessary', label: 'Necesario' },
                            { value: 'discretionary', label: 'Discrecional' },
                          ]}
                        />
                      </Field>
                    </>
                  ) : null}

                  {kind === 'income' ? (
                    <Field label="Tipo de ingreso">
                      <Segmented
                        value={incomeRecurrence}
                        onChange={setIncomeRecurrence}
                        options={[
                          { value: 'recurring', label: 'Recurrente' },
                          { value: 'extraordinary', label: 'Puntual' },
                        ]}
                      />
                    </Field>
                  ) : null}

                  {kind !== 'transfer' ? (
                    <Field label="Cuenta / medio de pago">
                      <div className="flex flex-wrap gap-2">
                        {data.paymentMethods.map((method) => (
                          <Chip
                            key={method.id}
                            active={paymentMethodId === method.id}
                            onClick={() => {
                              setPaymentMethodId(paymentMethodId === method.id ? null : method.id);
                              if (method.accountId) setAccountId(method.accountId);
                            }}
                          >
                            {method.name}
                          </Chip>
                        ))}
                      </div>
                    </Field>
                  ) : null}

                  {data.tags.length > 0 ? (
                    <Field label="Etiquetas">
                      <div className="flex flex-wrap gap-2">
                        {data.tags.map((tag) => (
                          <Chip
                            key={tag.id}
                            active={tagIds.includes(tag.id)}
                            onClick={() =>
                              setTagIds((current) =>
                                current.includes(tag.id)
                                  ? current.filter((id) => id !== tag.id)
                                  : [...current, tag.id],
                              )
                            }
                          >
                            #{tag.name}
                          </Chip>
                        ))}
                      </div>
                    </Field>
                  ) : null}

                  <Field label="Comentario">
                    <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional" />
                  </Field>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!editing ? (
              <button
                type="button"
                onClick={() => setKind(null)}
                className="mt-4 flex w-full items-center justify-center gap-1.5 py-1 text-[13px] text-muted"
              >
                <Sparkles size={14} aria-hidden />
                Cambiar tipo de movimiento
              </button>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </BottomSheet>
  );
}

function feedbackFor(
  transaction: Transaction,
  data: { pockets: { id: string; name: string; emoji: string }[]; debts: { id: string; name: string }[] },
): { title: string; detail?: string; emoji?: string } {
  switch (transaction.kind) {
    case 'income':
      return {
        title: `${formatCurrency(transaction.amount, { signed: true })}`,
        detail: 'Ingreso registrado',
        emoji: '🌱',
      };
    case 'saving': {
      const pocket = data.pockets.find((p) => p.id === transaction.pocketId);
      return transaction.direction === 'in'
        ? {
            title: `${formatCurrency(transaction.amount, { signed: true })} a ${pocket?.name ?? 'la hucha'}`,
            detail: 'Acaba de crecer.',
            emoji: pocket?.emoji ?? '🫙',
          }
        : { title: `Retirada de ${pocket?.name ?? 'la hucha'}`, detail: formatCurrency(transaction.amount) };
    }
    case 'debtPayment': {
      const debt = data.debts.find((d) => d.id === transaction.debtId);
      return transaction.paymentType === 'extra'
        ? {
            title: `${formatCurrency(transaction.amount)} menos de deuda`,
            detail: debt ? `${debt.name} baja` : undefined,
            emoji: '🔥',
          }
        : { title: 'Cuota registrada', detail: debt?.name };
    }
    case 'transfer':
      return { title: 'Transferencia registrada', detail: 'No cuenta como gasto' };
    default:
      return { title: 'Gasto registrado', detail: formatCurrency(transaction.amount) };
  }
}
