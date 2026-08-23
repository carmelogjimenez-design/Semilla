/**
 * Lectura tipada de variables de entorno.
 * Nunca se importa aquí ninguna clave privada: sólo las públicas de Supabase.
 */

function requiredPublic(name: string, value: string | undefined): string {
  if (!value || value.startsWith('https://TU-') || value.startsWith('TU_')) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env.local y rellena los valores de tu proyecto de Supabase.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return requiredPublic('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return requiredPublic('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** ¿Hay backend configurado? Permite pintar una pantalla de ayuda en vez de reventar. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.startsWith('https://TU-') && !key.startsWith('TU_'));
}

/** Modo previsualización de interfaz. Sólo desarrollo (§dev). */
export function isPreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SEMILLA_PREVIEW === '1';
}

/**
 * URL pública del despliegue, para los enlaces de correo de Supabase.
 * Prioridad: variable explícita → dominio de Vercel → localhost.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}
