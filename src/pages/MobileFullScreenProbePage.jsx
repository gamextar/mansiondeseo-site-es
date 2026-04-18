export default function MobileFullScreenProbePage() {
  return (
    <div className="min-h-screen bg-[#d90429] pb-mobile-legacy-nav lg:pb-8 pt-navbar lg:pt-0 text-white">
      <div className="px-3 pt-4 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Prueba Mobile</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">Contenedor rojo a pantalla completa</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
            Esta pantalla usa exactamente la misma raíz que Mensajes: mismo shell, mismo padding superior e inferior, mismo comportamiento mobile.
          </p>
        </div>
      </div>

      <div className="px-2">
        <div className="rounded-2xl border border-white/25 bg-black/15 p-4 backdrop-blur-sm min-h-[60vh]">
          <p className="text-sm font-semibold">Checklist visual</p>
          <p className="mt-2 text-sm text-white/85">Si esto sale bien, el rojo debería verse exactamente con el mismo comportamiento de contenedor que la sección de Mensajes.</p>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/65">
            Copia literal del shell de mensajes
          </p>
        </div>
      </div>
    </div>
  );
}
