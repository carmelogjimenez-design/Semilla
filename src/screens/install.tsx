'use client';

import Link from 'next/link';
import { Check, Download, Share, SquarePlus, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, Card, SectionTitle } from '@/components/ui/primitives';
import { SemillaMark } from '@/components/ui/logo';

/**
 * INSTALAR EN EL MÓVIL (§70, §71).
 *
 * Semilla no está en ninguna tienda y no hace falta: es una PWA. Instalarla la
 * saca del navegador —sin barra de direcciones, con su icono— y hace que abrirla
 * sin cobertura no dé error.
 *
 * En Android y escritorio el navegador ofrece instalarla y la app puede pedirlo;
 * en iPhone eso no existe: hay que explicárselo a la persona, paso a paso.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallScreen() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <Link href="/mas" className="text-[13px] font-medium text-muted">
          ‹ Más
        </Link>
        <h1 className="mt-1 text-title text-ink">Instalar en el móvil</h1>
        <p className="mt-0.5 text-[13px] text-muted">Para abrirla como una app más.</p>
      </header>

      <Card className="flex flex-col items-center py-8 text-center">
        <SemillaMark size={56} />
        {installed ? (
          <>
            <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-seed-800">
              <Check size={18} aria-hidden /> Ya está instalada
            </p>
            <p className="mt-2 max-w-[30ch] text-[13px] leading-relaxed text-muted">
              La estáis usando desde el icono de la pantalla de inicio. Nada más que hacer.
            </p>
          </>
        ) : prompt ? (
          <>
            <p className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-ink">
              Vuestro navegador puede instalarla ahora mismo.
            </p>
            <Button className="mt-5" onClick={install}>
              <Download size={18} /> Instalar Semilla
            </Button>
          </>
        ) : (
          <p className="mt-4 max-w-[32ch] text-[14px] leading-relaxed text-muted">
            {isIOS
              ? 'En iPhone se instala desde el propio Safari, en dos toques.'
              : 'Abridla en Chrome desde el móvil y el navegador os ofrecerá instalarla.'}
          </p>
        )}
      </Card>

      <section className="mt-6">
        <SectionTitle>{isIOS ? 'En este iPhone' : 'Paso a paso'}</SectionTitle>
        <Card className="space-y-5">
          {isIOS ? (
            <>
              <Step
                n={1}
                icon={<Share size={17} className="text-seed-700" aria-hidden />}
                title="Toca Compartir"
                body="El icono del cuadrado con la flecha hacia arriba, abajo en la barra de Safari."
              />
              <Step
                n={2}
                icon={<SquarePlus size={17} className="text-seed-700" aria-hidden />}
                title="Añadir a pantalla de inicio"
                body="Baja un poco en la lista hasta encontrarlo."
              />
              <Step
                n={3}
                icon={<Check size={17} className="text-seed-700" aria-hidden />}
                title="Añadir"
                body="Aparecerá el icono de Semilla junto al resto de vuestras apps."
              />
            </>
          ) : (
            <>
              <Step
                n={1}
                icon={<Download size={17} className="text-seed-700" aria-hidden />}
                title="Abre el menú del navegador"
                body="Los tres puntos, arriba a la derecha."
              />
              <Step
                n={2}
                icon={<SquarePlus size={17} className="text-seed-700" aria-hidden />}
                title="Instalar aplicación"
                body="También puede aparecer como «Añadir a pantalla de inicio»."
              />
              <Step
                n={3}
                icon={<Check size={17} className="text-seed-700" aria-hidden />}
                title="Listo"
                body="Semilla se abrirá con su icono, sin barra de direcciones."
              />
            </>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <SectionTitle>Qué cambia</SectionTitle>
        <Card className="space-y-4">
          <div className="flex gap-3">
            <WifiOff size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <p className="text-[13px] leading-relaxed text-muted">
              Sin cobertura, Semilla abre igual y os dice que está sin conexión, en vez de dar un error
              del navegador. Los números siguen viniendo de vuestra base de datos: lo que se guarda
              necesita red, y la app avisa cuando no la hay.
            </p>
          </div>
          <p className="text-[12px] leading-relaxed text-muted">
            No es una app de tienda: no pide permisos, no ocupa espacio apenas y se actualiza sola cada
            vez que la abrís.
          </p>
        </Card>
      </section>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-muted">
        Cada uno en su móvil, con su correo.
        <br />
        Los mismos números.
      </p>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sage text-[13px] font-bold text-seed-800">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
          {icon}
          {title}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}
