import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Film, MessageCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useAuth } from '../lib/authContext';
import { warmVideoFeed } from '../lib/videoFeedWarmup';
import { useEffect, useRef, useState } from 'react';

const HOME_FEED_FOCUS_EVENT = 'mansion-home-feed-focus';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/videos', icon: Film, label: 'Videos' },
  { to: '/mensajes', icon: MessageCircle, label: 'Mensajes' },
  { to: '/perfil', icon: User, label: 'Perfil' },
];

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

// Read nav dimensions from sessionStorage once at module level so the
// initial render already has the correct values before bootstrap resolves.
function getInitialNavSettings() {
  try {
    const s = JSON.parse(sessionStorage.getItem('mansion_site_settings') || '{}');
    return {
      navHeight: Number(s.navHeight) || 71,
      navBottomPadding: s.navBottomPadding != null ? Number(s.navBottomPadding) : 24,
      navSidePadding: s.navSidePadding != null ? Number(s.navSidePadding) : 16,
      navOpacity: s.navOpacity != null ? Number(s.navOpacity) : 40,
      navBlur: s.navBlur != null ? Number(s.navBlur) : 24,
    };
  } catch {
    return { navHeight: 71, navBottomPadding: 24, navSidePadding: 16, navOpacity: 40, navBlur: 24 };
  }
}

