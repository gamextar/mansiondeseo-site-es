import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';

export default function AgeVerificationModal({ onVerify }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md px-4"
      >
        {/* Ambient particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-mansion-gold/20"
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 400),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
              }}
              animate={{
                y: [null, -100],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 4 + Math.random() * 4,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.1 }}
          className="relative w-full max-w-md"
        >
          {/* Glow effect behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-mansion-crimson/20 via-mansion-gold/20 to-mansion-crimson/20 rounded-3xl blur-xl" />

          <div className="relative glass-elevated rounded-3xl p-8 text-center overflow-hidden">
            {/* Top ornament line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[2px] bg-gradient-to-r from-transparent via-mansion-gold to-transparent" />

            {/* Shield icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.3, stiffness: 200 }}
              className="mx-auto w-20 h-20 rounded-full bg-mansion-crimson/10 border border-mansion-crimson/30 flex items-center justify-center mb-6"
            >
              <ShieldCheck className="w-10 h-10 text-mansion-crimson" />
            </motion.div>

            {/* Logo text */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="font-display text-3xl font-bold text-gradient-gold mb-2"
            >
              Mansión Deseo
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="font-display text-sm italic text-mansion-gold/60 mb-6"
            >
              Club Privado · Contenido Exclusivo
            </motion.p>

            {/* Divider */}
            <div className="w-16 h-px bg-mansion-border mx-auto mb-6" />

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-text-muted text-sm leading-relaxed mb-8"
            >
              Este sitio contiene contenido para adultos.
              <br />
              Debes ser mayor de <span className="text-text-primary font-semibold">18 años</span> para acceder.
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="space-y-3"
            >
              <button
                onClick={onVerify}
                className="btn-gold w-full text-lg py-4 rounded-2xl font-display font-semibold tracking-wide"
              >
                Soy mayor de 18 años
              </button>

              <a
                href="https://google.com"
                className="block w-full btn-ghost py-3 rounded-2xl text-sm text-center"
              >
                Salir de aquí
              </a>
            </motion.div>

            {/* Bottom ornament */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-[2px] bg-gradient-to-r from-transparent via-mansion-gold/40 to-transparent" />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
