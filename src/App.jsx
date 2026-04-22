import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAgeVerified } from './hooks/useAgeVerified';
import AgeVerificationModal from './components/AgeVerificationModal';
import Navbar, { MobileBrandOverlay } from './components/Navbar';
import BottomNav from './components/BottomNav';
import DesktopSidebar from './components/DesktopSidebar';
import FeedPage from './pages/FeedPage';
import ChatListPage from './pages/ChatListPage';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import WelcomePage from './pages/WelcomePage';
import PublicHomePage from './pages/PublicHomePage';
import SEOLandingPage from './pages/SEOLandingPage';
import BlackScreenPage from './pages/BlackScreenPage';
import MobileFullScreenProbePage from './pages/MobileFullScreenProbePage';
import FeedShellProbePage from './pages/FeedShellProbePage';
import ProfileShellProbePage from './pages/ProfileShellProbePage';
import SafeAreaDebugPage from './pages/SafeAreaDebugPage';
import ProfilePage from './pages/ProfilePage';
import { getToken, getStoredUser, setToken, setStoredUser, clearAuth, getAppBootstrap, peekAppBootstrap, ensureApiDebug, markApiDebugRoute } from './lib/api';
import { UnreadProvider } from './hooks/useUnreadMessages';
import InstallAppBanner from './components/InstallAppBanner';
import ApiDebugOverlay from './components/ApiDebugOverlay';
import SafeAreaRuntimeDebugOverlay from './components/SafeAreaRuntimeDebugOverlay';
import MobileViewportStabilizer from './components/MobileViewportStabilizer';
import { AuthContext, useAuth } from './lib/authContext';
import { preloadVideoFeedChunk, preloadVideoFeedData } from './lib/videoFeedWarmup';
import { clearBootDebugFlags, getBootDebugFlags, subscribeBootDebugFlags } from './lib/bootDebugPrefs';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { useRobotsMeta } from './lib/seo';
import { getRouteEnabledSeoLocales, isSeoLocale } from './lib/seoLocales';
import { isSeoIntentVariant } from './lib/seoVariants';

const ExplorePage = lazy(lazyWithRetry(() => import('./pages/ExplorePage'), 'mansion-lazy-retry:explore'));
const ProfileDetailPage = lazy(lazyWithRetry(() => import('./pages/ProfileDetailPage'), 'mansion-lazy-retry:profile-detail'));
const FavoritesPage = lazy(lazyWithRetry(() => import('./pages/FavoritesPage'), 'mansion-lazy-retry:favorites'));
const SettingsPage = lazy(lazyWithRetry(() => import('./pages/SettingsPage'), 'mansion-lazy-retry:settings'));
const AdminLayout = lazy(lazyWithRetry(() => import('./components/AdminLayout'), 'mansion-lazy-retry:admin-layout'));
const AdminUsersPage = lazy(lazyWithRetry(() => import('./pages/admin/AdminUsersPage'), 'mansion-lazy-retry:admin-users'));
const VipPage = lazy(lazyWithRetry(() => import('./pages/VipPage'), 'mansion-lazy-retry:vip'));
const PagoExitosoPage = lazy(lazyWithRetry(() => import('./pages/PagoExitosoPage'), 'mansion-lazy-retry:pago-exitoso'));
const PagoFallidoPage = lazy(lazyWithRetry(() => import('./pages/PagoFallidoPage'), 'mansion-lazy-retry:pago-fallido'));
const PagoPendientePage = lazy(lazyWithRetry(() => import('./pages/PagoPendientePage'), 'mansion-lazy-retry:pago-pendiente'));
const CoinsPage = lazy(lazyWithRetry(() => import('./pages/CoinsPage'), 'mansion-lazy-retry:coins'));
const PagoMonedasExitosoPage = lazy(lazyWithRetry(() => import('./pages/PagoMonedasExitosoPage'), 'mansion-lazy-retry:pago-monedas-exitoso'));
const StoryUploadPage = lazy(lazyWithRetry(() => import('./pages/StoryUploadPage'), 'mansion-lazy-retry:story-upload'));
const TopVisitedPage = lazy(lazyWithRetry(() => import('./pages/TopVisitedPage'), 'mansion-lazy-retry:top-visited'));
const VideoLabPage = lazy(lazyWithRetry(() => import('./pages/admin/VideoLabPage'), 'mansion-lazy-retry:video-lab'));
const VideoFeedPage = lazy(() => preloadVideoFeedChunk());
const NON_DEFAULT_ROUTE_LOCALES = getRouteEnabledSeoLocales().filter((locale) => locale.pathPrefix);
const MOBILE_BROWSER_IMMERSIVE_SCROLL_OFFSET = 68;
const MOBILE_PUBLIC_PROFILE_SCROLL_ELASTIC_MAX_PX = 48;
const MOBILE_PUBLIC_PROFILE_SCROLL_DAMPING = 0.42;
const MOBILE_PUBLIC_PROFILE_SCROLL_RETURN_DURATION_MS = 620;
const MOBILE_PUBLIC_PROFILE_SCROLL_RELEASE_DELAY_MS = 140;
const MOBILE_PUBLIC_PROFILE_TOP_BOUNCE_MAX_PX = 22;
const MOBILE_PUBLIC_PROFILE_TOP_BOUNCE_RETURN_MS = 620;

// Pages that don't show navbar/bottomnav (full-screen flows)
const FULLSCREEN_PATHS = ['/bienvenida', '/registro', '/login', '/recuperar-contrasena', '/vip', '/monedas', '/pago-exitoso', '/pago-fallido', '/pago-pendiente', '/pago-monedas-exitoso', '/admin/', '/historia/', '/black-test'];

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

