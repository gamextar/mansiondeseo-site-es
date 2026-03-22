import { LockKeyhole, Mail, MapPin, Sparkles, UserRound } from 'lucide-react';

function Field({ icon: Icon, children, label }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs uppercase tracking-[0.28em] text-white/45">{label}</span>
      <div className="flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3">
        <Icon size={17} className="text-gold" />
        {children}
      </div>
    </label>
  );
}

export function AuthPanel({ formData, onChange, onSubmit, onUseDemo }) {
  return (
    <section className="glass-panel gold-ring rounded-[2rem] p-5 shadow-luxe sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Registro Privado</p>
          <h2 className="mt-3 font-display text-4xl text-mist">Solicita tu acceso</h2>
        </div>
        <div className="rounded-full border border-gold/30 bg-gold/10 px-3 py-2 text-xs uppercase tracking-[0.28em] text-gold">
          Demo
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-white/70">
        Simulación de registro elegante para entrar al club, crear tu identidad inicial y pasar al onboarding.
      </p>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <Field icon={UserRound} label="Alias">
          <input
            value={formData.alias}
            onChange={(event) => onChange('alias', event.target.value)}
            placeholder="VelvetPair"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
        </Field>

        <Field icon={Mail} label="Email">
          <input
            value={formData.email}
            onChange={(event) => onChange('email', event.target.value)}
            placeholder="invitacion@mansiondeseo.com"
            type="email"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
        </Field>

        <Field icon={LockKeyhole} label="Clave">
          <input
            value={formData.password}
            onChange={(event) => onChange('password', event.target.value)}
            placeholder="••••••••"
            type="password"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={Sparkles} label="Rol">
            <select
              value={formData.role}
              onChange={(event) => onChange('role', event.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none"
            >
              <option className="bg-obsidian">Pareja</option>
              <option className="bg-obsidian">Hombre Solo</option>
              <option className="bg-obsidian">Mujer Sola</option>
            </select>
          </Field>

          <Field icon={MapPin} label="Ciudad base">
            <input
              value={formData.city}
              onChange={(event) => onChange('city', event.target.value)}
              placeholder="Buenos Aires"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
          </Field>
        </div>

        <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/65">
          Este registro es fake: no crea cuenta real. Solo alimenta el onboarding y la experiencia visual de producto.
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="submit"
            className="rounded-full border border-gold/40 bg-gold px-5 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-black transition hover:brightness-110"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={onUseDemo}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:border-white/20 hover:bg-white/10"
          >
            Cargar Demo
          </button>
        </div>
      </form>
    </section>
  );
}

