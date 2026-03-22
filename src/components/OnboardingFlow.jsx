import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Shield, Sparkles } from 'lucide-react';
import { onboardingChoices } from '../data/mockProfiles';

function SelectChip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip ${active ? 'chip-active' : 'bg-white/5 hover:border-white/20 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

export function OnboardingFlow({ signUpData, initialData, onBack, onComplete }) {
  const steps = [
    'Identidad',
    'Deseos',
    'Estilo',
    'Privacidad',
  ];
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initialData);

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleMulti(field, value) {
    setDraft((current) => {
      const exists = current[field].includes(value);
      return {
        ...current,
        [field]: exists
          ? current[field].filter((item) => item !== value)
          : [...current[field], value],
      };
    });
  }

  function nextStep() {
    if (step === steps.length - 1) {
      onComplete(draft);
      return;
    }
    setStep((current) => current + 1);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="glass-panel rounded-[2rem] border border-white/10 p-6 shadow-luxe">
          <p className="text-xs uppercase tracking-[0.36em] text-gold/70">Onboarding Privado</p>
          <h1 className="mt-4 font-display text-5xl leading-[0.92] text-mist">
            Afinemos tu entrada al club.
          </h1>
          <p className="mt-4 text-sm leading-7 text-white/70">
            Estamos construyendo la primera impresión de <span className="text-gold">{signUpData.alias}</span>. Todo aquí es fake, pero el flujo simula una experiencia premium de activación.
          </p>

          <div className="mt-8 space-y-3">
            {steps.map((item, index) => {
              const active = index === step;
              const done = index < step;
              return (
                <div
                  key={item}
                  className={`flex items-center gap-3 rounded-[1.2rem] border px-4 py-3 ${
                    active
                      ? 'border-gold/40 bg-gold/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                      done || active
                        ? 'border-gold/40 bg-gold/10 text-gold'
                        : 'border-white/10 bg-black/20 text-white/45'
                    }`}
                  >
                    {done ? <Check size={16} /> : index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-white">{item}</p>
                    <p className="text-sm text-white/55">
                      {index === 0 && 'Rol, intención y forma de vincularte'}
                      {index === 1 && 'Fetiches e intereses compatibles'}
                      {index === 2 && 'Bio, ciudad y tipo de planes'}
                      {index === 3 && 'Visibilidad, alertas y estilo visual'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-gold" />
              <p className="text-sm font-medium text-white">Tu perfil nacerá en modo discreto</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Luego podrás editar estos datos o reiniciar la demo para simular otro tipo de miembro.
            </p>
          </div>
        </aside>

        <div className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-white/45">
                Paso {step + 1} de {steps.length}
              </p>
              <h2 className="mt-2 font-display text-4xl text-mist">{steps[step]}</h2>
            </div>
            <div className="rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-gold">
              Demo guiada
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="mt-6 grid gap-6">
            {step === 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.28em] text-white/45">
                      Estilo vincular
                    </span>
                    <select
                      value={draft.relationshipStyle}
                      onChange={(event) => updateField('relationshipStyle', event.target.value)}
                      className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    >
                      {onboardingChoices.relationshipStyles.map((item) => (
                        <option key={item} className="bg-obsidian">
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.28em] text-white/45">
                      Intención principal
                    </span>
                    <select
                      value={draft.intention}
                      onChange={(event) => updateField('intention', event.target.value)}
                      className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    >
                      {onboardingChoices.intentions.map((item) => (
                        <option key={item} className="bg-obsidian">
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.28em] text-white/45">
                    Presentación breve
                  </span>
                  <textarea
                    rows={5}
                    value={draft.intro}
                    onChange={(event) => updateField('intro', event.target.value)}
                    className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/40"
                  />
                </label>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">
                    Fetiches
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {onboardingChoices.fetishes.map((item) => (
                      <SelectChip
                        key={item}
                        active={draft.fetishes.includes(item)}
                        onClick={() => toggleMulti('fetishes', item)}
                      >
                        {item}
                      </SelectChip>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">
                    Intereses del entorno
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {onboardingChoices.interests.map((item) => (
                      <SelectChip
                        key={item}
                        active={draft.interests.includes(item)}
                        onClick={() => toggleMulti('interests', item)}
                      >
                        {item}
                      </SelectChip>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.28em] text-white/45">
                      Ciudad actual
                    </span>
                    <input
                      value={draft.city}
                      onChange={(event) => updateField('city', event.target.value)}
                      className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.28em] text-white/45">
                      Plan ideal
                    </span>
                    <input
                      value={draft.plan}
                      onChange={(event) => updateField('plan', event.target.value)}
                      className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.28em] text-white/45">
                    Bio de club
                  </span>
                  <textarea
                    rows={6}
                    value={draft.bio}
                    onChange={(event) => updateField('bio', event.target.value)}
                    className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/40"
                  />
                </label>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.28em] text-white/45">
                      Privacidad
                    </span>
                    <select
                      value={draft.privacyMode}
                      onChange={(event) => updateField('privacyMode', event.target.value)}
                      className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    >
                      {onboardingChoices.privacyModes.map((item) => (
                        <option key={item} className="bg-obsidian">
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.28em] text-white/45">
                      Alertas
                    </span>
                    <select
                      value={draft.notificationMode}
                      onChange={(event) => updateField('notificationMode', event.target.value)}
                      className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    >
                      {onboardingChoices.notificationModes.map((item) => (
                        <option key={item} className="bg-obsidian">
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">
                    Estilo visual del perfil
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {onboardingChoices.galleryStyles.map((item) => (
                      <SelectChip
                        key={item}
                        active={draft.galleryStyle === item}
                        onClick={() => updateField('galleryStyle', item)}
                      >
                        {item}
                      </SelectChip>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-gold/25 bg-gold/10 p-5">
                  <div className="flex items-center gap-3">
                    <Sparkles size={18} className="text-gold" />
                    <p className="font-medium text-mist">Tu perfil está listo para entrar al feed</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/70">
                    Activaremos una cuenta demo con identidad, tono, preferencias y visibilidad ya configuradas.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={step === 0 ? onBack : () => setStep((current) => current - 1)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.26em] text-white/80 transition hover:border-white/20 hover:bg-white/10"
            >
              <ChevronLeft size={16} />
              {step === 0 ? 'Volver' : 'Anterior'}
            </button>

            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gold/40 bg-gold px-5 py-3 text-sm font-semibold uppercase tracking-[0.26em] text-black transition hover:brightness-110"
            >
              {step === steps.length - 1 ? 'Entrar al Club' : 'Siguiente'}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
