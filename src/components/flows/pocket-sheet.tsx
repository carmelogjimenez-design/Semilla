'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, Chip, Field, Segmented, TextInput } from '@/components/ui/primitives';
import { nowISO } from '@/domain/dates';
import { formatAmount, parseCurrency } from '@/domain/money';
import type { PocketType, SavingsPocket } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * Crear o editar una hucha (§27).
 *
 * La distinción entre ahorro real y dinero reservado es el corazón de esta
 * pantalla: los dos suman, pero no significan lo mismo.
 */

const EMOJIS = ['🛡️', '🚗', '🎄', '🏖️', '🏠', '🎓', '💍', '🩺', '🐾', '🎁', '✈️', '🔧', '🌱', '🫙'];

export function PocketSheet({
  open,
  onClose,
  pocket,
}: {
  open: boolean;
  onClose: () => void;
  pocket: SavingsPocket | null;
}) {
  const { data, actions } = useSemilla();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🫙');
  const [type, setType] = useState<PocketType>('savings');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [opening, setOpening] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(pocket?.name ?? '');
    setEmoji(pocket?.emoji ?? '🫙');
    setType(pocket?.type ?? 'savings');
    setTarget(pocket?.targetAmount ? formatAmount(pocket.targetAmount, 'never') : '');
    setTargetDate(pocket?.targetDate ?? '');
    setOpening(pocket?.openingBalance ? formatAmount(pocket.openingBalance, 'never') : '');
    setConfirmDelete(false);
  }, [open, pocket]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const targetAmount = parseCurrency(target);
    try {
      await actions.savePocket({
        id: pocket?.id ?? crypto.randomUUID(),
        householdId: data.household.id,
        name: name.trim(),
        emoji,
        type,
        targetAmount: targetAmount > 0 ? targetAmount : null,
        targetDate: targetDate || null,
        openingBalance: parseCurrency(opening),
        accountId: pocket?.accountId ?? data.accounts.find((a) => a.type === 'savings')?.id ?? null,
        position: pocket?.position ?? data.pockets.length,
        archived: false,
        createdAt: pocket?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!pocket) return;
    setSaving(true);
    try {
      await actions.deletePocket(pocket.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={pocket ? 'Editar hucha' : 'Nueva hucha'}
      subtitle={pocket ? pocket.name : 'Algo concreto que queráis ver crecer'}
      footer={
        <div className="space-y-2">
          <Button full onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          {pocket ? (
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
                Eliminar hucha
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
            placeholder="Fondo de emergencia"
            autoFocus={!pocket}
          />
        </Field>

        <Field label="Icono">
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEmoji(option)}
                aria-label={`Icono ${option}`}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl transition ${
                  emoji === option ? 'bg-forest' : 'bg-stone-100'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Tipo"
          hint={
            type === 'savings'
              ? 'Ahorro de verdad: dinero que se queda y crece.'
              : 'Dinero reservado: ya tiene destino, es un gasto futuro apartado.'
          }
        >
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: 'savings', label: 'Ahorro' },
              { value: 'reserved', label: 'Reservado' },
            ]}
          />
        </Field>

        <Field label="Objetivo" hint="Opcional. Sirve para ver el progreso.">
          <TextInput
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="15.000"
          />
        </Field>

        <Field label="Fecha objetivo" hint="Opcional.">
          <TextInput
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </Field>

        <Field
          label="Saldo de partida"
          hint="Lo que ya teníais guardado antes de empezar con Semilla."
        >
          <TextInput
            inputMode="decimal"
            value={opening}
            onChange={(event) => setOpening(event.target.value)}
            placeholder="0"
          />
        </Field>

        {!pocket ? (
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'Fondo de emergencia', emoji: '🛡️', type: 'savings' as const },
              { name: 'Coche', emoji: '🚗', type: 'reserved' as const },
              { name: 'Navidad', emoji: '🎄', type: 'reserved' as const },
              { name: 'Vacaciones', emoji: '🏖️', type: 'reserved' as const },
            ].map((preset) => (
              <Chip
                key={preset.name}
                onClick={() => {
                  setName(preset.name);
                  setEmoji(preset.emoji);
                  setType(preset.type);
                }}
              >
                {preset.emoji} {preset.name}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
