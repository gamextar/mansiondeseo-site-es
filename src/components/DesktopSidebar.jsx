import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Film, MessageCircle, User, Crown, Settings, Camera, Trophy, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useState } from 'react';
import { peekOwnProfileDashboard } from '../lib/api';
import { useAuth } from '../lib/authContext';
import AvatarImg from './AvatarImg';

const HOME_FEED_FOCUS_EVENT = 'mansion-home-feed-focus';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Justo ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/videos', icon: Film, label: 'Videos' },
  { to: '/ranking', icon: Trophy, label: 'Ranking' },
  { to: '/seguidores', icon: Heart, label: 'Seguidores' },
  { to: '/mensajes', icon: MessageCircle, label: 'Mensajes' },
  { to: '/perfil', icon: User, label: 'Mi Perfil' },
];

export default function DesktopSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useUnreadMessages();
  const [visitors] = useState(() => peekOwnProfileDashboard()?.visitors || []);
  const { user, siteSettings } = useAuth();
  const sidebarAvatarSize = Math.max(72, Math.min(220, Number(siteSettings?.sidebarAvatarSize ?? 154)));
  const sidebarProfileWidth = Math.round(sidebarAvatarSize * 1.03);
  const sidebarProfileHeight = Math.round(sidebarAvatarSize * 1.22);
  const sidebarPortraitRadius = `${Math.max(28, Math.round(sidebarProfileWidth * 0.18))}px ${Math.max(30, Math.round(sidebarProfileWidth * 0.2))}px ${Math.max(22, Math.round(sidebarProfileWidth * 0.16))}px ${Math.max(46, Math.round(sidebarProfileWidth * 0.3))}px`;

  // Hide on landing/onboarding/register/login
  const hiddenPaths = ['/bienvenida', '/registro', '/login'];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 xl:w-72 z-40 flex-col bg-mansion-card/50 border-r border-mansion-border/30 backdrop-blur-xl">
      {/* Logo */}
      <Link to="/" className="px-6 h-16 flex items-center gap-3 border-b border-mansion-border/20 hover:opacity-80 transition-opacity">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
          <span className="font-display text-white text-sm font-bold">M</span>
        </div>
        <span className="font-display text-xl font-semibold text-gradient-gold">
          Mansión Deseo
        </span>
      </Link>

      {/* Profile avatar + name */}
      {user && (
        <Link to="/perfil" className="flex flex-col items-center py-6 border-b border-mansion-border/20 hover:opacity-90 transition-opacity">
          <div className="relative shrink-0 pl-3 pt-2">
            <div
              className="pointer-events-none absolute left-0 top-6 z-0 border border-mansion-gold/24 bg-[linear-gradient(155deg,rgba(255,234,188,0.18),rgba(163,24,62,0.2))] shadow-[0_20px_38px_rgba(6,6,12,0.12)]"
              style={{
                width: Math.round(sidebarProfileWidth * 0.82),
                height: Math.round(sidebarProfileHeight * 0.88),
                borderRadius: '30px 34px 24px 42px',
                transform: 'rotate(-7deg)',
              }}
            />
            <div
              className="pointer-events-none absolute -right-2 bottom-2 z-0 border border-white/8 bg-[linear-gradient(165deg,rgba(255,255,255,0.05),rgba(30,24,36,0.22))] shadow-[0_16px_30px_rgba(6,6,12,0.12)]"
              style={{
                width: Math.round(sidebarProfileWidth * 0.72),
                height: Math.round(sidebarProfileHeight * 0.78),
                borderRadius: '28px 18px 34px 22px',
                transform: 'rotate(8deg)',
              }}
            />
            <div className="pointer-events-none absolute -right-5 top-2 z-0 h-16 w-16 rounded-full bg-mansion-crimson/18 blur-2xl" />
            <div className="pointer-events-none absolute -left-4 bottom-6 z-0 h-20 w-20 rounded-full bg-mansion-gold/12 blur-2xl" />
            <div
              className="relative z-10 overflow-hidden shadow-[0_30px_46px_rgba(6,6,12,0.26)]"
              style={{
                width: sidebarProfileWidth,
                height: sidebarProfileHeight,
                borderRadius: sidebarPortraitRadius,
              }}
            >
              <div className="pointer-events-none absolute inset-x-8 top-0.5 z-20 h-px bg-white/38" />
              <div className="pointer-events-none absolute left-4 top-4 z-20 h-10 w-10 rounded-tl-[18px] border-l border-t border-[#f3ddaa]/45" />
              <div className="pointer-events-none absolute bottom-4 right-4 z-20 h-12 w-12 rounded-br-[18px] border-b border-r border-white/22" />
              <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),transparent_20%,transparent_64%,rgba(0,0,0,0.3))]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-black/65 via-black/12 to-transparent" />
              <div className="pointer-events-none absolute -right-10 top-8 z-20 h-20 w-24 rotate-12 bg-white/12 blur-2xl" />
              <div className="pointer-events-none absolute left-6 top-5 z-20 text-[9px] font-semibold uppercase tracking-[0.34em] text-[#f3ddaa]/85">
                Muse
              </div>
              <div className="pointer-events-none absolute left-6 bottom-5 z-20 text-[10px] font-medium uppercase tracking-[0.24em] text-white/72">
                Private Edit
              </div>
              <div className="pointer-events-none absolute right-5 top-10 z-20 h-24 w-px bg-gradient-to-b from-white/0 via-white/28 to-white/0" />
              {user.avatar_url ? (
                <AvatarImg src={user.avatar_url} crop={user.avatar_crop} alt={user.username} className="h-full w-full" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-mansion-elevated text-text-dim">
                  <User className="w-8 h-8" />
                </div>
              )}
              {user.has_active_story && (
                <span className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-sm bg-black/34 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#f7dfaa] backdrop-blur-sm">
                  Story
                </span>
              )}
            </div>
          </div>
          <p className="mt-3 text-base font-semibold text-text-primary truncate max-w-[80%] text-center">{user.username || user.name}</p>
        </Link>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive =
            to === '/' || to === '/perfil'
              ? location.pathname === to
              : to === '/seguidores'
                ? location.pathname.startsWith('/seguidores') || location.pathname.startsWith('/favoritos')
              : location.pathname.startsWith(to);

          return (
            <NavLink
              key={to}
              to={to}
              onClick={() => {
                if (to === '/' && location.pathname === '/') {
                  window.dispatchEvent(new CustomEvent(HOME_FEED_FOCUS_EVENT));
                }
              }}
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

      {/* Recent visitors */}
      {visitors.length > 0 && (
        <div className="px-3 py-3 border-t border-mansion-border/20">
          <p className="px-3 text-[10px] uppercase tracking-wider text-text-dim mb-2">Me visitaron</p>
          <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
            {visitors.slice(0, 5).map((v) => (
              <button
                key={v.id}
                onClick={() => navigate(`/perfiles/${v.id}`, { state: { preview: { id: v.id, name: v.name, age: v.age, city: v.city, province: v.province, locality: v.locality, role: v.role, photos: [], avatar_url: v.avatar_url, avatar_crop: v.avatar_crop || null, online: v.online, premium: v.premium } } })}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-mansion-elevated/50 transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-mansion-elevated overflow-hidden flex-shrink-0">
                  {v.avatar_url ? (
                    <AvatarImg src={v.avatar_url} crop={v.avatar_crop} alt={v.name} className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-dim">
                      <Camera className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-medium text-text-muted group-hover:text-text-primary truncate">{v.name}</p>
                  <p className="text-[10px] text-text-dim truncate">{timeAgo(v.visited_at)}</p>
                </div>
                {v.online && (
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom section */}
      {user?.is_admin && (
        <div className="px-3 pb-4 space-y-2">
          {/* Settings (admin only) */}
          <NavLink
            to="/admin"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-text-dim hover:text-text-muted transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-xs">Admin Panel</span>
          </NavLink>
        </div>
      )}
    </aside>
  );
}
