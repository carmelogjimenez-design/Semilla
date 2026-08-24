'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, Field, Segmented, TextInput } from '@/components/ui/primitives';
import { nowISO } from '@/domain/dates';
import type { Category, CategoryPriority, Subcategory, Tag } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * Categorías y etiquetas (§46, §53).
 *
 * Las categorías vienen puestas al crear el hogar, pero cada casa gasta a su
 * manera. Aquí se cambian sin miedo: nada se borra de verdad mientras tenga
 * movimientos detrás — se archiva, que es distinto.
 */

const EMOJIS = [
  '🛒','⛽','🏠','👶','❤️','🍽️','🛍️','🧺','🛡️','🎓','🐶','✈️','🎁','💊','🚌','📱','💡','🔧','🎬','☕',
];

export function CategorySheet({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category: Category | null;
}) {
  const { data, actions } = useSemilla();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🛒');
  const [priority, setPriority] = useState<CategoryPriority>('flexible');
  const [quick, setQuick] = useState(false);
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [newSub, setNewSub] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setEmoji(category?.emoji ?? '🛒');
    setPriority(category?.priority ?? 'flexible');
    setQuick(category?.quick ?? false);
    setSubs(category?.subcategories.filter((sub) => !sub.archived) ?? []);
    setNewSub('');
    setConfirmArchive(false);
    setBusy(false);
  }, [open, category]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = category?.id ?? crypto.randomUUID();
      await actions.saveCategory({
        id,
        householdId: data.household.id,
        name: name.trim(),
        emoji,
        tone: category?.tone ?? data.categories.length,
        priority,
        quick,
        position: category?.position ?? data.categories.length,
        archived: category?.archived ?? false,
        subcategories: [],
        createdAt: category?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      });

      /* Las subcategorías se guardan una a una: son filas propias, no un campo
         de la categoría. */
      for (const sub of subs) {
        if (sub.name.trim()) await actions.saveSubcategory({ ...sub, categoryId: id });
      }
      const removed = (category?.subcategories ?? []).filter(
        (sub) => !sub.archived && !subs.some((kept) => kept.id === sub.id),
      );
      for (const sub of removed) await actions.deleteSubcategory(sub.id);

      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!category) return;
    setBusy(true);
    try {
      await actions.saveCategory({ ...category, archived: !category.archived, updatedAt: nowISO() });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function addSub() {
    const value = newSub.trim();
    if (!value) return;
    setSubs((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        householdId: data.household.id,
        categoryId: category?.id ?? '',
        name: value,
        position: current.length,
        archived: false,
      },
    ]);
    setNewSub('');
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      subtitle="Cómo se reparte lo que gastáis."
      footer={
        <div className="space-y-2">
          <Button full onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
          {category ? (
            confirmArchive ? (
              <Button variant="danger" full onClick={archive} disabled={busy}>
                {category.archived ? 'Recuperar' : 'Confirmar archivado'}
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmArchive(true)}
                className="w-full py-2 text-[13px] font-medium text-muted"
              >
                {category.archived ? 'Recuperar categoría' : 'Archivar categoría'}
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
            placeholder="Alimentación"
            autoFocus={!category}
          />
        </Field>

        <Field label="Icono">
          <div className="grid grid-cols-10 gap-1.5">
            {EMOJIS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEmoji(option)}
                className={`flex h-9 items-center justify-center rounded-xl text-lg ${
                  emoji === option ? 'bg-forest' : 'bg-stone-100'
                }`}
              >
                <span aria-hidden>{option}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Prioridad"
          hint="Cuando una semana se desvía, lo protegido no se toca y lo flexible es donde hay margen."
        >
          <Segmented
            options={[
              { value: 'protected' as const, label: 'Protegido' },
              { value: 'flexible' as const, label: 'Flexible' },
            ]}
            value={priority}
            onChange={setPriority}
          />
        </Field>

        <button
          type="button"
          onClick={() => setQuick(!quick)}
          className="flex w-full items-start gap-3 text-left"
        >
          <span
            className={`mt-0.5 h-6 w-6 shrink-0 rounded-lg border ${
              quick ? 'border-forest bg-forest' : 'border-stone-300 bg-surface'
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">En el acceso rápido</span>
            <span className="block text-[12px] leading-snug text-muted">
              Aparece en la primera fila al registrar un gasto.
            </span>
          </span>
        </button>

        <Field label="Subcategorías" hint="Opcionales. Sirven para afinar sin llenar la pantalla.">
          <div className="space-y-2">
            {subs.map((sub) => (
              <div key={sub.id} className="flex items-center gap-2">
                <TextInput
                  value={sub.name}
                  onChange={(event) =>
                    setSubs((current) =>
                      current.map((entry) =>
                        entry.id === sub.id ? { ...entry, name: event.target.value } : entry,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={`Quitar ${sub.name}`}
                  onClick={() => setSubs((current) => current.filter((entry) => entry.id !== sub.id))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-muted"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <TextInput
                value={newSub}
                onChange={(event) => setNewSub(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSub();
                  }
                }}
                placeholder="Supermercado, fruta…"
              />
              <button
                type="button"
                aria-label="Añadir subcategoría"
                onClick={addSub}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage text-forest"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </Field>
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ *
 * Etiquetas
 * ------------------------------------------------------------------ */

export function TagSheet({
  open,
  onClose,
  tag,
}: {
  open: boolean;
  onClose: () => void;
  tag: Tag | null;
}) {
  const { data, actions } = useSemilla();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(tag?.name ?? '');
    setConfirmDelete(false);
    setBusy(false);
  }, [open, tag]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await actions.saveTag({
        id: tag?.id ?? crypto.randomUUID(),
        householdId: data.household.id,
        name: name.trim(),
        archived: tag?.archived ?? false,
        createdAt: tag?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!tag) return;
    setBusy(true);
    try {
      await actions.deleteTag(tag.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={tag ? 'Editar etiqueta' : 'Nueva etiqueta'}
      subtitle="Para cruzar gastos de categorías distintas: un viaje, una obra, un curso."
      footer={
        <div className="space-y-2">
          <Button full onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
          {tag ? (
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
                Eliminar etiqueta
              </button>
            )
          ) : null}
        </div>
      }
    >
      <div className="pb-2">
        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Viaje a Galicia"
            autoFocus
          />
        </Field>
      </div>
    </BottomSheet>
  );
}
