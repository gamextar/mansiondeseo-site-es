export default function BlackScreenPage() {
  return (
    <div className="min-h-screen bg-mansion-base text-white">
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-text-dim">Boot Test</p>
          <h1 className="mt-4 text-2xl font-semibold">Pantalla negra</h1>
          <p className="mt-3 text-sm text-text-muted">
            Ruta minima de prueba para aislar el flicker del arranque.
          </p>
        </div>
      </div>
    </div>
  );
}
