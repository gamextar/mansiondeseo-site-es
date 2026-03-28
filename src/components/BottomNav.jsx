import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Film, MessageCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useAuth } from '../App';

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
  const { siteSettings } = useAuth();

  const bottomPadding = siteSettings?.navBottomPadding ?? 24;
  const sidePadding = siteSettings?.navSidePadding ?? 16;
  const navHeight = siteSettings?.navHeight ?? 56;
  const navOpacity = siteSettings?.navOpacity ?? 40;
  const bgColor = `rgba(0,0,0,${(navOpacity / 100).toFixed(2)})`;

  // Hide on landing/onboarding/register/login
  const hiddenPaths = ['/bienvenida', '/registro', '/login'];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex justify-center pointer-events-none"
      style={{
        paddingBottom: `calc(${bottomPadding}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: sidePadding,
        paddingRight: sidePadding,
      }}
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-[2rem] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]" style={{ backgroundColor: bgColor }}>
        <div className="flex items-center justify-around px-3" style={{ height: navHeight }}>
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
                className="relative flex flex-col items-center justify-center w-14 h-full group"
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomnav-indicator"
                    className="absolute inset-0 mx-auto rounded-2xl bg-white/[0.08]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <div className="relative z-10">
                  <Icon
                    className={`w-[22px] h-[22px] transition-colors ${
                      isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'
                    }`}
                  />
                  {to === '/mensajes' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] rounded-full bg-mansion-crimson text-white text-[9px] font-bold flex items-center justify-center px-1">
                      {unreadCount}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[9px] mt-0.5 transition-colors relative z-10 ${
                    isActive ? 'text-white font-medium' : 'text-white/40'
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
