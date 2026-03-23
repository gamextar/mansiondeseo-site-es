import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Background ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-mansion-crimson/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-mansion-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-sm w-full">
        {/* Mansion door visual */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150, delay: 0.2 }}
          className="relative w-48 h-56 mx-auto mb-10"
        >
          {/* Glow behind */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-mansion-crimson/20 to-mansion-gold/10 blur-2xl" />
          </div>

          {/* Door */}
          <motion.div
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.4 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-28 h-36 rounded-t-[50%] border-2 border-mansion-gold/40 bg-mansion-elevated/50 flex items-end justify-center pb-4 relative">
              <div className="w-3 h-3 rounded-full bg-mansion-gold" />
            </div>
          </motion.div>

          {/* Floating gold particles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.6, y: [-5, 5, -5] }}
              transition={{
                scale: { delay: 0.6 + i * 0.08 },
                y: { duration: 3, repeat: Infinity, delay: i * 0.3 },
              }}
              className="absolute w-1.5 h-1.5 rounded-full bg-mansion-gold"
              style={{
                left: `${15 + i * 10}%`,
                top: `${10 + (i % 4) * 22}%`,
              }}
            />
          ))}
        </motion.div>

        {/* Text */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="font-display text-3xl md:text-4xl font-bold text-gradient-gold mb-3"
        >
          Mansión Deseo
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-text-muted text-sm leading-relaxed mb-10 max-w-xs mx-auto"
        >
          Un espacio exclusivo para quienes buscan experiencias únicas con discreción total,
          perfiles verificados y conexiones reales.
        </motion.p>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/registro')}
          className="btn-gold w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2"
        >
          Comenzar
          <ChevronRight className="w-5 h-5" />
        </motion.button>

        {/* Login link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center mt-6"
        >
          <span className="text-text-dim text-sm">¿Ya tienes cuenta? </span>
          <button
            onClick={() => navigate('/login')}
            className="text-mansion-gold text-sm font-medium hover:underline"
          >
            Iniciar sesión
          </button>
        </motion.p>

        {/* Features strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center justify-center gap-6 mt-10 text-text-dim text-xs"
        >
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-mansion-gold" /> Verificados
          </span>
          <span>•</span>
          <span>Discreto</span>
          <span>•</span>
          <span>Exclusivo</span>
        </motion.div>
      </div>
    </div>
  );
}
