'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

/**
 * Hoja inferior. En móvil sustituye a cualquier modal de escritorio (§2).
 * Se cierra arrastrando hacia abajo, tocando fuera o con Escape.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeight = '92vh',
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxHeight?: string;
  dismissable?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, dismissable]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-forest/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dismissable && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-sheet sm:mb-4 sm:rounded-[28px]"
            style={{ maxHeight }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag={dismissable ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 700) onClose();
            }}
          >
            <div className="flex justify-center pt-3" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-stone-200" />
            </div>

            {title ? (
              <div className="flex items-start gap-3 px-5 pb-3 pt-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-title text-ink">{title}</h2>
                  {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
                </div>
                {dismissable ? (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="touch -mr-2 -mt-1 flex items-center justify-center rounded-full p-2 text-muted active:bg-stone-100"
                  >
                    <X size={20} />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">{children}</div>

            {footer ? (
              <div
                className="border-t border-stone-100 bg-surface px-5 pt-3"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
              >
                {footer}
              </div>
            ) : (
              <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }} />
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
