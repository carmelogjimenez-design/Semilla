'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, Field, Segmented, TextInput } from '@/components/ui/primitives';
import { nowISO, systemToday } from '@/domain/dates';
import { formatAmount, parseCurrency } from '@/domain/money';
import type { Account, AccountType, PaymentMethod, PaymentMethodType } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * Cuentas y medios de pago (§28).
 *
 * El saldo inicial no es «cuánto tenéis»: es el punto desde el que Semilla
 * empieza a contar. Todo lo anterior a esa fecha no existe para la app, y por eso
 * la fecha importa tanto como el importe.
 */

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'main', label: 'Principal' },
  { value: 'savings', label: 'Ahorro' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'other', label: 'Otra' },
];

export function AccountSheet({
  open,
  onClose,
  account,
}: {
  open: boolean;
  onClose: () => void;
  account: Account | null;
}) {
  const { data, actions } = useSemilla();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('main');
  const [balance, setBalance] = useState('');
  const [balanceDate, setBalanceDate] = useState(systemToday());
  const [counts, setCounts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setType(account?.type ?? 'main');
    setBalance(account ? formatAmount(account.openingBalance, 'never') : '');
    setBalanceDate(account?.balanceDate ?? systemToday());
    setCounts(account?.countsAsAvailable ?? true);
    setConfirmArchive(false);
    setBusy(false);
  }, [open, account]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await actions.saveAccount({
        id: account?.id ?? crypto.randomUUID(),
        householdId: data.household.id,
        name: name.trim(),
        type,
        openingBalance: parseCurrency(balance),
        balanceDate,
        countsAsAvailable: counts,
        position: account?.position ?? data.accounts.length,
        archived: account?.archived ?? false,
        createdAt: account?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!account) return;
    setBusy(true);
    try {
      await actions.saveAccount({ ...account, archived: !account.archived, updatedAt: nowISO() });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
      subtitle="Dónde está el dinero."
      footer={
        <div className="space-y-2">
          <Button full onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
          {account ? (
            confirmArchive ? (
              <Button variant="danger" full onClick={archive} disabled={busy}>
                {account.archived ? 'Recuperar' : 'Confirmar archivado'}
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmArchive(true)}
                className="w-full py-2 text-[13px] font-medium text-muted"
              >
                {account.archived ? 'Recuperar cuenta' : 'Archivar cuenta'}
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
            placeholder="Cuenta del BBVA"
            autoFocus={!account}
          />
        </Field>

        <Field label="Tipo">
          <Segmented options={ACCOUNT_TYPES} value={type} onChange={setType} />
        </Field>

        <Field
          label="Saldo de partida"
          hint="Lo que había el día que empezáis a contar. No hace falta que sea hoy."
        >
          <TextInput
            inputMode="decimal"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            placeholder="0"
          />
        </Field>

        <Field label="A fecha de">
          <TextInput
            type="date"
            value={balanceDate}
            onChange={(event) => setBalanceDate(event.target.value)}
          />
        </Field>

        <button
          type="button"
          onClick={() => setCounts(!counts)}
          className="flex w-full items-start gap-3 text-left"
        >
          <span
            className={`mt-0.5 h-6 w-6 shrink-0 rounded-lg border ${
              counts ? 'border-forest bg-forest' : 'border-stone-300 bg-surface'
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">Cuenta como disponible</span>
            <span className="block text-[12px] leading-snug text-muted">
              Si lo apagáis, su saldo no entra en el dinero libre. Útil para una cuenta que no se toca.
            </span>
          </span>
        </button>
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ *
 * Medios de pago
 * ------------------------------------------------------------------ */

const METHOD_TYPES: { value: PaymentMethodType; label: string }[] = [
  { value: 'card', label: 'Tarjeta' },
  { value: 'account', label: 'Cuenta' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'bizum', label: 'Bizum' },
];

export function PaymentMethodSheet({
  open,
  onClose,
  method,
}: {
  open: boolean;
  onClose: () => void;
  method: PaymentMethod | null;
}) {
  const { data, actions } = useSemilla();

  const [name, setName] = useState('');
  const [type, setType] = useState<PaymentMethodType>('card');
  const [accountId, setAccountId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const accounts = data.accounts.filter((account) => !account.archived);

  useEffect(() => {
    if (!open) return;
    setName(method?.name ?? '');
    setType(method?.type ?? 'card');
    setAccountId(method?.accountId ?? accounts[0]?.id ?? '');
    setConfirmDelete(false);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await actions.savePaymentMethod({
        id: method?.id ?? crypto.randomUUID(),
        householdId: data.household.id,
        name: name.trim(),
        type,
        accountId: accountId || null,
        position: method?.position ?? data.paymentMethods.length,
        archived: method?.archived ?? false,
        createdAt: method?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!method) return;
    setBusy(true);
    try {
      await actions.savePaymentMethod({ ...method, archived: true, updatedAt: nowISO() });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={method ? 'Editar medio de pago' : 'Nuevo medio de pago'}
      subtitle="Con qué se paga. Sirve para saber de qué cuenta sale."
      footer={
        <div className="space-y-2">
          <Button full onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
          {method ? (
            confirmDelete ? (
              <Button variant="danger" full onClick={remove} disabled={busy}>
                <Trash2 size={16} /> Confirmar archivado
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 text-[13px] font-medium text-muted"
              >
                Archivar
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
            placeholder="Tarjeta de Sara"
            autoFocus={!method}
          />
        </Field>

        <Field label="Tipo">
          <Segmented options={METHOD_TYPES} value={type} onChange={setType} />
        </Field>

        {accounts.length > 0 ? (
          <Field label="Sale de" hint="La cuenta a la que se carga.">
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-surface px-4 py-3 text-[16px] text-ink"
            >
              <option value="">Sin cuenta asociada</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
    </BottomSheet>
  );
}
