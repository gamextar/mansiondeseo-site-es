import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Film, MessageCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useAuth } from '../lib/authContext';
import {
  BOTTOM_NAV_BLUR,
  BOTTOM_NAV_OPACITY,
  BOTTOM_NAV_SIDE_PADDING,
  getBottomNavPageExtraPadding,
  getBottomNavHeight,
  getBottomNavVisualOffset,
} from '../lib/bottomNavConfig';
import { warmVideoFeed } from '../lib/videoFeedWarmup';
import { useEffect, useRef } from 'react';

const HOME_FEED_FOCUS_EVENT = 'mansion-home-feed-focus';
const HOME_FEED_RESET_EVENT = 'mansion-home-feed-reset';
const HOME_FEED_ROUTES = ['/', '/feed'];

const NAV_ITEMS = [
  { to: '/feed', icon: Home, label: 'Inicio' },
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

export default function BottomNav({ immersive = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useUnreadMessages();
  const { user } = useAuth();
  const pendingNavResetRef = useRef(null);
  const lastTouchNavRef = useRef({ to: '', at: 0 });
  const isStandaloneMobileApp = detectStandaloneMobile();
  const effectiveNavHeight = getBottomNavHeight(isStandaloneMobileApp);
  const visualOffsetPx = getBottomNavVisualOffset(isStandaloneMobileApp);
  const pageExtraPaddingPx = getBottomNavPageExtraPadding(isStandaloneMobileApp);
  const activeIndicatorSize = isStandaloneMobileApp ? 66 : 62;
  const outerSidePadding = BOTTOM_NAV_SIDE_PADDING;
  const bgColor = `rgba(0,0,0,${(BOTTOM_NAV_OPACITY / 100).toFixed(2)})`;
  const borderColor = `rgba(255,255,255,${(0.08 * BOTTOM_NAV_OPACITY / 100).toFixed(3)})`;
  const shadowColor = `rgba(0,0,0,${(0.4 * BOTTOM_NAV_OPACITY / 100).toFixed(3)})`;
  const blurAmount = BOTTOM_NAV_OPACITY <= 0 ? '0px' : `${BOTTOM_NAV_BLUR}px`;
  const showNavDebug = new URLSearchParams(location.search).get('nav_debug') === '1';

  useEffect(() => () => {
    if (!pendingNavResetRef.current || typeof window === 'undefined') return;
    if (pendingNavResetRef.current.rafId) window.cancelAnimationFrame(pendingNavResetRef.current.rafId);
    if (pendingNavResetRef.current.timeoutId) window.clearTimeout(pendingNavResetRef.current.timeoutId);
    pendingNavResetRef.current = null;
  }, []);

  const handleNavIntent = (to, { isActive, isHomeRoute }) => {
    if (to === '/feed' && isHomeRoute) {
      window.dispatchEvent(new CustomEvent(HOME_FEED_RESET_EVENT));
      return;
    }
    if (isActive) return;
    if (to === '/videos') {
      warmVideoFeed();
    }
    if (to === '/feed') {
      try { localStorage.removeItem('mansion_feed'); } catch {}
    }
    navigateAfterScrollReset(to);
  };

  const navigateAfterScrollReset = (to) => {
    if (typeof window === 'undefined') {
      navigate(to);
      return;
    }

    if (pendingNavResetRef.current) {
      if (pendingNavResetRef.current.rafId) window.cancelAnimationFrame(pendingNavResetRef.current.rafId);
      if (pendingNavResetRef.current.timeoutId) window.clearTimeout(pendingNavResetRef.current.timeoutId);
      pendingNavResetRef.current = null;
    }

    if (isStandaloneMobileApp) {
      resetDocumentScrollToTop();
    }

    navigate(to);
  };

  // Hide on landing/onboarding/register/login
  const hiddenPaths = ['/bienvenida', '/registro', '/login'];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex justify-center pointer-events-auto"
      style={{
        bottom: isStandaloneMobileApp ? `${visualOffsetPx}px` : '0px',
        paddingBottom: isStandaloneMobileApp
          ? '0px'
          : `calc(env(safe-area-inset-bottom, 0px) + ${visualOffsetPx}px)`,
        paddingLeft: outerSidePadding,
        paddingRight: outerSidePadding,
        isolation: 'isolate',
        touchAction: 'manipulation',
      }}
    >
      {showNavDebug && (
        <div className="absolute left-2 bottom-full mb-2 rounded-xl border border-amber-300/60 bg-black/85 px-3 py-2 text-[10px] font-mono leading-4 text-amber-100 shadow-2xl backdrop-blur-md">
          <div>nav_debug=1</div>
          <div>mode: {isStandaloneMobileApp ? 'standalone' : 'browser'}</div>
          <div>immersive: {immersive ? 'true' : 'false'}</div>
          <div>height: {effectiveNavHeight}px</div>
          <div>visualOffset: {visualOffsetPx}px</div>
          <div>pageExtra: {pageExtraPaddingPx}px</div>
          <div>sidePadding: {outerSidePadding}px</div>
        </div>
      )}
      <div
        className={`pointer-events-auto w-full border ${
          isStandaloneMobileApp ? 'rounded-[1.9rem]' : 'rounded-[2.35rem]'
        }`}
        style={{
          backgroundColor: bgColor,
          borderColor,
          boxShadow: immersive ? `0 -12px 36px ${shadowColor}` : `0 8px 32px ${shadowColor}`,
          backdropFilter: `blur(${blurAmount})`,
          WebkitBackdropFilter: `blur(${blurAmount})`,
          touchAction: 'manipulation',
        }}
      >
        <div className="flex items-center justify-around px-2.5" style={{ height: effectiveNavHeight }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const isHomeRoute = HOME_FEED_ROUTES.includes(location.pathname);
            const isActive =
              to === '/feed'
                ? isHomeRoute
                : to === '/perfil'
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
                onPointerUp={(e) => {
                  if (e.pointerType === 'mouse') return;
                  e.preventDefault();
                  lastTouchNavRef.current = { to, at: Date.now() };
                  handleNavIntent(to, { isActive, isHomeRoute });
                }}
                onClick={(e) => {
                  const lastTouchNav = lastTouchNavRef.current;
                  if (lastTouchNav.to === to && Date.now() - lastTouchNav.at < 900) {
                    e.preventDefault();
                    return;
                  }
                  if (isActive && to !== '/feed') return;
                  e.preventDefault();
                  handleNavIntent(to, { isActive, isHomeRoute });
                }}
                className="relative flex h-full shrink-0 flex-col items-center justify-center group pointer-events-auto select-none"
                style={{
                  touchAction: 'manipulation',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  width: isStandaloneMobileApp ? 76 : 70,
                }}
              >
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <motion.div
                      layoutId="bottomnav-indicator"
                      className="rounded-[1.55rem] bg-white/[0.08] pointer-events-none"
                      style={{ width: activeIndicatorSize, height: activeIndicatorSize }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  </div>
                )}

                <div className="relative z-10">
                  <Icon
                    className={`transition-colors ${
                      isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'
                    }`}
                    style={{ width: 29, height: 29 }}
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
