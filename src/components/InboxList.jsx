export function InboxList({ threads, activeThreadId, onSelect }) {
  return (
    <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.34em] text-gold/70">Inbox Privado</p>
          <h2 className="mt-3 font-display text-3xl text-mist">Conversaciones</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.28em] text-white/60">
          {threads.length} abiertas
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {threads.map((thread) => {
          const active = thread.id === activeThreadId;
          return (
            <button
              type="button"
              key={thread.id}
              onClick={() => onSelect(thread.id)}
              className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                active
                  ? 'border-gold/35 bg-gold/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{thread.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/45">
                    {thread.role} · {thread.city}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/45">{thread.time}</p>
                  {thread.unread > 0 && (
                    <span className="mt-2 inline-flex rounded-full border border-gold/35 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-gold">
                      {thread.unread} nuevas
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/68">{thread.preview}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

