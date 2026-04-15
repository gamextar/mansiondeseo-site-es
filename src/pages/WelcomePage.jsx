import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useSeoMeta } from '../lib/seo';
import { getToken, hasEverLoggedIn } from '../lib/api';

export default function WelcomePage() {
  const navigate = useNavigate();
  const hasToken = !!getToken();
  const returningUser = hasEverLoggedIn();
  useSeoMeta({
    title: 'Mansión Deseo | Acceso privado para adultos',
    description: 'Comunidad privada y selecta para adultos registrados, pensada para parejas y usuarios solos que valoran perfiles verificados y acceso discreto.',
    canonical: 'https://mansiondeseo.com/bienvenida',
  });

  if (hasToken) {
    return <Navigate to="/" replace />;
  }

  if (returningUser) {
    return <Navigate to="/login" replace />;
  }

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
        <h1 className="fade-in-up fade-delay-500 font-display text-3xl md:text-4xl font-bold text-gradient-gold mb-3">
          Mansión Deseo
        </h1>

        <p className="fade-in-up fade-delay-600 text-text-muted text-sm leading-relaxed mb-10 max-w-xs mx-auto">
          Un espacio selecto para quienes buscan experiencias únicas con discreción total,
          perfiles verificados y conexiones reales entre parejas y usuarios solos.
        </p>

        <div className="fade-in-up fade-delay-650 grid grid-cols-2 gap-2 mb-8 text-left">
          <Link to="/parejas" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-text-primary hover:border-mansion-gold/30 hover:text-mansion-gold transition-colors">
            Parejas
          </Link>
          <Link to="/swingers" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-text-primary hover:border-mansion-gold/30 hover:text-mansion-gold transition-colors">
            Swingers
          </Link>
          <Link to="/mujeres" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-text-primary hover:border-mansion-gold/30 hover:text-mansion-gold transition-colors">
            Mujeres
          </Link>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/registro')}
          className="fade-in-up fade-delay-700 btn-gold w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2 active:scale-[0.97]"
        >
          Crear acceso
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Login link */}
        <p className="fade-in-up fade-delay-900 text-center mt-6">
          <span className="text-text-dim text-sm">¿Ya tienes cuenta? </span>
          <button
            onClick={() => navigate('/login')}
            className="text-mansion-gold text-sm font-medium hover:underline"
          >
            Acceder
          </button>
        </p>

        {/* Features strip */}
        <div className="fade-in-up fade-delay-900 flex items-center justify-center gap-6 mt-10 text-text-dim text-xs">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-mansion-gold" /> Verificados
          </span>
          <span>•</span>
          <span>Privado</span>
          <span>•</span>
          <span>Selecto</span>
        </div>
      </div>
    </div>
  );
}
