import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  { label: '😊', emojis: ['😀','😂','🥰','😍','😘','😊','🥵','😈','😏','🤭','😮','🥺','😭','😤','🤤','😜','🫣','🤪','😴','🫠'] },
  { label: '👋', emojis: ['👋','🤝','👀','💪','🫦','🙏','👏','🤞','✌️','🫶','🤙','👆','🫰','💅','🤌','👅','💃','🕺','🧎','🫂'] },
  { label: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💗','💘','💝','💖','💕','💓','💞','❤️‍🔥','💔','🫀','💋','💦'] },
  { label: '🎉', emojis: ['🔥','🎉','🍆','🍑','🌹','🥂','💎','👑','🔑','💌','📸','🎶','⛓️','🍫','🛏️','🕯️','🧊','💣','🎭','🪩'] },
];

export default function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);
  const [activeTab, setActiveTab] = useState(0);
  const [popping, setPopping] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  const handleSelect = (emoji) => {
    setPopping(emoji);
    onSelect(emoji);
    setTimeout(() => setPopping(null), 400);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full mb-2 right-0 z-[100] bg-mansion-card border border-mansion-border/40 rounded-2xl shadow-2xl w-72 overflow-hidden"
    >
      {/* Category tabs */}
      <div className="flex border-b border-mansion-border/30 px-1 pt-1">
        {CATEGORIES.map((cat, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`flex-1 py-1.5 text-lg rounded-t-lg transition-colors ${
              activeTab === i ? 'bg-mansion-elevated/60' : 'hover:bg-mansion-elevated/30'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="p-2 h-44 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-8 gap-0.5">
          {CATEGORIES[activeTab].emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSelect(emoji)}
              className="relative w-8 h-8 flex items-center justify-center text-xl rounded-lg hover:bg-mansion-elevated active:scale-125 transition-all duration-150"
            >
              <span className={popping === emoji ? 'animate-bounce' : 'hover:scale-110 transition-transform'}>
                {emoji}
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
