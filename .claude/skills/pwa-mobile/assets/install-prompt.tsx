'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosShow, setIosShow] = useState(false);

  useEffect(() => {
    // Android / Chrome desktop
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isIOS && !isStandalone) {
      setIosShow(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
      setDeferred(null);
    }
  }

  if (show) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-white p-4 shadow-praxis-lg dark:bg-zinc-900">
        <p className="text-sm font-medium">Instala TuApp</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Acceso rapido desde tu pantalla de inicio.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleInstall}
            className="rounded-lg bg-gradient-to-r from-[#0a84ff] to-[#00d9ff] px-4 py-2 text-sm font-medium text-white"
          >
            Instalar
          </button>
          <button
            onClick={() => setShow(false)}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400"
          >
            Despues
          </button>
        </div>
      </div>
    );
  }

  if (iosShow) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 rounded-xl bg-white p-4 shadow-praxis-lg dark:bg-zinc-900">
        <p className="text-sm font-medium">Para recibir notificaciones</p>
        <ol className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          <li>1. Toca el boton compartir abajo en Safari.</li>
          <li>2. "Agregar a pantalla de inicio".</li>
          <li>3. Abre la app desde el icono.</li>
        </ol>
        <button
          onClick={() => setIosShow(false)}
          className="mt-3 text-xs text-zinc-500 underline"
        >
          Entendido
        </button>
      </div>
    );
  }

  return null;
}
