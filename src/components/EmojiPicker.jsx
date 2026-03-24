import { useEffect, useRef } from 'react';

const EMOJIS = [
  // Caritas
  '😀','😂','🥰','😍','😘','😊','🥵','😈','🔥','💋',
  '😏','🤭','😮','😯','🥺','😭','😤','😡','🤤','😜',
  // Gestos
  '👋','🤝','👀','💪','🫦','🙏','👏','🤞','✌️','🫶',
  // Corazones
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💗','💦',
  // Objetos / signos
  '🎉','🍆','🍑','🌹','🥂','💎','👑','🔑','💌','📸',
];

export default function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

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

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 right-0 z-50 bg-mansion-card border border-mansion-border/40 rounded-2xl shadow-xl p-3 w-64"
    >
      <div className="grid grid-cols-8 gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center text-xl rounded-lg hover:bg-mansion-elevated transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
