import { Mic, SendHorizontal } from 'lucide-react';

export function ChatPanel({ messages }) {
  return (
    <section className="glass-panel rounded-[2rem] border border-white/10 p-5 shadow-luxe sm:p-6">
      <div className="flex items-center justify-between gap-3 rounded-[1.4rem] border border-gold/25 bg-gold/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-gold/70">Mensajería</p>
          <p className="mt-1 text-sm text-white/75">Te quedan 5 mensajes restantes</p>
        </div>
        <div className="animate-pulse-glow rounded-full border border-gold/40 bg-black/30 px-3 py-2 text-xs uppercase tracking-[0.3em] text-gold">
          VIP
        </div>
      </div>

      <div className="mt-5 space-y-4 rounded-[1.6rem] border border-white/10 bg-[#090909]/90 p-4">
        {messages.map((message) => {
          const mine = message.sender === 'me';

          return (
            <div
              key={message.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-[1.4rem] px-4 py-3 text-sm leading-6 shadow-lg ${
                  mine
                    ? 'rounded-br-md bg-gold text-black'
                    : 'rounded-bl-md border border-white/10 bg-white/5 text-white/80'
                }`}
              >
                <p>{message.text}</p>
                <p
                  className={`mt-2 text-[11px] ${
                    mine ? 'text-black/60' : 'text-white/40'
                  }`}
                >
                  {message.time}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-gold/40 hover:text-gold"
          aria-label="Grabar audio"
        >
          <Mic size={18} />
        </button>
        <input
          type="text"
          placeholder="Escribe un mensaje selecto..."
          className="h-10 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
        />
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-black transition hover:brightness-110"
          aria-label="Enviar mensaje"
        >
          <SendHorizontal size={18} />
        </button>
      </div>
    </section>
  );
}
