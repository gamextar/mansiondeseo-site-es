import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const FILTERS = [
  { id: 'all', label: 'Todos', emoji: '✨' },
  { id: 'swinger', label: 'Swinger', emoji: '🔄' },
  { id: 'trios', label: 'Tríos', emoji: '🔥' },
  { id: 'cuckold', label: 'Cuckold', emoji: '👀' },
  { id: 'fetiche', label: 'Fetiche', emoji: '⛓️' },
  { id: 'pareja', label: 'Parejas', emoji: '💑' },
  { id: 'mujer', label: 'Mujeres', emoji: '👩' },
  { id: 'hombre', label: 'Hombres', emoji: '👨' },
];

export default function FilterBar({ activeFilter, onFilterChange }) {
  const scrollRef = useRef(null);

  return (
    <div className="relative">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-mansion-base to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-mansion-base to-transparent z-10 pointer-events-none" />

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-2 lg:px-8 py-3"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <motion.button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              whileTap={{ scale: 0.95 }}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                isActive
                  ? 'bg-mansion-gold/15 text-mansion-gold border border-mansion-gold/40'
                  : 'bg-mansion-card border border-mansion-border/50 text-text-muted hover:text-text-primary hover:border-mansion-border'
              }`}
            >
              <span className="text-xs">{filter.emoji}</span>
              <span>{filter.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
