import { clearBootDebugFlags } from '../lib/bootDebugPrefs';

export default function BlackScreenPage() {
  const exitBlackTest = () => {
    clearBootDebugFlags();
    if (typeof window !== 'undefined') {
      window.location.replace('/inicio');
    }
  };

  return (
    <div className="min-h-screen bg-mansion-base text-white">
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-text-dim">Boot Test</p>
          <h1 className="mt-4 text-2xl font-semibold">Pantalla negra</h1>
          <p className="mt-3 text-sm text-text-muted">
            Ruta minima de prueba para aislar el flicker del arranque.
          </p>
          <button
            onClick={exitBlackTest}
            className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/10"
          >
            Salir de la prueba
          </button>
        </div>
      </div>
    </div>
  );
}
