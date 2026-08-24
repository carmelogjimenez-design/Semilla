'use client';

import { useEffect, useState } from 'react';

import { AmountDisplay, NumericKeypad } from '@/components/ui/amount-input';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/primitives';
import type { Cents } from '@/domain/types';

/**
 * Hoja para fijar un importe: presupuestos, límites, objetivos.
 * Mismo teclado que al registrar un gasto, para que la app se sienta una sola cosa.
 */
export function AmountSheet({
  open,
  onClose,
  onSave,
  title,
  subtitle,
  initial = 0,
  hint,
  allowZero = true,
  saveLabel = 'Guardar',
}: {
  open: boolean;
  onClose: () => void;
  onSave: (amount: Cents) => void | Promise<void>;
  title: string;
  subtitle?: string;
  initial?: Cents;
  hint?: string;
  allowZero?: boolean;
  saveLabel?: string;
}) {
  const [amount, setAmount] = useState<Cents>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setAmount(initial);
  }, [open, initial]);

  async function save() {
    setSaving(true);
    try {
      await onSave(amount);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      {...(subtitle === undefined ? {} : { subtitle })}
      footer={
        <div className="space-y-2">
          <Button full onClick={save} disabled={saving || (!allowZero && amount === 0)}>
            {saving ? 'Guardando…' : saveLabel}
          </Button>
          {allowZero && initial > 0 ? (
            <button
              type="button"
              onClick={() => setAmount(0)}
              className="w-full py-2 text-[13px] font-medium text-muted"
            >
              Quitar el límite
            </button>
          ) : null}
        </div>
      }
    >
      <div className="pb-2">
        <AmountDisplay cents={amount} tone="leaf" />
        {hint ? <p className="mb-4 text-center text-[13px] leading-relaxed text-muted">{hint}</p> : null}
        <NumericKeypad value={amount} onChange={setAmount} />
      </div>
    </BottomSheet>
  );
}
