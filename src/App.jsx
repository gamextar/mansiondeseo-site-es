import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Compass,
  Flame,
  Gem,
  GlassWater,
  HeartHandshake,
  MapPinned,
  MessageCircleMore,
  ShieldCheck,
  Shield,
  UserRound,
} from 'lucide-react';
import { AgeGate } from './components/AgeGate';
import { AuthPanel } from './components/AuthPanel';
import { ChatPanel } from './components/ChatPanel';
import { FilterChips } from './components/FilterChips';
import { InboxList } from './components/InboxList';
import { OnboardingFlow } from './components/OnboardingFlow';
import { ProfileCard } from './components/ProfileCard';
import { ProfileDetail } from './components/ProfileDetail';
import { TopNav } from './components/TopNav';
import {
  activityFeed,
  conversation,
  landingPillars,
  membershipTiers,
  messageThreads,
  profiles,
  quickStats,
  testimonials,
} from './data/mockProfiles';

const allLocations = ['Todos', ...new Set(profiles.map((profile) => profile.country))];
const allFetishes = ['Todos', ...new Set(profiles.map((profile) => profile.fetish))];
const defaultSignUp = {
  alias: 'VelvetPair',
  email: 'invitacion@mansiondeseo.com',
  password: '12345678',
  role: 'Pareja',
  city: 'Buenos Aires',
};
const defaultOnboarding = {
  relationshipStyle: 'Reservado',
  intention: 'Encuentros selectos',
  intro:
    'Buscamos una experiencia elegante, adulta y con tensión bien conversada desde el primer contacto.',
  fetishes: ['Swinger', 'Trío'],
  interests: ['Wine bars', 'Hoteles boutique', 'Dress code'],
  city: 'Buenos Aires',
  plan: 'Primera copa privada y luego rooftop o suite boutique',
  bio:
    'Pareja curiosa, discreta y muy atenta a la química. Preferimos gente segura, con lenguaje claro y gusto por los detalles.',
  privacyMode: 'Fantasma visible solo con match',
  notificationMode: 'Solo matches',
  galleryStyle: 'Velvet Portrait',
};
const sessionKey = 'mansion-demo-experience';

