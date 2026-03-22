import { Crown, ShieldCheck, Sparkles } from 'lucide-react';

export function AgeGate({ onEnter, onExit, onReset, denied }) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-2xl">
      <div className="glass-panel gold-ring relative w-full max-w-lg overflow-hidden rounded-[2rem] shadow-luxe">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.24),transparent_36%),radial-gradient(circle_at_bottom,rgba(91,24,38,0.35),transparent_34%)]" />
        <div className="relative space-y-6 px-6 py-8 sm:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
            {denied ? <ShieldCheck size={26} /> : <Crown size={26} />}
          </div>

          <div className="space-y-3 text-center">
            <p className="text-xs uppercase tracking-[0.45em] text-gold/70">
              Mansion Deseo
            </p>
            <h1 className="font-display text-4xl leading-none text-mist sm:text-5xl">
              {denied ? 'Acceso Restringido' : 'Entrada Solo Para Adultos'}
            </h1>
            <p className="mx-auto max-w-md text-sm leading-6 text-white/70 sm:text-base">
              {denied
                ? 'Este espacio privado está reservado exclusivamente para personas mayores de edad.'
                : 'Verifica que tienes al menos 18 años para acceder a una experiencia exclusiva, discreta y cuidadosamente curada.'}
            </p>
          </div>

          {!denied && (
            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-white/70">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-gold" />
                <span>Comunidad cerrada con tono premium y enfoque en discreción.</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles size={18} className="text-gold" />
                <span>Contenido destinado a adultos, sin acceso para menores.</span>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {denied ? (
              <button
                type="button"
                onClick={onReset}
                className="rounded-full border border-gold/40 bg-gold px-5 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-black transition hover:brightness-110"
              >
                Volver
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onEnter}
                  className="rounded-full border border-gold/40 bg-gold px-5 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-black transition hover:brightness-110"
                >
                  Soy Mayor de 18
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:border-wine/70 hover:bg-wine/20"
                >
                  Salir
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
