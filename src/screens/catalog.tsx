'use client';

import Link from 'next/link';
import { Archive, ChevronRight, Plus, ShieldCheck, Waves, Zap } from 'lucide-react';
import { useState } from 'react';

import { CategorySheet, TagSheet } from '@/components/flows/catalog-sheets';
import { Button, Card, EmptyState, SectionTitle } from '@/components/ui/primitives';
import type { Category, Tag } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * CATEGORÍAS Y ETIQUETAS (§46, §53) — el vocabulario de la casa.
 *
 * Una categoría archivada no desaparece: los movimientos que ya la usaban
 * siguen contando en su histórico. Sólo deja de ofrecerse al registrar.
 */
export function CatalogScreen() {
  const { data } = useSemilla();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [creatingTag, setCreatingTag] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = data.categories.filter((category) => !category.archived);
  const archived = data.categories.filter((category) => category.archived);
  const tags = data.tags.filter((tag) => !tag.archived);

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <Link href="/mas" className="text-[13px] font-medium text-muted">
          ‹ Más
        </Link>
        <h1 className="mt-1 text-title text-ink">Categorías y etiquetas</h1>
        <p className="mt-0.5 text-[13px] text-muted">El vocabulario con el que contáis vuestro dinero.</p>
      </header>

      <section>
        <SectionTitle>Categorías</SectionTitle>
        <Card className="px-2 py-1">
          <div className="divide-y divide-stone-100">
            {active.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setEditing(category)}
                className="flex w-full items-center gap-3 px-2 py-3 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warm text-lg">
                  <span aria-hidden>{category.emoji}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{category.name}</span>
                  <span className="flex items-center gap-1.5 text-[12px] text-muted">
                    {category.priority === 'protected' ? (
                      <>
                        <ShieldCheck size={12} className="text-seed-700" aria-hidden /> Protegida
                      </>
                    ) : (
                      <>
                        <Waves size={12} className="text-clay" aria-hidden /> Flexible
                      </>
                    )}
                    {category.quick ? (
                      <>
                        <span aria-hidden>·</span>
                        <Zap size={12} aria-hidden /> Rápida
                      </>
                    ) : null}
                    {category.subcategories.filter((sub) => !sub.archived).length > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        {category.subcategories.filter((sub) => !sub.archived).length} subcategorías
                      </>
                    ) : null}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden />
              </button>
            ))}
          </div>
        </Card>

        <Button variant="secondary" full className="mt-3" onClick={() => setCreating(true)}>
          <Plus size={18} /> Nueva categoría
        </Button>
      </section>

      {archived.length > 0 ? (
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex w-full items-center gap-2 text-[13px] font-medium text-muted"
          >
            <Archive size={14} aria-hidden />
            {archived.length} archivadas
            <ChevronRight
              size={14}
              className={`transition ${showArchived ? 'rotate-90' : ''}`}
              aria-hidden
            />
          </button>
          {showArchived ? (
            <Card className="mt-3 px-2 py-1">
              <div className="divide-y divide-stone-100">
                {archived.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setEditing(category)}
                    className="flex w-full items-center gap-3 px-2 py-3 text-left opacity-60"
                  >
                    <span aria-hidden className="w-6 text-center">
                      {category.emoji}
                    </span>
                    <span className="flex-1 truncate text-[15px] text-ink">{category.name}</span>
                    <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden />
                  </button>
                ))}
              </div>
            </Card>
          ) : null}
          <p className="mt-2 text-[12px] leading-relaxed text-stone-400">
            Lo archivado sigue contando en el histórico. Sólo deja de aparecer al registrar.
          </p>
        </section>
      ) : null}

      <section className="mt-6">
        <SectionTitle>Etiquetas</SectionTitle>
        {tags.length === 0 ? (
          <EmptyState
            emoji="🏷️"
            title="Sin etiquetas todavía"
            body="Una etiqueta cruza gastos de categorías distintas: un viaje, una obra, un curso. Después podéis ver cuánto costó entero."
            action={<Button onClick={() => setCreatingTag(true)}>Crear una etiqueta</Button>}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setEditingTag(tag)}
                  className="rounded-full bg-stone-100 px-3.5 py-2 text-[14px] font-medium text-ink active:bg-stone-200"
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <Button variant="secondary" full className="mt-3" onClick={() => setCreatingTag(true)}>
              <Plus size={18} /> Nueva etiqueta
            </Button>
          </>
        )}
      </section>

      <CategorySheet open={creating} onClose={() => setCreating(false)} category={null} />
      <CategorySheet open={editing !== null} onClose={() => setEditing(null)} category={editing} />
      <TagSheet open={creatingTag} onClose={() => setCreatingTag(false)} tag={null} />
      <TagSheet open={editingTag !== null} onClose={() => setEditingTag(null)} tag={editingTag} />
    </div>
  );
}
