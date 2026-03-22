export function FilterChips({ label, options, value, onChange }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.34em] text-white/40">
          {label}
        </h2>
        <button
          type="button"
          className="text-xs uppercase tracking-[0.28em] text-gold/75 transition hover:text-gold"
          onClick={() => onChange('Todos')}
        >
          Limpiar
        </button>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {options.map((option) => {
          const active = option === value;

          return (
            <button
              type="button"
              key={option}
              onClick={() => onChange(option)}
              className={`chip whitespace-nowrap ${active ? 'chip-active' : 'bg-white/5 hover:border-white/20 hover:text-white'}`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}
