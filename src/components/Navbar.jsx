import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { getFavorites, getToken } from '../lib/api';

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
  const [favCount, setFavCount] = useState(() => {
    try { return parseInt(sessionStorage.getItem('mansion_fav_count') || '0', 10); } catch { return 0; }
  });

  useEffect(() => {
    if (!getToken()) return;
    getFavorites()
      .then(data => {
        const count = (data.profiles || []).length;
        setFavCount(count);
        try { sessionStorage.setItem('mansion_fav_count', String(count)); } catch {}
      })
      .catch(() => {});
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 safe-top lg:left-64 xl:left-72"
    >
      <div className="bg-transparent lg:glass lg:border-b lg:border-mansion-border/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo — hidden on desktop (sidebar has its own) */}
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
              <span className="font-display text-white text-base font-bold">M</span>
            </div>
            <span className="font-display text-xl font-semibold text-gradient-gold hidden sm:inline">
              Mansión Deseo
            </span>
            <span className="font-display text-xl font-semibold text-gradient-gold sm:hidden">
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

            {/* Favorites */}
            <Link
              to="/favoritos"
              className="relative flex items-center justify-center w-11 h-11 rounded-full bg-mansion-card hover:bg-mansion-elevated transition-colors"
            >
              <Heart className="w-5 h-5 text-mansion-crimson" />
              {favCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-mansion-crimson text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {favCount > 99 ? '99+' : favCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
