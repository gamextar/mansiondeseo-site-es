import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Sparkles, Eye, Lock, Heart } from 'lucide-react';

const STEPS = [
  {
    icon: Sparkles,
    title: 'Bienvenido a la Mansión',
    subtitle: 'Un espacio diseñado para quienes buscan experiencias exclusivas con discreción total.',
    visual: 'mansion',
  },
  {
    icon: Eye,
    title: 'Perfiles Verificados',
    subtitle: 'Cada perfil pasa por un proceso de verificación. Aquí solo encontrarás personas reales.',
    visual: 'profiles',
  },
  {
    icon: Lock,
    title: 'Privacidad Absoluta',
    subtitle: 'Tu identidad está protegida. Tú decides quién ve tu perfil y cuándo.',
    visual: 'privacy',
  },
  {
    icon: Heart,
    title: 'Conexiones Reales',
    subtitle: 'Encuentra parejas y personas afines en un ambiente de respeto y complicidad.',
    visual: 'connections',
  },
];

function StepVisual({ visual, step }) {
  const baseDelay = 0.3;

  if (visual === 'mansion') {
    return (
      <div className="relative w-64 h-64 mx-auto">
        {/* Central glow */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: baseDelay, duration: 0.8 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-mansion-crimson/20 to-mansion-gold/10 blur-2xl" />
        </motion.div>
        {/* Door icon */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', delay: baseDelay + 0.2, stiffness: 200 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-28 h-36 rounded-t-[50%] border-2 border-mansion-gold/40 bg-mansion-elevated/50 flex items-end justify-center pb-4">
            <div className="w-3 h-3 rounded-full bg-mansion-gold" />
          </div>
        </motion.div>
        {/* Floating stars */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6, y: [-5, 5, -5] }}
            transition={{
              scale: { delay: baseDelay + 0.4 + i * 0.1 },
              y: { duration: 3, repeat: Infinity, delay: i * 0.3 },
            }}
            className="absolute w-1.5 h-1.5 rounded-full bg-mansion-gold"
            style={{
              left: `${20 + i * 12}%`,
              top: `${15 + (i % 3) * 25}%`,
            }}
          />
        ))}
      </div>
    );
  }

  if (visual === 'profiles') {
    return (
      <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: (i - 1) * 20, scale: 0.8 }}
            animate={{ opacity: 1, x: (i - 1) * 55, scale: i === 1 ? 1 : 0.85 }}
            transition={{ delay: baseDelay + i * 0.15, type: 'spring', stiffness: 200 }}
            className={`absolute w-24 h-32 rounded-xl overflow-hidden border-2 ${
              i === 1 ? 'border-mansion-gold/50 z-10' : 'border-mansion-border/30'
            }`}
          >
            <img
              src={`https://picsum.photos/seed/onboard${i}/200/300`}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            {i === 1 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: baseDelay + 0.6 }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-400 border-2 border-black/50"
              />
            )}
          </motion.div>
        ))}
      </div>
    );
  }

  if (visual === 'privacy') {
    return (
      <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: baseDelay, type: 'spring', stiffness: 150 }}
          className="relative"
        >
          {/* Shield */}
          <div className="w-28 h-32 relative">
            <svg viewBox="0 0 100 120" className="w-full h-full">
              <defs>
                <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#D4183D" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <path
                d="M50 5 L95 25 L90 80 L50 115 L10 80 L5 25 Z"
                fill="url(#shieldGrad)"
                stroke="#C9A84C"
                strokeWidth="1.5"
                strokeOpacity="0.5"
              />
            </svg>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: baseDelay + 0.4 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Lock className="w-10 h-10 text-mansion-gold" />
            </motion.div>
          </div>
          {/* Pulse rings */}
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1 + i * 0.3, opacity: [0, 0.3, 0] }}
              transition={{ delay: baseDelay + 0.5 + i * 0.2, duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full border border-mansion-gold/20"
              style={{ margin: `-${i * 15}px` }}
            />
          ))}
        </motion.div>
      </div>
    );
  }

  // connections
  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
      {/* Center heart */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ delay: baseDelay, duration: 0.6 }}
        className="relative z-10"
      >
        <Heart className="w-16 h-16 text-mansion-crimson fill-mansion-crimson" />
      </motion.div>
      {/* Orbiting dots */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 80;
        return (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: [0.3, 0.8, 0.3],
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius,
            }}
            transition={{
              scale: { delay: baseDelay + 0.3 + i * 0.08 },
              opacity: { duration: 2, repeat: Infinity, delay: i * 0.2 },
            }}
            className={`absolute w-3 h-3 rounded-full ${
              i % 3 === 0 ? 'bg-mansion-gold' : i % 3 === 1 ? 'bg-mansion-crimson' : 'bg-purple-400'
            }`}
          />
        );
      })}
    </div>
  );
}

export default function WelcomePage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      navigate('/registro');
    } else {
      setStep((s) => s + 1);
    }
  };

  const skip = () => navigate('/registro');

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col relative overflow-hidden">
      {/* Background ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-mansion-crimson/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-mansion-gold/5 rounded-full blur-3xl" />
      </div>

      {/* Skip button */}
      <div className="relative z-10 flex justify-end p-4 pt-6">
        <button
          onClick={skip}
          className="text-text-muted text-sm hover:text-mansion-gold transition-colors"
        >
          Saltar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.35 }}
            className="text-center w-full max-w-sm"
          >
            {/* Visual */}
            <StepVisual visual={current.visual} step={step} />

            {/* Text */}
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-display text-2xl md:text-3xl font-bold text-text-primary mt-8 mb-3"
            >
              {current.title}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-text-muted text-sm leading-relaxed max-w-xs mx-auto"
            >
              {current.subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 px-6 pb-10">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === step ? 24 : 8,
                opacity: i === step ? 1 : 0.3,
              }}
              className={`h-2 rounded-full transition-colors ${
                i <= step ? 'bg-mansion-gold' : 'bg-mansion-border'
              }`}
            />
          ))}
        </div>

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={next}
          className="btn-gold w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2"
        >
          {isLast ? 'Crear mi Perfil' : 'Continuar'}
          <ChevronRight className="w-5 h-5" />
        </motion.button>

        {step === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-text-dim text-xs mt-4"
          >
            ¿Ya tienes cuenta?{' '}
            <button onClick={() => navigate('/login')} className="text-mansion-gold hover:underline">
              Iniciar sesión
            </button>
          </motion.p>
        )}
      </div>
    </div>
  );
}