function App() {
  const [ageVerified, setAgeVerified] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('mansion-age-verified') === 'true';
  });
  const [accessDenied, setAccessDenied] = useState(false);
  const [memberState, setMemberState] = useState(() => {
    if (typeof window === 'undefined') return 'guest';
    const saved = window.localStorage.getItem(sessionKey);
    if (!saved) return 'guest';
    try {
      return JSON.parse(saved).memberState ?? 'guest';
    } catch {
      return 'guest';
    }
  });
  const [signUpData, setSignUpData] = useState(() => {
    if (typeof window === 'undefined') return defaultSignUp;
    const saved = window.localStorage.getItem(sessionKey);
    if (!saved) return defaultSignUp;
    try {
      return JSON.parse(saved).signUpData ?? defaultSignUp;
    } catch {
      return defaultSignUp;
    }
  });
  const [onboardingData, setOnboardingData] = useState(() => {
    if (typeof window === 'undefined') return defaultOnboarding;
    const saved = window.localStorage.getItem(sessionKey);
    if (!saved) return defaultOnboarding;
    try {
      return JSON.parse(saved).onboardingData ?? defaultOnboarding;
    } catch {
      return defaultOnboarding;
    }
  });
  const [activeLocation, setActiveLocation] = useState('Todos');
  const [activeFetish, setActiveFetish] = useState('Todos');
  const [memberView, setMemberView] = useState(() => {
    if (typeof window === 'undefined') return 'discover';
    const saved = window.localStorage.getItem(sessionKey);
    if (!saved) return 'discover';
    try {
      return JSON.parse(saved).memberView ?? 'discover';
    } catch {
      return 'discover';
    }
  });
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id ?? null);
  const [activeThreadId, setActiveThreadId] = useState(messageThreads[0]?.id ?? null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('mansion-age-verified', String(ageVerified));
  }, [ageVerified]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      sessionKey,
      JSON.stringify({
        memberState,
        signUpData,
        onboardingData,
        memberView,
      }),
    );
  }, [memberState, signUpData, onboardingData, memberView]);

  const filteredProfiles = profiles.filter((profile) => {
    const matchesLocation =
      activeLocation === 'Todos' || profile.country === activeLocation;
    const matchesFetish = activeFetish === 'Todos' || profile.fetish === activeFetish;

    return matchesLocation && matchesFetish;
  });

  const selectedProfile =
    filteredProfiles.find((profile) => profile.id === selectedProfileId) ??
    filteredProfiles[0] ??
    profiles[0];
  const activeThread =
    messageThreads.find((thread) => thread.id === activeThreadId) ?? messageThreads[0];

  function updateSignUp(field, value) {
    setSignUpData((current) => ({ ...current, [field]: value }));
  }

  function handleSignUpSubmit(event) {
    event.preventDefault();
    setMemberState('onboarding');
  }

  function handleUseDemo() {
    setSignUpData(defaultSignUp);
    setOnboardingData(defaultOnboarding);
    setMemberState('onboarding');
  }

  function completeOnboarding(data) {
    setOnboardingData(data);
    setMemberState('member');
    setMemberView('discover');
  }

  function resetExperience() {
    setMemberState('guest');
    setMemberView('discover');
    setSignUpData(defaultSignUp);
    setOnboardingData(defaultOnboarding);
  }

  function renderDiscoverView() {
    return (
      <>
        <section className="mt-8 space-y-4 animate-fade-up">
          <FilterChips
            label="Filtrar por país"
            options={allLocations}
            value={activeLocation}
            onChange={setActiveLocation}
          />
          <FilterChips
            label="Filtrar por fetiche"
            options={allFetishes}
            value={activeFetish}
            onChange={setActiveFetish}
          />
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.36em] text-white/40">
                  Feed Curado
                </p>
                <h2 className="mt-2 font-display text-4xl text-mist">
                  Perfiles destacados
                </h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/60">
                {filteredProfiles.length} visibles
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    isSelected={selectedProfile?.id === profile.id}
                    onSelect={() => setSelectedProfileId(profile.id)}
                  />
                ))
              ) : (
                <div className="glass-panel rounded-[2rem] border border-dashed border-gold/25 p-8 text-center text-white/60">
                  <p className="font-display text-3xl text-mist">No hay matches en este filtro</p>
                  <p className="mt-3 text-sm leading-6">
                    Ajusta país o fetiche para revelar nuevos perfiles disponibles.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            {selectedProfile && (
              <>
                <ProfileDetail profile={selectedProfile} />
                <ChatPanel messages={conversation} />
              </>
            )}
          </aside>
        </section>
      </>
    );
  }

  function renderMessagesView() {
    return (
      <section className="mt-8 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <InboxList
          threads={messageThreads}
          activeThreadId={activeThreadId}
          onSelect={setActiveThreadId}
        />
        <div className="space-y-5">
          <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
            <p className="text-xs uppercase tracking-[0.34em] text-white/45">Conversación activa</p>
            <h2 className="mt-3 font-display text-4xl text-mist">{activeThread.name}</h2>
            <p className="mt-2 text-sm leading-6 text-white/68">
              {activeThread.role} · {activeThread.city} · Último mensaje {activeThread.time}
            </p>
          </section>
          <ChatPanel messages={conversation} />
        </div>
      </section>
    );
  }

  function renderProfileView() {
    return (
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel rounded-[2rem] border border-white/10 p-6 shadow-luxe">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Perfil Demo</p>
              <h2 className="mt-3 font-display text-5xl text-mist">{signUpData.alias}</h2>
              <p className="mt-2 text-sm leading-6 text-white/68">
                {signUpData.role} · {onboardingData.city} · {onboardingData.relationshipStyle}
              </p>
            </div>
            <div className="rounded-full border border-gold/35 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-gold">
              92% completo
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Modo de privacidad', value: onboardingData.privacyMode },
              { label: 'Notificaciones', value: onboardingData.notificationMode },
              { label: 'Estilo visual', value: onboardingData.galleryStyle },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
              >
                <p className="text-xs uppercase tracking-[0.28em] text-white/40">
                  {item.label}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/78">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">Bio</p>
            <p className="mt-3 text-sm leading-7 text-white/72">{onboardingData.bio}</p>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">
              Intereses y dinámicas
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {[...onboardingData.fetishes, ...onboardingData.interests].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-sm text-mist"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
            <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Checklist Privado</p>
            <div className="mt-5 space-y-3">
              {[
                'Identidad base configurada',
                'Preferencias de juego declaradas',
                'Bio y plan ideal completados',
                'Privacidad y alertas definidas',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3"
                >
                  <BadgeCheck size={18} className="text-gold" />
                  <span className="text-sm text-white/80">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
            <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Reiniciar Demo</p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Puedes volver al registro fake para simular otra identidad o un flujo de onboarding distinto.
            </p>
            <button
              type="button"
              onClick={resetExperience}
              className="mt-5 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.26em] text-white/80 transition hover:border-white/20 hover:bg-white/10"
            >
              Reiniciar experiencia
            </button>
          </section>
        </section>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-velvet pb-28 text-white">
      {!ageVerified && (
        <AgeGate
          denied={accessDenied}
          onEnter={() => {
            setAgeVerified(true);
            setAccessDenied(false);
          }}
          onExit={() => setAccessDenied(true)}
          onReset={() => setAccessDenied(false)}
        />
      )}

      <TopNav
        isMember={memberState === 'member'}
        memberName={signUpData.alias}
        onPrimaryAction={() => {
          const section = document.getElementById('registro');
          section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onMessages={() => setMemberView('messages')}
        onProfile={() => setMemberView('profile')}
      />

      {memberState === 'onboarding' ? (
        <OnboardingFlow
          signUpData={signUpData}
          initialData={onboardingData}
          onBack={() => setMemberState('guest')}
          onComplete={completeOnboarding}
        />
      ) : (
        <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
          {memberState === 'guest' ? (
            <>
              <section className="animate-fade-up grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="glass-panel rounded-[2.2rem] border border-white/10 p-6 shadow-luxe sm:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.32em] text-gold">
                      Acceso Exclusivo
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/60">
                      Cuckold · Swinger · Tríos
                    </span>
                  </div>

                  <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[0.92] text-mist sm:text-7xl">
                    Un club privado nocturno para adultos que valoran discreción, estética y química.
                  </h1>

                  <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                    Mansion Deseo ahora incluye un recorrido completo: registro simulado, onboarding elegante y zona privada con feed, mensajes y perfil. Todo está pensado para verse premium en móvil.
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    {quickStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                          {stat.label}
                        </p>
                        <p className="mt-3 font-display text-4xl text-gold">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const section = document.getElementById('registro');
                        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="rounded-full border border-gold/40 bg-gold px-5 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-black transition hover:brightness-110"
                    >
                      Empezar registro
                    </button>
                    <button
                      type="button"
                      onClick={handleUseDemo}
                      className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:border-white/20 hover:bg-white/10"
                    >
                      Ver onboarding demo
                    </button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {[
                    {
                      icon: Shield,
                      title: 'Verificación +18',
                      text: 'Modal elegante que bloquea el acceso hasta validar mayoría de edad.',
                    },
                    {
                      icon: Compass,
                      title: 'Thumb-first Mobile',
                      text: 'Acciones táctiles amplias, navegación clara y lectura cómoda desde una sola mano.',
                    },
                    {
                      icon: MessageCircleMore,
                      title: 'Chat Premium',
                      text: 'Interfaz familiar tipo WhatsApp con límites visibles para incentivar upgrade VIP.',
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="glass-panel rounded-[1.8rem] border border-white/10 p-5 shadow-luxe"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                        <item.icon size={20} />
                      </div>
                      <h2 className="mt-4 font-display text-3xl text-mist">{item.title}</h2>
                      <p className="mt-3 text-sm leading-6 text-white/70">{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]" id="registro">
                <AuthPanel
                  formData={signUpData}
                  onChange={updateSignUp}
                  onSubmit={handleSignUpSubmit}
                  onUseDemo={handleUseDemo}
                />

                <div className="grid gap-5">
                  <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
                    <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Qué obtienes</p>
                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      {landingPillars.map((pillar, index) => {
                        const icons = [Gem, ShieldCheck, HeartHandshake];
                        const Icon = icons[index];
                        return (
                          <div
                            key={pillar.title}
                            className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
                          >
                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold">
                              <Icon size={18} />
                            </div>
                            <h3 className="mt-4 font-display text-2xl text-mist">{pillar.title}</h3>
                            <p className="mt-3 text-sm leading-6 text-white/68">{pillar.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Membresías</p>
                        <h2 className="mt-3 font-display text-4xl text-mist">Capas de acceso</h2>
                      </div>
                      <GlassWater size={20} className="text-gold" />
                    </div>
                    <div className="mt-5 grid gap-4">
                      {membershipTiers.map((tier) => (
                        <div
                          key={tier.name}
                          className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-display text-3xl text-mist">{tier.name}</h3>
                            <span className="rounded-full border border-gold/35 bg-gold/10 px-3 py-2 text-[10px] uppercase tracking-[0.26em] text-gold">
                              {tier.badge}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-white/68">{tier.description}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {tier.perks.map((perk) => (
                              <span
                                key={perk}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/70"
                              >
                                {perk}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </section>

              <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
                  <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Vista previa</p>
                  <h2 className="mt-3 font-display text-4xl text-mist">Así se verá tu zona privada</h2>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {profiles.slice(0, 2).map((profile) => (
                      <ProfileCard
                        key={profile.id}
                        profile={profile}
                        isSelected={selectedProfile?.id === profile.id}
                        onSelect={() => setSelectedProfileId(profile.id)}
                      />
                    ))}
                  </div>
                </section>

                <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
                  <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Reseñas privadas</p>
                  <div className="mt-5 space-y-4">
                    {testimonials.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
                      >
                        <p className="font-display text-2xl text-mist">{item.name}</p>
                        <p className="mt-3 text-sm leading-6 text-white/70">“{item.quote}”</p>
                      </div>
                    ))}
                  </div>
                </section>
              </section>
            </>
          ) : (
            <>
              <section className="animate-fade-up grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="glass-panel rounded-[2.2rem] border border-white/10 p-6 shadow-luxe sm:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.32em] text-gold">
                      Bienvenido al Club
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/60">
                      {signUpData.alias}
                    </span>
                  </div>

                  <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[0.94] text-mist sm:text-6xl">
                    Tu perfil demo ya está dentro de Mansion Deseo.
                  </h1>

                  <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                    Ahora puedes explorar perfiles, revisar conversaciones y ajustar la identidad creada durante el onboarding.
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Compatibilidad', value: '94%' },
                      { label: 'Visibilidad', value: 'Alta' },
                      { label: 'Mensajes hoy', value: '5/10' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                          {stat.label}
                        </p>
                        <p className="mt-3 font-display text-4xl text-gold">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
                  <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Actividad reciente</p>
                  <div className="mt-5 space-y-4">
                    {activityFeed.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h2 className="font-display text-2xl text-mist">{item.title}</h2>
                          <span className="text-xs uppercase tracking-[0.22em] text-white/40">
                            {item.time}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/68">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </section>

              {memberView === 'discover' && renderDiscoverView()}
              {memberView === 'messages' && renderMessagesView()}
              {memberView === 'profile' && renderProfileView()}
            </>
          )}
        </main>
      )}

      {memberState === 'member' && (
        <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-xl rounded-full border border-white/10 bg-black/70 px-3 py-3 shadow-luxe backdrop-blur-xl">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Flame, label: 'Feed', value: 'discover' },
              { icon: MapPinned, label: 'Explorar', value: 'discover' },
              { icon: MessageCircleMore, label: 'Mensajes', value: 'messages' },
              { icon: UserRound, label: 'Perfil', value: 'profile' },
            ].map((item, index) => (
              <button
                type="button"
                key={`${item.label}-${index}`}
                onClick={() => setMemberView(item.value)}
                className={`flex flex-col items-center justify-center gap-1 rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.22em] transition ${
                  memberView === item.value && !(index === 1 && memberView === 'discover')
                    ? 'bg-gold text-black'
                    : memberView === 'discover' && index === 1
                      ? 'bg-gold/15 text-gold'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
