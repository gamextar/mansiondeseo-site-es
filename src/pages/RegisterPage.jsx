import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Camera, Heart, MapPin, User } from 'lucide-react';

// ─── Step 1: ¿Quién Eres? ──────────────────────────────────────────
const ROLES = [
  {
    id: 'hombre',
    label: 'Hombre',
    color: 'from-blue-500 to-blue-700',
    border: 'border-blue-500/40',
    activeBg: 'bg-blue-500/15',
  },
  {
    id: 'mujer',
    label: 'Mujer',
    color: 'from-pink-500 to-pink-700',
    border: 'border-pink-500/40',
    activeBg: 'bg-pink-500/15',
  },
  {
    id: 'pareja',
    label: 'Pareja',
    color: 'from-purple-500 to-purple-700',
    border: 'border-purple-500/40',
    activeBg: 'bg-purple-500/15',
  },
];

function PersonIcon({ type, isActive }) {
  const baseClass = `transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100'}`;

  if (type === 'hombre') {
    return (
      <svg viewBox="0 0 80 120" className={`w-16 h-24 ${baseClass}`}>
        <motion.circle
          cx="40" cy="25" r="14"
          fill={isActive ? '#3B82F6' : '#555566'}
          initial={false}
          animate={{ r: isActive ? 16 : 14 }}
          transition={{ type: 'spring', stiffness: 300 }}
        />
        <motion.rect
          x="25" y="42" width="30" height="35" rx="6"
          fill={isActive ? '#3B82F6' : '#555566'}
          initial={false}
          animate={{ width: isActive ? 32 : 30, x: isActive ? 24 : 25 }}
        />
        <motion.rect x="25" y="78" width="12" height="28" rx="5" fill={isActive ? '#2563EB' : '#444455'} />
        <motion.rect x="43" y="78" width="12" height="28" rx="5" fill={isActive ? '#2563EB' : '#444455'} />
        {isActive && (
          <motion.circle
            cx="40" cy="25" r="20"
            fill="none" stroke="#3B82F6" strokeWidth="1"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </svg>
    );
  }

  if (type === 'mujer') {
    return (
      <svg viewBox="0 0 80 120" className={`w-16 h-24 ${baseClass}`}>
        <motion.circle
          cx="40" cy="25" r="14"
          fill={isActive ? '#EC4899' : '#555566'}
          initial={false}
          animate={{ r: isActive ? 16 : 14 }}
        />
        {/* Hair accent */}
        <motion.path
          d="M26 22 Q30 8 40 8 Q50 8 54 22"
          fill="none" stroke={isActive ? '#EC4899' : '#555566'} strokeWidth="3" strokeLinecap="round"
        />
        {/* Dress body */}
        <motion.path
          d="M28 42 L25 80 Q25 84 32 84 L48 84 Q55 84 55 80 L52 42 Q50 38 40 38 Q30 38 28 42 Z"
          fill={isActive ? '#EC4899' : '#555566'}
        />
        <motion.rect x="27" y="84" width="11" height="24" rx="5" fill={isActive ? '#DB2777' : '#444455'} />
        <motion.rect x="42" y="84" width="11" height="24" rx="5" fill={isActive ? '#DB2777' : '#444455'} />
        {isActive && (
          <motion.circle
            cx="40" cy="25" r="20"
            fill="none" stroke="#EC4899" strokeWidth="1"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </svg>
    );
  }

  // pareja
  return (
    <svg viewBox="0 0 120 120" className={`w-24 h-24 ${baseClass}`}>
      {/* Man */}
      <motion.circle cx="42" cy="25" r="12" fill={isActive ? '#8B5CF6' : '#555566'}
        animate={{ r: isActive ? 13 : 12 }} />
      <motion.rect x="30" y="40" width="24" height="30" rx="5"
        fill={isActive ? '#7C3AED' : '#555566'} />
      <rect x="30" y="72" width="10" height="22" rx="4" fill={isActive ? '#6D28D9' : '#444455'} />
      <rect x="44" y="72" width="10" height="22" rx="4" fill={isActive ? '#6D28D9' : '#444455'} />

      {/* Woman */}
      <motion.circle cx="78" cy="25" r="12" fill={isActive ? '#A78BFA' : '#555566'}
        animate={{ r: isActive ? 13 : 12 }} />
      <motion.path
        d="M66 40 L64 72 Q64 76 70 76 L86 76 Q92 76 92 72 L90 40 Q88 36 78 36 Q68 36 66 40 Z"
        fill={isActive ? '#A78BFA' : '#555566'}
      />
      <rect x="66" y="76" width="10" height="20" rx="4" fill={isActive ? '#7C3AED' : '#444455'} />
      <rect x="80" y="76" width="10" height="20" rx="4" fill={isActive ? '#7C3AED' : '#444455'} />

      {/* Heart between */}
      {isActive && (
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <text x="54" y="55" fontSize="16" textAnchor="middle" fill="#C9A84C">♥</text>
        </motion.g>
      )}
    </svg>
  );
}

function StepRole({ selected, onSelect }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Soy un...</h2>
      <p className="text-text-muted text-sm mb-8">Selecciona tu perfil</p>

      <div className="flex items-end justify-center gap-4">
        {ROLES.map((role) => {
          const isActive = selected === role.id;
          return (
            <motion.button
              key={role.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(role.id)}
              className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 border-2 ${
                isActive
                  ? `${role.activeBg} ${role.border}`
                  : 'border-mansion-border/30 bg-mansion-card/50 hover:border-mansion-border'
              }`}
            >
              <PersonIcon type={role.id} isActive={isActive} />
              <span className={`mt-3 font-medium text-sm ${isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                {role.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 2: ¿Qué Buscas? ──────────────────────────────────────────
function StepSeeking({ selected, onSelect }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Busco...</h2>
      <p className="text-text-muted text-sm mb-8">¿Qué tipo de conexión te interesa?</p>

      <div className="flex items-end justify-center gap-4">
        {ROLES.map((role) => {
          const isActive = selected === role.id;
          return (
            <motion.button
              key={role.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(role.id)}
              className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 border-2 ${
                isActive
                  ? `${role.activeBg} ${role.border}`
                  : 'border-mansion-border/30 bg-mansion-card/50 hover:border-mansion-border'
              }`}
            >
              <PersonIcon type={role.id} isActive={isActive} />
              <span className={`mt-3 font-medium text-sm ${isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                {role.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 3: Intereses ──────────────────────────────────────────────
const INTERESTS = [
  { id: 'swinger', label: 'Swinger', emoji: '🔄' },
  { id: 'trios', label: 'Tríos', emoji: '🔥' },
  { id: 'cuckold', label: 'Cuckold', emoji: '👀' },
  { id: 'fetiche', label: 'Fetiches', emoji: '⛓️' },
  { id: 'voyeur', label: 'Voyeur', emoji: '🕶️' },
  { id: 'bdsm', label: 'BDSM', emoji: '🖤' },
  { id: 'exhib', label: 'Exhibicionismo', emoji: '✨' },
  { id: 'roleplay', label: 'Roleplay', emoji: '🎭' },
];

function StepInterests({ selected, onToggle }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Mis intereses</h2>
      <p className="text-text-muted text-sm mb-8">Selecciona al menos 1</p>

      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        {INTERESTS.map((item) => {
          const isActive = selected.includes(item.id);
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onToggle(item.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                isActive
                  ? 'bg-mansion-gold/15 border-mansion-gold/40 text-mansion-gold'
                  : 'bg-mansion-card border-mansion-border/40 text-text-muted hover:border-mansion-border'
              }`}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 4: Info Básica ────────────────────────────────────────────
function StepBasicInfo({ data, onChange }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Casi listo</h2>
      <p className="text-text-muted text-sm mb-8">Cuéntanos un poco más sobre ti</p>

      <div className="space-y-4 max-w-xs mx-auto text-left">
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">Nombre (o alias)</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="Tu nombre en la Mansión"
            className="w-full"
          />
        </div>
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">Edad</label>
          <input
            type="number"
            value={data.age}
            onChange={(e) => onChange({ ...data, age: e.target.value })}
            placeholder="25"
            min="18"
            max="99"
            className="w-full"
          />
        </div>
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">Ciudad</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="text"
              value={data.city}
              onChange={(e) => onChange({ ...data, city: e.target.value })}
              placeholder="Madrid"
              className="w-full pl-10"
            />
          </div>
        </div>
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">Bio corta</label>
          <textarea
            value={data.bio}
            onChange={(e) => onChange({ ...data, bio: e.target.value })}
            placeholder="Cuéntanos qué te trae a la Mansión..."
            rows={3}
            className="w-full resize-none"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Foto ───────────────────────────────────────────────────
function StepPhoto() {
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Tu foto de perfil</h2>
      <p className="text-text-muted text-sm mb-8">Los perfiles con foto reciben 10x más mensajes</p>

      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-40 h-40 mx-auto rounded-full border-2 border-dashed border-mansion-gold/40 
                   bg-mansion-card flex flex-col items-center justify-center cursor-pointer
                   hover:border-mansion-gold/60 hover:bg-mansion-gold/5 transition-all"
      >
        <Camera className="w-8 h-8 text-mansion-gold mb-2" />
        <span className="text-text-muted text-xs">Subir foto</span>
      </motion.div>

      <p className="text-text-dim text-xs mt-6">
        Puedes subir tu foto más tarde desde tu perfil
      </p>
    </div>
  );
}

// ─── Main RegisterPage ──────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [iAm, setIAm] = useState(null);
  const [seeking, setSeeking] = useState(null);
  const [interests, setInterests] = useState([]);
  const [info, setInfo] = useState({ name: '', age: '', city: '', bio: '' });

  const totalSteps = 5;

  const toggleInterest = (id) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canNext = () => {
    if (step === 0) return !!iAm;
    if (step === 1) return !!seeking;
    if (step === 2) return interests.length > 0;
    if (step === 3) return info.name && info.age && info.city;
    return true;
  };

  const next = () => {
    if (step === totalSteps - 1) {
      navigate('/');
    } else {
      setStep((s) => s + 1);
    }
  };

  const prev = () => {
    if (step === 0) {
      navigate('/bienvenida');
    } else {
      setStep((s) => s - 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <StepRole selected={iAm} onSelect={setIAm} />;
      case 1: return <StepSeeking selected={seeking} onSelect={setSeeking} />;
      case 2: return <StepInterests selected={interests} onToggle={toggleInterest} />;
      case 3: return <StepBasicInfo data={info} onChange={setInfo} />;
      case 4: return <StepPhoto />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-72 h-72 bg-mansion-crimson/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-0 w-64 h-64 bg-mansion-gold/5 rounded-full blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between p-4 pt-6">
        <button onClick={prev} className="text-text-muted hover:text-text-primary transition-colors p-2">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-text-dim text-xs font-medium">
          {step + 1} / {totalSteps}
        </span>
        <div className="w-9" />
      </div>

      {/* Progress bar */}
      <div className="relative z-10 px-6 mb-6">
        <div className="h-1 bg-mansion-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-mansion-gold to-mansion-gold-light rounded-full"
            initial={false}
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div className="relative z-10 px-6 pb-10">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={next}
          disabled={!canNext()}
          className={`w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2 transition-all ${
            canNext()
              ? 'btn-gold'
              : 'bg-mansion-elevated text-text-dim cursor-not-allowed'
          }`}
        >
          {step === totalSteps - 1 ? 'Entrar a la Mansión' : 'Continuar'}
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
