import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Film, MessageCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUnreadMessages } from '../hooks/useUnreadMessages';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/videos', icon: Film, label: 'Videos' },
  { to: '/mensajes', icon: MessageCircle, label: 'Mensajes' },
  { to: '/perfil', icon: User, label: 'Perfil' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigateTo = useNavigate();
  const { unreadCount } = useUnreadMessages();

  // Hide on landing/onboarding/register/login
  const hiddenPaths = ['/bienvenida', '/registro', '/login'];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom lg:hidden">
      <div className="glass border-t border-mansion-border/30">
        <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const isActive =
              to === '/' || to === '/perfil'
                ? location.pathname === to
                : location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                onClick={(e) => {
                  if (to === '/perfil' && location.pathname !== '/perfil') {
                    e.preventDefault();
                    navigateTo('/perfil');
                  }
                }}
                className="relative flex flex-col items-center justify-center w-16 h-full group"
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomnav-indicator"
                    className="absolute -top-px inset-x-0 mx-auto w-8 h-[2px] bg-mansion-gold rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

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
                  className={`text-[10px] mt-1 transition-colors ${
                    isActive ? 'text-mansion-gold font-medium' : 'text-text-dim'
                  }`}
                >
                  {label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
