import { useEffect, useState } from 'react';
import {
  Compass,
  Flame,
  MapPinned,
  MessageCircleMore,
  Shield,
  UserRound,
} from 'lucide-react';
import { AgeGate } from './components/AgeGate';
import { ChatPanel } from './components/ChatPanel';
import { FilterChips } from './components/FilterChips';
import { ProfileCard } from './components/ProfileCard';
import { ProfileDetail } from './components/ProfileDetail';
import { TopNav } from './components/TopNav';
import { conversation, profiles, quickStats } from './data/mockProfiles';

const allLocations = ['Todos', ...new Set(profiles.map((profile) => profile.country))];
const allFetishes = ['Todos', ...new Set(profiles.map((profile) => profile.fetish))];

function App() {
  const [ageVerified, setAgeVerified] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('mansion-age-verified') === 'true';
  });
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeLocation, setActiveLocation] = useState('Todos');
  const [activeFetish, setActiveFetish] = useState('Todos');
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id ?? null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('mansion-age-verified', String(ageVerified));
  }, [ageVerified]);

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

      <TopNav />

      <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
        <section className="animate-fade-up grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="glass-panel rounded-[2.2rem] border border-white/10 p-6 shadow-luxe sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.32em] text-gold">
                Acceso Exclusivo
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/60">
                Cuckold · Swinger · Tríos
              </span>
            </div>

            <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[0.92] text-mist sm:text-6xl">
              Un club privado para encuentros adultos con estética nocturna y filtro real.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              Mansion Deseo reúne perfiles selectos, chats discretos y una experiencia pensada
              para el pulgar: rápida, envolvente y elegante en móvil, sin caer en códigos
              visuales vulgares.
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
      </main>

      <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-xl rounded-full border border-white/10 bg-black/70 px-3 py-3 shadow-luxe backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Flame, label: 'Feed' },
            { icon: MapPinned, label: 'Explorar' },
            { icon: MessageCircleMore, label: 'Mensajes' },
            { icon: UserRound, label: 'Perfil' },
          ].map((item, index) => (
            <button
              type="button"
              key={item.label}
              className={`flex flex-col items-center justify-center gap-1 rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.22em] transition ${
                index === 0
                  ? 'bg-gold text-black'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default App;