function resetDocumentScroll(scrollTop = 0) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, scrollTop);
  root.scrollTop = scrollTop;
  if (body) body.scrollTop = scrollTop;
  root.style.scrollBehavior = previousScrollBehavior;
}

function getDocumentScrollTop() {
  if (typeof window === 'undefined') return 0;
  const root = document.documentElement;
  const body = document.body;
  return Math.max(
    Number(window.scrollY || 0),
    Number(root?.scrollTop || 0),
    Number(body?.scrollTop || 0)
  );
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - ((-2 * t + 2) ** 3) / 2;
}

function animateDocumentScrollTo(targetScrollTop, durationMs, { easing = easeInOutCubic, onUpdate, onComplete } = {}) {
  if (typeof window === 'undefined') return () => {};

  const startScrollTop = getDocumentScrollTop();
  if (Math.abs(startScrollTop - targetScrollTop) < 0.5 || durationMs <= 0) {
    resetDocumentScroll(targetScrollTop);
    onUpdate?.({ scrollTop: targetScrollTop, progress: 1 });
    onComplete?.();
    return () => {};
  }

  let rafId = 0;
  let cancelled = false;
  const startedAt = window.performance?.now?.() ?? Date.now();

  const tick = (now) => {
    if (cancelled) return;
    const elapsed = now - startedAt;
    const progress = Math.min(1, elapsed / durationMs);
    const easedProgress = easing(progress);
    const nextScrollTop = startScrollTop + ((targetScrollTop - startScrollTop) * easedProgress);
    resetDocumentScroll(nextScrollTop);
    onUpdate?.({ scrollTop: nextScrollTop, progress: easedProgress });
    if (progress < 1) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      resetDocumentScroll(targetScrollTop);
      onUpdate?.({ scrollTop: targetScrollTop, progress: 1 });
      onComplete?.();
    }
  };

  rafId = window.requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    if (rafId) window.cancelAnimationFrame(rafId);
  };
}

