import { Crown, MessagesSquare, UserRound } from 'lucide-react';

export function TopNav({
  isMember = false,
  memberName = 'Invitado',
  onPrimaryAction,
  onMessages,
  onProfile,
}) {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
      <div className="glass-panel mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/10 px-4 py-3 shadow-luxe">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
            <Crown size={20} />
          </div>
          <div>
            <p className="font-display text-2xl tracking-[0.12em] text-mist">
              Mansion Deseo
            </p>
            <p className="text-[10px] uppercase tracking-[0.36em] text-white/40">
              Private Connections Club
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMember ? (
            <>
              <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/60 sm:block">
                {memberName}
              </div>
              <button
                type="button"
                onClick={onMessages}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 transition hover:border-gold/40 hover:text-gold"
                aria-label="Mensajes"
              >
                <MessagesSquare size={18} />
              </button>
              <button
                type="button"
                onClick={onProfile}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 transition hover:border-gold/40 hover:text-gold"
                aria-label="Perfil"
              >
                <UserRound size={18} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="rounded-full border border-gold/40 bg-gold px-5 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-black transition hover:brightness-110"
            >
              Solicitar Acceso
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