function resetDocumentScrollToTop() {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  root.scrollTop = 0;
  if (body) body.scrollTop = 0;
  root.style.scrollBehavior = previousScrollBehavior;
}

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useUnreadMessages();
  const { user } = useAuth();
  const pendingNavResetRef = useRef(null);
  const [isStandaloneMobileApp, setIsStandaloneMobileApp] = useState(() => detectStandaloneMobile());

  // All nav dimensions are frozen at mount time from sessionStorage so the nav
  // never resizes/jumps when the bootstrap resolves and siteSettings updates.
  // Updated values take effect on next full page load (sessionStorage is saved
  // by bootstrap, so subsequent visits already have the correct values).
  const [dims] = useState(getInitialNavSettings);
  const { navHeight, navSidePadding: sidePadding, navOpacity, navBlur } = dims;
  const navExtraHeight = isStandaloneMobileApp ? 18 : 8;
  const effectiveNavHeight = navHeight + navExtraHeight;
  const bottomPaddingPx = isStandaloneMobileApp ? 0 : 6;
  const activeIndicatorSize = isStandaloneMobileApp ? 62 : 58;
  const outerSidePadding = isStandaloneMobileApp ? 12 : sidePadding;
  const navBottomNudgePx = isStandaloneMobileApp ? 0 : -6;
  const bgColor = `rgba(0,0,0,${(navOpacity / 100).toFixed(2)})`;
  const borderColor = `rgba(255,255,255,${(0.08 * navOpacity / 100).toFixed(3)})`;
  const shadowColor = `rgba(0,0,0,${(0.4 * navOpacity / 100).toFixed(3)})`;
  const blurAmount = navOpacity <= 0 ? '0px' : `${navBlur}px`;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia?.('(display-mode: standalone)');
    const evaluate = () => {
      const standalone = media?.matches || window.navigator.standalone === true;
      const ua = window.navigator.userAgent || '';
      const isMobile = /iphone|ipad|ipod|android/i.test(ua);
      setIsStandaloneMobileApp(Boolean(standalone && isMobile));
    };

    evaluate();

    if (!media) return undefined;
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', evaluate);
      return () => media.removeEventListener('change', evaluate);
    }

    media.addListener(evaluate);
    return () => media.removeListener(evaluate);
  }, []);

  useEffect(() => () => {
    if (!pendingNavResetRef.current || typeof window === 'undefined') return;
    if (pendingNavResetRef.current.rafId) window.cancelAnimationFrame(pendingNavResetRef.current.rafId);
    if (pendingNavResetRef.current.timeoutId) window.clearTimeout(pendingNavResetRef.current.timeoutId);
    pendingNavResetRef.current = null;
  }, []);

  const navigateAfterScrollReset = (to) => {
    if (typeof window === 'undefined') {
      navigate(to);
      return;
    }

    if (isStandaloneMobileApp) {
      resetDocumentScrollToTop();
      navigate(to);
      return;
    }

    if (pendingNavResetRef.current) {
      if (pendingNavResetRef.current.rafId) window.cancelAnimationFrame(pendingNavResetRef.current.rafId);
      if (pendingNavResetRef.current.timeoutId) window.clearTimeout(pendingNavResetRef.current.timeoutId);
      pendingNavResetRef.current = null;
    }

    let attempts = 0;
    const maxAttempts = 8;

    const finish = () => {
      if (pendingNavResetRef.current?.timeoutId) {
        window.clearTimeout(pendingNavResetRef.current.timeoutId);
      }
      pendingNavResetRef.current = null;
      navigate(to);
    };

    const tick = () => {
      resetDocumentScrollToTop();
      attempts += 1;
      const currentScrollY = Number(window.scrollY ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0) || 0;
      if (currentScrollY <= 1 || attempts >= maxAttempts) {
        finish();
        return;
      }
      pendingNavResetRef.current = {
        ...pendingNavResetRef.current,
        rafId: window.requestAnimationFrame(tick),
      };
    };

    pendingNavResetRef.current = {
      rafId: window.requestAnimationFrame(tick),
      timeoutId: window.setTimeout(finish, 180),
    };
  };

  // Hide on landing/onboarding/register/login
  const hiddenPaths = ['/bienvenida', '/registro', '/login'];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex justify-center pointer-events-none"
      style={{
        bottom: `${navBottomNudgePx}px`,
        paddingBottom: `max(${bottomPaddingPx}px, env(safe-area-inset-bottom, ${bottomPaddingPx}px))`,
        paddingLeft: outerSidePadding,
        paddingRight: outerSidePadding,
        isolation: 'isolate',
      }}
    >
      <div
        className={`pointer-events-auto w-full border ${isStandaloneMobileApp ? 'rounded-[1.7rem]' : 'rounded-[2.15rem]'}`}
        style={{
          backgroundColor: bgColor,
          borderColor,
          boxShadow: `0 8px 32px ${shadowColor}`,
          backdropFilter: `blur(${blurAmount})`,
          WebkitBackdropFilter: `blur(${blurAmount})`,
          touchAction: 'manipulation',
        }}
      >
        <div className={`flex items-center justify-around ${isStandaloneMobileApp ? 'px-2' : 'px-3'}`} style={{ height: effectiveNavHeight }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const isActive =
              to === '/' || to === '/perfil'
                ? location.pathname === to
                : location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                onMouseEnter={() => {
                  if (to === '/videos') warmVideoFeed();
                }}
                onFocus={() => {
                  if (to === '/videos') warmVideoFeed();
                }}
                onClick={(e) => {
                  if (to === '/' && location.pathname === '/') {
                    window.dispatchEvent(new CustomEvent(HOME_FEED_FOCUS_EVENT));
                    return;
                  }
                  if (isActive) return;
                  e.preventDefault();
                  if (to === '/videos') {
                    warmVideoFeed();
                  }
                  navigateAfterScrollReset(to);
                }}
                className={`relative flex h-full shrink-0 flex-col items-center justify-center group ${isStandaloneMobileApp ? 'w-[72px]' : 'w-[66px]'}`}
                style={{ touchAction: 'manipulation' }}
              >
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      layoutId="bottomnav-indicator"
                      className="rounded-[1.55rem] bg-white/[0.08]"
                      style={{ width: activeIndicatorSize, height: activeIndicatorSize }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  </div>
                )}

                <div className="relative z-10">
                  <Icon
                    className={`h-[29px] w-[29px] transition-colors ${
                      isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'
                    }`}
                  />
                  {to === '/mensajes' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] rounded-full bg-mansion-crimson text-white text-[9px] font-bold flex items-center justify-center px-1">
                      {unreadCount}
                    </span>
                  )}
                  {to === '/perfil' && user?.has_active_story && (
                    <span className="absolute -top-1 -right-1 w-[10px] h-[10px] rounded-full bg-gradient-to-tr from-mansion-gold to-mansion-crimson border-2 border-black/60" />
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