function readUrlNumberParam(params, name, fallback, min, max) {
  const raw = params.get(name);
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function syncViewportTopInsetVar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const root = document.documentElement;
  const offsetTop = Math.max(0, Math.round(window.visualViewport?.offsetTop || 0));
  root.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`);
}

function RequireRegistration({ children }) {
  const { registered } = useAuth();
  if (!registered) return <Navigate to="/bienvenida" replace />;
  return children;
}

function SEOCityLanding({ variant }) {
  const { citySlug = '' } = useParams();
  return <SEOLandingPage variant={variant} citySlug={citySlug || ''} />;
}

function LocalizedSEOLanding() {
  const { locale = '', variant = '', citySlug = '' } = useParams();
  const localeConfig = isSeoLocale(locale) ? NON_DEFAULT_ROUTE_LOCALES.find((entry) => entry.code === locale) : null;

  if (!localeConfig?.pathPrefix || !isSeoIntentVariant(variant)) {
    return <Navigate to="/" replace />;
  }

  return <SEOLandingPage locale={locale} variant={variant} citySlug={citySlug || ''} />;
}

function AppLayout() {
  const location = useLocation();
  const { registered, user } = useAuth();
  const [isStandaloneMobileApp, setIsStandaloneMobileApp] = useState(() => detectStandaloneMobile());
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });
  const lastNonProfileLocationRef = useRef(null);

  useEffect(() => {
    if (location.pathname.startsWith('/perfiles/')) return;
    if (location.state?.modal === 'profile') return;
    lastNonProfileLocationRef.current = {
      pathname: location.pathname,
      search: location.search || '',
      hash: location.hash || '',
      state: location.state || null,
      key: location.key,
    };
  }, [location]);

  const desktopProfileOverlayFallback = useMemo(() => {
    if (isMobileViewport) return null;
    if (!location.pathname.startsWith('/perfiles/')) return null;
    if (location.state?.backgroundLocation) return null;

    if (lastNonProfileLocationRef.current?.pathname) {
      return lastNonProfileLocationRef.current;
    }

    const from = typeof location.state?.from === 'string' ? location.state.from : '';
    if (!from.startsWith('/')) return null;

    try {
      const resolved = new URL(from, window.location.origin);
      return {
        pathname: resolved.pathname,
        search: resolved.search,
        hash: resolved.hash,
        state: location.state?.returnState || null,
        key: `desktop-profile-overlay:${resolved.pathname}${resolved.search}${resolved.hash}`,
      };
    } catch {
      return null;
    }
  }, [isMobileViewport, location.pathname, location.state]);
  const backgroundLocation = location.state?.backgroundLocation || desktopProfileOverlayFallback;
  const profileOverlayOpen =
    (location.state?.modal === 'profile' && !!backgroundLocation) ||
    (!!desktopProfileOverlayFallback);
  const videoOverlayOpen = location.state?.modal === 'videos' && !!backgroundLocation;
  const routeOverlayOpen = profileOverlayOpen || videoOverlayOpen;
  const routePath = location.pathname || '/';
  const normalizedRoutePath = routePath === '/' ? '/' : (routePath.replace(/\/+$/, '') || '/');
  const standaloneVideosRoute = isStandaloneMobileApp && location.pathname.startsWith('/videos');
  const mobileBrowserVideosRoute = isMobileViewport && normalizedRoutePath === '/videos';
  const isPublicHome = location.pathname === '/';
  const isPublicProfileRoute = normalizedRoutePath.startsWith('/perfiles/');
  const isMobileBrowserPublicProfileRoute = isMobileViewport && !isStandaloneMobileApp && isPublicProfileRoute;
  const isFullscreen =
    standaloneVideosRoute ||
    mobileBrowserVideosRoute ||
    FULLSCREEN_PATHS.some((p) => location.pathname.startsWith(p)) ||
    FULLSCREEN_PATHS.includes(location.pathname);
  const isChatDetail = location.pathname.match(/^\/mensajes\/.+$/);
  const showChrome = !isFullscreen && !isChatDetail && !isPublicHome;
  const scrollLockRef = useRef(null);
  const publicProfileScrollTuning = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      offset: readUrlNumberParam(params, 'profile_top_offset', MOBILE_BROWSER_IMMERSIVE_SCROLL_OFFSET, 0, 160),
      elastic: readUrlNumberParam(params, 'profile_top_elastic', MOBILE_PUBLIC_PROFILE_SCROLL_ELASTIC_MAX_PX, 0, 80),
      damping: readUrlNumberParam(params, 'profile_top_damping', MOBILE_PUBLIC_PROFILE_SCROLL_DAMPING, 0.05, 1),
      returnMs: readUrlNumberParam(params, 'profile_top_return', MOBILE_PUBLIC_PROFILE_SCROLL_RETURN_DURATION_MS, 0, 800),
      releaseMs: readUrlNumberParam(params, 'profile_top_idle', readUrlNumberParam(params, 'profile_top_release', MOBILE_PUBLIC_PROFILE_SCROLL_RELEASE_DELAY_MS, 0, 400), 0, 400),
      bounce: readUrlNumberParam(params, 'profile_top_bounce', MOBILE_PUBLIC_PROFILE_TOP_BOUNCE_MAX_PX, 0, 80),
      bounceReturnMs: readUrlNumberParam(params, 'profile_top_bounce_return', MOBILE_PUBLIC_PROFILE_TOP_BOUNCE_RETURN_MS, 0, 800),
    };
  }, [location.search]);
  const immersiveMobileApp = Boolean(
    (user || registered) &&
    isMobileViewport &&
    (
      normalizedRoutePath === '/feed' ||
      normalizedRoutePath === '/explorar' ||
      normalizedRoutePath === '/videos' ||
      normalizedRoutePath === '/ranking' ||
      normalizedRoutePath === '/perfil' ||
      isPublicProfileRoute ||
      normalizedRoutePath === '/favoritos' ||
      normalizedRoutePath === '/seguidores' ||
      normalizedRoutePath === '/configuracion' ||
      normalizedRoutePath === '/mensajes' ||
      normalizedRoutePath.startsWith('/mensajes/') ||
      normalizedRoutePath === '/full-mobile-test' ||
      normalizedRoutePath === '/feed-shell-test' ||
      normalizedRoutePath === '/profile-shell-test' ||
      normalizedRoutePath === '/safe-area-debug'
    )
  );
  const showMobileBrandOverlay = immersiveMobileApp && normalizedRoutePath !== '/videos' && !isPublicProfileRoute;
  const showHiddenMobileBrandOverlay = isMobileViewport && (Boolean(isChatDetail) || isPublicProfileRoute);
  const showMobileViewportStabilizer =
    !isStandaloneMobileApp &&
    isMobileViewport &&
    !routeOverlayOpen &&
    normalizedRoutePath !== '/videos' &&
    (immersiveMobileApp || isChatDetail);
  const showDesktopSidebar = showChrome && !routeOverlayOpen;
  const showTopNavbar = showChrome && !routeOverlayOpen && !immersiveMobileApp;
  const showBottomNav = (((!isChatDetail && !isFullscreen) || standaloneVideosRoute || mobileBrowserVideosRoute) && !routeOverlayOpen);
  const isPrivateNoindexRoute =
    routePath === '/feed' ||
    routePath === '/explorar' ||
    routePath === '/videos' ||
    routePath === '/full-mobile-test' ||
    routePath === '/feed-shell-test' ||
    routePath === '/profile-shell-test' ||
    routePath === '/safe-area-debug' ||
    routePath === '/ranking' ||
    routePath === '/perfil' ||
    routePath === '/favoritos' ||
    routePath === '/seguidores' ||
    routePath === '/configuracion' ||
    routePath === '/login' ||
    routePath === '/registro' ||
    routePath === '/recuperar-contrasena' ||
    routePath === '/bienvenida' ||
    routePath === '/vip' ||
    routePath === '/monedas' ||
    routePath === '/pago-exitoso' ||
    routePath === '/pago-monedas-exitoso' ||
    routePath === '/pago-fallido' ||
    routePath === '/pago-pendiente' ||
    routePath === '/black-test' ||
    routePath.startsWith('/perfiles/') ||
    routePath.startsWith('/mensajes') ||
    routePath.startsWith('/admin') ||
    routePath.startsWith('/historia/');
  useRobotsMeta(isPrivateNoindexRoute ? 'noindex,follow' : 'index,follow');

  useEffect(() => {
    ensureApiDebug();
    markApiDebugRoute(location.pathname + location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!user) return undefined;
    if (typeof window === 'undefined') return undefined;

    const warm = () => {
      preloadVideoFeedChunk();
      preloadVideoFeedData();
    };

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => warm(), { timeout: 1500 });
      return () => window.cancelIdleCallback?.(id);
    }

    const timer = window.setTimeout(warm, 700);
    return () => window.clearTimeout(timer);
  }, [user]);

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
    const handler = () => evaluate();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia('(max-width: 1023px)');
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updateViewport);
      return () => media.removeEventListener('change', updateViewport);
    }

    media.addListener(updateViewport);
    return () => media.removeListener(updateViewport);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;

    syncViewportTopInsetVar();

    let rafA = 0;
    let rafB = 0;
    const timers = [80, 180, 360].map((delay) => window.setTimeout(syncViewportTopInsetVar, delay));

    rafA = window.requestAnimationFrame(() => {
      syncViewportTopInsetVar();
      rafB = window.requestAnimationFrame(syncViewportTopInsetVar);
    });

    return () => {
      if (rafA) window.cancelAnimationFrame(rafA);
      if (rafB) window.cancelAnimationFrame(rafB);
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewportInset = () => syncViewportTopInsetVar();
    const vv = window.visualViewport;

    updateViewportInset();
    window.addEventListener('resize', updateViewportInset);
    window.addEventListener('orientationchange', updateViewportInset);
    window.addEventListener('focus', updateViewportInset);
    window.addEventListener('pageshow', updateViewportInset);
    vv?.addEventListener('resize', updateViewportInset);

    return () => {
      window.removeEventListener('resize', updateViewportInset);
      window.removeEventListener('orientationchange', updateViewportInset);
      window.removeEventListener('focus', updateViewportInset);
      window.removeEventListener('pageshow', updateViewportInset);
      vv?.removeEventListener('resize', updateViewportInset);
    };
  }, []);

  // Reset scroll to top on every route change, EXCEPT when opening/closing
  // a profile overlay (which manages scroll lock/restore itself).
  const prevPathnameRef = useRef(null);
  useLayoutEffect(() => {
    const routeScrollKey = isMobileBrowserPublicProfileRoute
      ? `${location.pathname}${location.search}`
      : location.pathname;
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = routeScrollKey;
    if (routeOverlayOpen) return; // overlay handles its own scroll
    if (location.state?.backgroundLocation) return; // closing overlay — App handles it
    if (prev === routeScrollKey) return; // same route/search, no reset
    if (isMobileViewport && normalizedRoutePath === '/videos') return; // video feed owns its mobile browser offset
    const shouldStabilizeMobileScroll =
      isMobileViewport &&
      (
        normalizedRoutePath === '/perfil' ||
        normalizedRoutePath === '/mensajes' ||
        normalizedRoutePath.startsWith('/mensajes/') ||
        isMobileBrowserPublicProfileRoute
      );

    const nextScrollTop =
      isMobileBrowserPublicProfileRoute
        ? publicProfileScrollTuning.offset
        : 0;

    resetDocumentScroll(nextScrollTop);

    if (!shouldStabilizeMobileScroll) return undefined;

    let rafA = 0;
    let rafB = 0;
    const stabilizeScroll = () => resetDocumentScroll(nextScrollTop);
    const timers = [80, 180, 360].map((delay) => window.setTimeout(stabilizeScroll, delay));
    rafA = window.requestAnimationFrame(() => {
      stabilizeScroll();
      rafB = window.requestAnimationFrame(stabilizeScroll);
    });

    return () => {
      if (rafA) window.cancelAnimationFrame(rafA);
      if (rafB) window.cancelAnimationFrame(rafB);
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [isMobileBrowserPublicProfileRoute, isMobileViewport, location.pathname, location.search, location.state, normalizedRoutePath, publicProfileScrollTuning.offset, routeOverlayOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!isMobileBrowserPublicProfileRoute || routeOverlayOpen) return undefined;

    const minScrollTop = publicProfileScrollTuning.offset;
    const elasticMaxPx = publicProfileScrollTuning.elastic;
    const damping = publicProfileScrollTuning.damping;
    const returnDurationMs = publicProfileScrollTuning.returnMs;
    const releaseDelayMs = publicProfileScrollTuning.releaseMs;
    const bounceMaxPx = publicProfileScrollTuning.bounce;
    const bounceReturnMs = publicProfileScrollTuning.bounceReturnMs;
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverscroll = root.style.overscrollBehaviorY;
    const previousBodyOverscroll = body?.style.overscrollBehaviorY || '';
    let clampRafId = 0;
    let releaseTimerId = 0;
    let touching = false;
    let cancelReturnAnimation = null;
    let startupTimerIds = [];
    let lastPocketScrollAt = 0;
    let returningToTop = false;
    let resizeObserver = null;
    let resizeObserverRafId = 0;

    const cancelReturn = () => {
      if (cancelReturnAnimation) {
        cancelReturnAnimation();
        cancelReturnAnimation = null;
      }
      returningToTop = false;
    };

    const clearStartupTimers = () => {
      startupTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      startupTimerIds = [];
    };

    const setTopBounce = (value, withTransition = false) => {
      const nextValue = Math.max(0, Math.min(bounceMaxPx, value));
      root.style.setProperty(
        '--public-profile-top-bounce-transition',
        withTransition
          ? `transform ${bounceReturnMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
          : 'none'
      );
      root.style.setProperty('--public-profile-top-bounce-y', `${nextValue.toFixed(2)}px`);
    };

    const getBounceForScrollTop = (scrollTop) => {
      if (scrollTop >= minScrollTop) return 0;
      const overshoot = minScrollTop - scrollTop;
      return Math.min(elasticMaxPx, overshoot * damping);
    };

    const syncBounceToScrollTop = (scrollTop) => {
      setTopBounce(getBounceForScrollTop(scrollTop), false);
    };

    const snapBackToTop = (immediate = false) => {
      cancelReturn();
      const currentScrollTop = getDocumentScrollTop();
      if (currentScrollTop >= minScrollTop) {
        setTopBounce(0, !immediate);
        return;
      }
      if (immediate) {
        setTopBounce(0, false);
        returningToTop = false;
        resetDocumentScroll(minScrollTop);
        return;
      }
      if (currentScrollTop >= minScrollTop - 0.5) {
        setTopBounce(0, true);
        returningToTop = false;
        resetDocumentScroll(minScrollTop);
        return;
      }
      syncBounceToScrollTop(currentScrollTop);
      returningToTop = true;
      cancelReturnAnimation = animateDocumentScrollTo(
        minScrollTop,
        returnDurationMs,
        {
          easing: easeInOutCubic,
          onUpdate: ({ scrollTop }) => {
            syncBounceToScrollTop(scrollTop);
          },
          onComplete: () => {
            returningToTop = false;
            cancelReturnAnimation = null;
            setTopBounce(0, true);
          },
        }
      );
    };

    const snapBackToTopSoftly = () => {
      if (returningToTop || touching) return;
      snapBackToTop(false);
    };

    const scheduleContentSettle = () => {
      if (touching || returningToTop) return;
      if (resizeObserverRafId) return;
      resizeObserverRafId = window.requestAnimationFrame(() => {
        resizeObserverRafId = 0;
        snapBackToTopSoftly();
      });
    };

    const handleViewportChange = () => {
      if (releaseTimerId) {
        window.clearTimeout(releaseTimerId);
        releaseTimerId = 0;
      }
      snapBackToTop(true);
    };

    const applyElasticClamp = () => {
      const currentScrollTop = getDocumentScrollTop();
      if (currentScrollTop >= minScrollTop) return;

      syncBounceToScrollTop(currentScrollTop);
    };

    const scheduleElasticClamp = () => {
      if (!returningToTop) cancelReturn();
      if (clampRafId) return;
      clampRafId = window.requestAnimationFrame(() => {
        clampRafId = 0;
        applyElasticClamp();
      });
    };

    const scheduleSnapBack = () => {
      if (returningToTop) return;
      if (releaseTimerId) window.clearTimeout(releaseTimerId);
      releaseTimerId = window.setTimeout(() => {
        if (returningToTop) return;
        const now = window.performance?.now?.() ?? Date.now();
        const quietForMs = now - lastPocketScrollAt;
        if (quietForMs < releaseDelayMs) {
          scheduleSnapBack();
          return;
        }
        snapBackToTop(false);
      }, releaseDelayMs);
    };

    const handleTouchStart = () => {
      touching = true;
      clearStartupTimers();
      if (releaseTimerId) {
        window.clearTimeout(releaseTimerId);
        releaseTimerId = 0;
      }
      if (resizeObserverRafId) {
        window.cancelAnimationFrame(resizeObserverRafId);
        resizeObserverRafId = 0;
      }
      cancelReturn();
    };

    const handleTouchEnd = () => {
      touching = false;
      scheduleSnapBack();
    };

    const handleScroll = () => {
      const currentScrollTop = getDocumentScrollTop();
      if (returningToTop) {
        if (currentScrollTop >= minScrollTop - 0.5) setTopBounce(0, true);
        return;
      }
      if (currentScrollTop >= minScrollTop) {
        cancelReturn();
        setTopBounce(0, false);
        if (releaseTimerId) {
          window.clearTimeout(releaseTimerId);
          releaseTimerId = 0;
        }
        return;
      }
      lastPocketScrollAt = window.performance?.now?.() ?? Date.now();
      scheduleElasticClamp();
      if (!touching) scheduleSnapBack();
    };

    root.style.overscrollBehaviorY = 'contain';
    if (body) body.style.overscrollBehaviorY = 'contain';
    setTopBounce(0, false);
    lastPocketScrollAt = window.performance?.now?.() ?? Date.now();

    snapBackToTop(true);
    startupTimerIds = [80, 180, 360, 700].map((delay) => window.setTimeout(() => snapBackToTop(true), delay));

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    window.addEventListener('pageshow', handleViewportChange);
    window.addEventListener('focus', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    if (typeof window.ResizeObserver === 'function') {
      resizeObserver = new window.ResizeObserver(scheduleContentSettle);
      resizeObserver.observe(root);
      if (body) resizeObserver.observe(body);
    }

    return () => {
      if (clampRafId) window.cancelAnimationFrame(clampRafId);
      if (resizeObserverRafId) window.cancelAnimationFrame(resizeObserverRafId);
      if (releaseTimerId) window.clearTimeout(releaseTimerId);
      resizeObserver?.disconnect();
      cancelReturn();
      clearStartupTimers();
      root.style.removeProperty('--public-profile-top-bounce-y');
      root.style.removeProperty('--public-profile-top-bounce-transition');
      root.style.overscrollBehaviorY = previousRootOverscroll;
      if (body) body.style.overscrollBehaviorY = previousBodyOverscroll;
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleScroll);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      window.removeEventListener('pageshow', handleViewportChange);
      window.removeEventListener('focus', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
    };
  }, [isMobileBrowserPublicProfileRoute, publicProfileScrollTuning, routeOverlayOpen]);

  useEffect(() => {
    // Video overlay is fullscreen — no need to lock the background scroll.
    // On iOS PWA with black-translucent, body{position:fixed} breaks viewport
    // calculations for fixed children, causing them to not extend behind the
    // status bar (looks non-fullscreen). Skip the lock for video overlays.
    if (!profileOverlayOpen || typeof window === 'undefined') return undefined;

    const scrollY = Number(location.state?.backgroundScrollY ?? window.scrollY ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0) || 0;
    const { style: bodyStyle } = document.body;
    const { style: htmlStyle } = document.documentElement;
    const previousBody = {
      position: bodyStyle.position,
      top: bodyStyle.top,
      width: bodyStyle.width,
      overflow: bodyStyle.overflow,
    };
    const previousHtmlOverflow = htmlStyle.overflow;

    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = '100%';
    bodyStyle.overflow = 'hidden';
    htmlStyle.overflow = 'hidden';

    // Store restore info for onExitComplete instead of cleaning up immediately.
    // Immediate cleanup causes a white flash on iOS Safari because the browser
    // paints a frame at scroll 0 before honoring window.scrollTo().
    scrollLockRef.current = { previousBody, previousHtmlOverflow, scrollY };

    return () => {
      // Only restore immediately if the overlay was never animated out
      // (e.g. route change that bypasses AnimatePresence).
      if (scrollLockRef.current) {
        const { previousBody: pb, previousHtmlOverflow: pho, scrollY: sy } = scrollLockRef.current;
        scrollLockRef.current = null;
        bodyStyle.position = pb.position;
        bodyStyle.top = pb.top;
        bodyStyle.width = pb.width;
        bodyStyle.overflow = pb.overflow;
        htmlStyle.overflow = pho;
        window.scrollTo(0, sy);
      }
    };
  }, [location.state?.backgroundScrollY, profileOverlayOpen]);

  const handleOverlayExitComplete = useCallback(() => {
    if (!scrollLockRef.current) return;
    const { previousBody, previousHtmlOverflow, scrollY } = scrollLockRef.current;
    scrollLockRef.current = null;
    const { style: bodyStyle } = document.body;
    const { style: htmlStyle } = document.documentElement;
    bodyStyle.position = previousBody.position;
    bodyStyle.top = previousBody.top;
    bodyStyle.width = previousBody.width;
    bodyStyle.overflow = previousBody.overflow;
    htmlStyle.overflow = previousHtmlOverflow;
    window.scrollTo(0, scrollY);
  }, []);

  return (
    <>
      {showDesktopSidebar && <DesktopSidebar />}
      {showTopNavbar && <Navbar />}
      {showMobileViewportStabilizer && <MobileViewportStabilizer />}
      {showChrome && !routeOverlayOpen && showMobileBrandOverlay && <MobileBrandOverlay />}
      {!routeOverlayOpen && showHiddenMobileBrandOverlay && <MobileBrandOverlay hidden />}

      <div
        className={showDesktopSidebar ? 'lg:pl-64 xl:pl-72' : ''}
        data-mobile-immersive={immersiveMobileApp ? 'true' : undefined}
        data-mobile-standalone={isStandaloneMobileApp ? 'true' : undefined}
      >
        <Suspense
          fallback={(
            <div className="min-h-screen bg-mansion-base flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
            </div>
          )}
        >
        <Routes location={backgroundLocation || location}>
          {/* Full-screen flows */}
          <Route path="/bienvenida" element={<WelcomePage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar-contrasena" element={<ForgotPasswordPage />} />
          <Route path="/black-test" element={<BlackScreenPage />} />

          {/* Public SEO landing pages */}
          <Route path="/parejas" element={<SEOLandingPage variant="parejas" />} />
          <Route path="/trios" element={<SEOLandingPage variant="trios" />} />
          <Route path="/swingers" element={<SEOLandingPage variant="swingers" />} />
          <Route path="/mujeres" element={<SEOLandingPage variant="mujeres" />} />
          <Route path="/hombres" element={<SEOLandingPage variant="hombres" />} />
          <Route path="/trans" element={<SEOLandingPage variant="trans" />} />
          <Route path="/cuckold-argentina" element={<SEOLandingPage variant="cuckold-argentina" />} />
          <Route path="/contactossex" element={<SEOLandingPage variant="contactossex" />} />
          <Route path="/contactossex-argentina" element={<SEOLandingPage variant="contactossex-argentina" />} />
          <Route path="/cornudos-argentina" element={<SEOLandingPage variant="cornudos-argentina" />} />
          <Route path="/parejas/:citySlug" element={<SEOCityLanding variant="parejas" />} />
          <Route path="/trios/:citySlug" element={<SEOCityLanding variant="trios" />} />
          <Route path="/swingers/:citySlug" element={<SEOCityLanding variant="swingers" />} />
          <Route path="/mujeres/:citySlug" element={<SEOCityLanding variant="mujeres" />} />
          <Route path="/hombres/:citySlug" element={<SEOCityLanding variant="hombres" />} />
          <Route path="/trans/:citySlug" element={<SEOCityLanding variant="trans" />} />
          <Route path="/cuckold-argentina/:citySlug" element={<SEOCityLanding variant="cuckold-argentina" />} />
          <Route path="/contactossex/:citySlug" element={<SEOCityLanding variant="contactossex" />} />
          <Route path="/contactossex-argentina/:citySlug" element={<SEOCityLanding variant="contactossex-argentina" />} />
          <Route path="/cornudos-argentina/:citySlug" element={<SEOCityLanding variant="cornudos-argentina" />} />
          {NON_DEFAULT_ROUTE_LOCALES.length > 0 && (
            <>
              <Route path="/:locale/:variant" element={<LocalizedSEOLanding />} />
              <Route path="/:locale/:variant/:citySlug" element={<LocalizedSEOLanding />} />
            </>
          )}

          {/* Pagos */}
          <Route path="/vip" element={<VipPage />} />
          <Route path="/monedas" element={<CoinsPage />} />
          <Route path="/pago-exitoso" element={<PagoExitosoPage />} />
          <Route path="/pago-monedas-exitoso" element={<PagoMonedasExitosoPage />} />
          <Route path="/pago-fallido" element={<PagoFallidoPage />} />
          <Route path="/pago-pendiente" element={<PagoPendientePage />} />

          {/* Chat detail (full-screen but with custom header) */}
          <Route
            path="/mensajes/:id"
            element={<ChatPage />}
          />

          {/* Standard layout pages (require registration) */}
          <Route
            path="/"
            element={<PublicHomePage />}
          />
          <Route
            path="/feed"
            element={
              <RequireRegistration>
                <FeedPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/explorar"
            element={
              <RequireRegistration>
                <ExplorePage />
              </RequireRegistration>
            }
          />
          <Route
            path="/videos"
            element={
              <RequireRegistration>
                <VideoFeedPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/full-mobile-test"
            element={
              <RequireRegistration>
                <MobileFullScreenProbePage />
              </RequireRegistration>
            }
          />
          <Route
            path="/feed-shell-test"
            element={
              <RequireRegistration>
                <FeedShellProbePage />
              </RequireRegistration>
            }
          />
          <Route
            path="/profile-shell-test"
            element={
              <RequireRegistration>
                <ProfileShellProbePage />
              </RequireRegistration>
            }
          />
          <Route
            path="/safe-area-debug"
            element={
              <RequireRegistration>
                <SafeAreaDebugPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/ranking"
            element={
              <RequireRegistration>
                <TopVisitedPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/perfiles/:id"
            element={
              <RequireRegistration>
                <ProfileDetailPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/mensajes"
            element={
              <RequireRegistration>
                <ChatListPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/perfil"
            element={
              <RequireRegistration>
                <ProfilePage />
              </RequireRegistration>
            }
          />
          <Route
            path="/favoritos"
            element={
              <RequireRegistration>
                <FavoritesPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/seguidores"
            element={
              <RequireRegistration>
                <FavoritesPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/configuracion"
            element={
              <RequireRegistration>
                <SettingsPage />
              </RequireRegistration>
            }
          />

          {/* Story upload (fullscreen onboarding flow) */}
          <Route path="/historia/nueva" element={<StoryUploadPage />} />

          {/* Admin standalone layout */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/usuarios" replace />} />
            <Route path="usuarios" element={<AdminUsersPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
            <Route path="video-lab" element={<VideoLabPage />} />
          </Route>
        </Routes>
        <AnimatePresence mode="wait" onExitComplete={handleOverlayExitComplete}>
          {profileOverlayOpen && (
            <motion.div
              key={location.key || location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[120]"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
              />
              <motion.div
                initial={{ y: 72, opacity: 0.78, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 56, opacity: 0.72, scale: 0.97 }}
                transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 overflow-y-auto bg-mansion-base"
              >
                <Routes>
                  <Route path="/perfiles/:id" element={<ProfileDetailPage />} />
                </Routes>
              </motion.div>
            </motion.div>
          )}
          {videoOverlayOpen && (
            <motion.div
              key={location.key || location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[130]"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-black/72 backdrop-blur-[4px] pointer-events-none"
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 pointer-events-auto"
              >
                <Routes>
                  <Route path="/videos" element={<VideoFeedPage />} />
                </Routes>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </Suspense>
      </div>

      {showBottomNav && <BottomNav immersive={immersiveMobileApp} />}
    </>
  );
}

export default function App() {
  const { verified, verify } = useAgeVerified();
  const [debugFlags, setDebugFlags] = useState(() => getBootDebugFlags());
  const [registered, setRegisteredState] = useState(
    () => !!getToken() || localStorage.getItem('mansion_registered') === 'true'
  );
  const [user, setUserState] = useState(() => getStoredUser());
  const [bootstrapUnread, setBootstrapUnread] = useState(null);
  const [bootstrapResolved, setBootstrapResolved] = useState(() => !getToken());
  const [bootstrapStories, setBootstrapStories] = useState(() => {
    const cached = peekAppBootstrap();
    return Array.isArray(cached?.stories) ? cached.stories : [];
  });
  const [siteSettings, setSiteSettings] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('mansion_site_settings') || '{}'); } catch { return {}; }
  });
  const [bootShieldVisible, setBootShieldVisible] = useState(() => debugFlags.bootShield);
  const [snapshotShieldVisible, setSnapshotShieldVisible] = useState(false);
  const bootstrapStartedRef = useRef(false);

  const handleDisableBootDiagnostics = useCallback(() => {
    clearBootDebugFlags();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  const setRegistered = useCallback((val) => {
    if (val) {
      localStorage.setItem('mansion_registered', 'true');
    } else {
      clearAuth();
    }
    setRegisteredState(val);
  }, []);

  const setUser = useCallback((u) => {
    if (typeof u === 'function') {
      setUserState(prev => {
        const next = u(prev);
        setStoredUser(next);
        return next;
      });
    } else {
      setStoredUser(u);
      setUserState(u);
    }
  }, []);

  // Listen for auth expiration events dispatched by apiFetch on 401
  useEffect(() => {
    const handleAuthExpired = () => {
      setRegisteredState(false);
      setUserState(null);
    };
    window.addEventListener('mansion-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('mansion-auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeBootDebugFlags((nextFlags) => {
      setDebugFlags(nextFlags);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
    const ua = navigator.userAgent || '';
    const isMobile = /iphone|ipad|ipod|android/i.test(ua);
    if (!standalone || !isMobile) return undefined;

    const orientationApi = window.screen?.orientation;
    if (!orientationApi?.lock) return undefined;

    orientationApi.lock('portrait').catch(() => {});
    return undefined;
  }, []);

  useEffect(() => {
    if (debugFlags.bootShield) {
      setBootShieldVisible(true);
    }
  }, [debugFlags.bootShield]);

  useEffect(() => {
    if (!debugFlags.bootShield) return undefined;
    const timer = window.setTimeout(() => setBootShieldVisible(false), 900);
    return () => window.clearTimeout(timer);
  }, [debugFlags.bootShield]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    let revealTimer = null;

    const showSnapshotShield = () => {
      setSnapshotShieldVisible(true);
      if (revealTimer) {
        window.clearTimeout(revealTimer);
        revealTimer = null;
      }
    };

    const hideSnapshotShield = () => {
      if (document.visibilityState === 'hidden') return;
      if (revealTimer) window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => {
        setSnapshotShieldVisible(false);
      }, 220);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        showSnapshotShield();
      } else {
        hideSnapshotShield();
      }
    };

    const handlePageHide = () => {
      showSnapshotShield();
    };

    const handlePageShow = () => {
      hideSnapshotShield();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    if (document.visibilityState === 'visible') {
      hideSnapshotShield();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      if (revealTimer) window.clearTimeout(revealTimer);
    };
  }, []);

  useEffect(() => {
    if (bootstrapStartedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      localStorage.setItem('mansion_registered', 'true');
      setRegisteredState(true);
      window.history.replaceState({}, '', '/feed');
    }

    let cancelled = false;
    let detachVisibilityListener = null;

    const hasSessionSettings = !!siteSettings && Object.keys(siteSettings).length > 0;
    const hasAuthToken = !!getToken();

    if (debugFlags.skipBootstrap) {
      bootstrapStartedRef.current = true;
      setBootstrapUnread(null);
      setBootstrapResolved(true);
      return () => {
        cancelled = true;
      };
    }

    if (!hasAuthToken && hasSessionSettings) {
      setBootstrapUnread(null);
      setBootstrapResolved(true);
      return () => {
        cancelled = true;
      };
    }

    const runBootstrap = () => {
      if (bootstrapStartedRef.current || cancelled) return;
      bootstrapStartedRef.current = true;

      getAppBootstrap().then(data => {
        if (cancelled) return;

        if (data?.user) {
          setUser(data.user);
          setRegisteredState(true);
        }

        setBootstrapUnread(typeof data?.unread === 'number' ? data.unread : null);
        setBootstrapStories(Array.isArray(data?.stories) ? data.stories : []);
        setBootstrapResolved(true);

        if (data?.settings) {
          setSiteSettings(data.settings);
          try { sessionStorage.setItem('mansion_site_settings', JSON.stringify(data.settings)); } catch {}
        }
      }).catch(() => {
        setBootstrapUnread(null);
        setBootstrapStories([]);
        setBootstrapResolved(true);
        if (cancelled || !getToken()) return;
        clearAuth();
        setUserState(null);
        setRegisteredState(false);
      });
    };

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      const handleVisibilityChange = () => {
        if (document.visibilityState !== 'visible') return;
        window.removeEventListener('visibilitychange', handleVisibilityChange);
        detachVisibilityListener = null;
        runBootstrap();
      };
      detachVisibilityListener = () => window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('visibilitychange', handleVisibilityChange);
    } else {
      runBootstrap();
    }

    return () => {
      cancelled = true;
      detachVisibilityListener?.();
    };
  }, [debugFlags.skipBootstrap, setUser, siteSettings]);

  return (
    <BrowserRouter>
      <AuthContext.Provider value={{ registered, setRegistered, user, setUser, siteSettings, setSiteSettings, bootstrapStories, setBootstrapStories }}>
      <UnreadProvider initialUnread={bootstrapUnread} bootstrapResolved={bootstrapResolved}>
      <div className="relative min-h-screen">
        {debugFlags.shellOnly ? (
          <div className="fixed inset-0 z-[10000] bg-mansion-base text-text-primary">
            <div className="flex min-h-screen items-center justify-center px-6">
              <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-black/30 p-6 text-center shadow-2xl shadow-black/40">
                <p className="text-[11px] uppercase tracking-[0.28em] text-text-dim">Boot diagnostic</p>
                <h1 className="mt-3 text-xl font-semibold text-white">Solo shell oscuro</h1>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  La app no se monto. Si aca no ves el flicker, entonces el problema viene del contenido que carga despues del arranque.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/10"
                  >
                    Recargar shell
                  </button>
                  <button
                    onClick={handleDisableBootDiagnostics}
                    className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/15"
                  >
                    Salir del modo diagnostico
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {bootShieldVisible && (
          <div className="fixed inset-0 z-[9999] bg-mansion-base" aria-hidden="true" />
        )}
        {snapshotShieldVisible && (
          <div className="fixed inset-0 z-[9998] bg-mansion-base" aria-hidden="true" />
        )}
        {!debugFlags.shellOnly && !verified && <AgeVerificationModal onVerify={verify} />}
        {!debugFlags.shellOnly && <AppLayout />}
        {!debugFlags.shellOnly && <InstallAppBanner />}
        {!debugFlags.shellOnly && <ApiDebugOverlay />}
        {!debugFlags.shellOnly && <SafeAreaRuntimeDebugOverlay />}
      </div>
      </UnreadProvider>
      </AuthContext.Provider>
    </BrowserRouter>
  );
}
