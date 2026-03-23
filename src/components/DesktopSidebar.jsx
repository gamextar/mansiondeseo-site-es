import { NavLink, Link, useLocation } from 'react-router-dom';
import { Home, Search, MessageCircle, User, Crown, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUnreadMessages } from '../hooks/useUnreadMessages';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/explorar', icon: Search, label: 'Explorar' },
  { to: '/mensajes', icon: MessageCircle, label: 'Mensajes' },
  { to: '/perfil', icon: User, label: 'Mi Perfil' },
];

export default function DesktopSidebar() {
  const location = useLocation();
  const { unreadCount } = useUnreadMessages();

  // Hide on landing/onboarding/register/login
  const hiddenPaths = ['/bienvenida', '/registro', '/login'];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 xl:w-72 z-40 flex-col bg-mansion-card/50 border-r border-mansion-border/30 backdrop-blur-xl">
      {/* Logo */}
      <Link to="/" reloadDocument className="px-6 h-16 flex items-center gap-3 border-b border-mansion-border/20 hover:opacity-80 transition-opacity">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
          <span className="font-display text-white text-sm font-bold">M</span>
        </div>
        <span className="font-display text-xl font-semibold text-gradient-gold">
          Mansión Deseo
        </span>
      </Link>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive =
            to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to);

          return (
            <NavLink
              key={to}
              to={to}
              className="relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-mansion-gold/10 border border-mansion-gold/20 rounded-xl"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <div className="relative z-10 flex items-center gap-3 w-full">
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-mansion-gold' : 'text-text-muted group-hover:text-text-primary'
                    }`}
                  />
                  {to === '/mensajes' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full bg-mansion-crimson text-white text-[9px] font-bold flex items-center justify-center px-1">
                      {unreadCount}
                    </span>
                  )}
                </div>

                <span
                  className={`text-sm transition-colors ${
                    isActive ? 'text-mansion-gold font-semibold' : 'text-text-muted group-hover:text-text-primary'
                  }`}
                >
                  {label}
                </span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-2">
        {/* VIP banner */}
        <div className="mx-1 p-4 rounded-2xl bg-gradient-to-br from-mansion-gold/10 to-mansion-gold/5 border border-mansion-gold/20">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-mansion-gold" />
            <span className="text-xs font-semibold text-mansion-gold">Mansión VIP</span>
          </div>
          <p className="text-text-dim text-[11px] mb-3 leading-relaxed">
            Mensajes ilimitados y perfiles sin blur
          </p>
          <button className="btn-gold w-full py-2 rounded-lg text-xs">
            Desbloquear
          </button>
        </div>

        {/* Settings */}
        <NavLink
          to="/perfil"
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-text-dim hover:text-text-muted transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="text-xs">Configuración</span>
        </NavLink>
      </div>
    </aside>
  );
}
