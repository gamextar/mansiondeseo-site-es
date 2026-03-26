import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../App';

// Fallback coin icon as inline SVG
const DefaultCoinIcon = ({ size = 18 }) => (
  <svg style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#C9A84C" stroke="#A88A3D" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="7" fill="none" stroke="#A88A3D" strokeWidth="0.75" />
    <text x="12" y="16" textAnchor="middle" fill="#8B7332" fontSize="10" fontWeight="bold" fontFamily="serif">$</text>
  </svg>
);

export default function Navbar() {
  const { user, siteSettings } = useAuth();
  const coinSize = siteSettings?.coinIconSize || 18;
  const coinIconUrl = siteSettings?.coinIconUrl || '';

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 safe-top lg:left-64 xl:left-72"
    >
      <div className="bg-transparent lg:glass lg:border-b lg:border-mansion-border/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo — hidden on desktop (sidebar has its own) */}
          <Link to="/" reloadDocument className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
              <span className="font-display text-white text-sm font-bold">M</span>
            </div>
            <span className="font-display text-lg font-semibold text-gradient-gold hidden sm:inline">
              Mansión Deseo
            </span>
            <span className="font-display text-lg font-semibold text-gradient-gold sm:hidden">
              Mansión
            </span>
          </Link>
          {/* Desktop left spacer when logo hidden */}
          <div className="hidden lg:block" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Coins */}
            <Link
              to="/monedas"
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              {coinIconUrl
                ? <img src={coinIconUrl} alt="monedas" style={{ width: coinSize, height: coinSize }} className="object-contain" />
                : <DefaultCoinIcon size={coinSize} />
              }
              <span className="text-sm font-bold text-mansion-gold tabular-nums">{user?.coins ?? 0}</span>
            </Link>

            {/* Avatar */}
            <Link to="/perfil">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-mansion-gold to-mansion-gold-light p-[2px]">
                <div className="w-full h-full rounded-full bg-mansion-card overflow-hidden flex items-center justify-center">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-mansion-gold text-xs font-bold">TÚ</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
