'use client';

import { useEffect } from 'react';

/**
 * Registro del service worker (§70, §71).
 * Cachea el armazón de la app para que abrir Semilla sin cobertura no dé error.
 * Los datos financieros siguen viniendo de Supabase: si no hay red, la app lo dice.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
