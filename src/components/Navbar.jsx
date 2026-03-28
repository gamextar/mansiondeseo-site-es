import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../App';

// Coin icon as inline SVG
const CoinIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#C9A84C" stroke="#A88A3D" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="7" fill="none" stroke="#A88A3D" strokeWidth="0.75" />
    <text x="12" y="16" textAnchor="middle" fill="#8B7332" fontSize="10" fontWeight="bold" fontFamily="serif">$</text>
  </svg>
);

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 lg:left-64 xl:left-72"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-10 flex items-center justify-between">
        {/* Logo — hidden on desktop (sidebar has its own) */}
        <Link to="/" reloadDocument className="flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
            <span className="font-display text-white text-sm font-bold">M</span>
          </div>
          <span className="font-display text-base font-semibold text-gradient-gold hidden sm:inline">
            Mansión Deseo
          </span>
          <span className="font-display text-base font-semibold text-gradient-gold sm:hidden">
            Mansión
          </span>
        </Link>
        {/* Desktop left spacer */}
        <div className="hidden lg:block" />

        {/* Coins pill */}
        <Link
          to="/monedas"
          className="flex items-center gap-2.5 h-11 px-5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 hover:bg-black/40 transition-all"
        >
          <CoinIcon className="w-7 h-7" />
          <span className="text-xl font-bold text-mansion-gold tabular-nums">{user?.coins ?? 0}</span>
        </Link>
      </div>
    </motion.header>
  );
}
