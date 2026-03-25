import { Link, useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
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
  const isChat = location.pathname.startsWith('/mensajes');
  const { unreadCount } = useUnreadMessages();
  const { user } = useAuth();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 safe-top lg:left-64 xl:left-72"
    >
      <div className="glass border-b border-mansion-border/30">
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
          <div className="flex items-center gap-1">
            {/* Coins */}
            <Link
              to="/monedas"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-mansion-gold/10 border border-mansion-gold/20 hover:bg-mansion-gold/20 transition-all mr-1"
            >
              <CoinIcon className="w-4 h-4" />
              <span className="text-xs font-bold text-mansion-gold tabular-nums">{user?.coins ?? 0}</span>
            </Link>

            {/* Messages */}
            <Link
              to="/mensajes"
              className={`relative w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center transition-all ${
                isChat
                  ? 'text-mansion-gold bg-mansion-gold/10'
                  : 'text-text-muted hover:text-mansion-gold hover:bg-mansion-elevated/50'
              }`}
            >
              <MessageCircle className="w-5 h-5 lg:w-7 lg:h-7" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-mansion-crimson text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </Link>

            {/* Avatar */}
            <Link to="/perfil" className="ml-1">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-mansion-gold to-mansion-gold-light p-[2px]">
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
