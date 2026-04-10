import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAgeVerified } from './hooks/useAgeVerified';
import AgeVerificationModal from './components/AgeVerificationModal';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import DesktopSidebar from './components/DesktopSidebar';
import FeedPage from './pages/FeedPage';
import ExplorePage from './pages/ExplorePage';
import ProfileDetailPage from './pages/ProfileDetailPage';
import ChatListPage from './pages/ChatListPage';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import WelcomePage from './pages/WelcomePage';
import SEOLandingPage from './pages/SEOLandingPage';
import ProfilePage from './pages/ProfilePage';
import FavoritesPage from './pages/FavoritesPage';
import SettingsPage from './pages/SettingsPage';
import AdminLayout from './components/AdminLayout';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import VipPage from './pages/VipPage';
import PagoExitosoPage from './pages/PagoExitosoPage';
import PagoFallidoPage from './pages/PagoFallidoPage';
import PagoPendientePage from './pages/PagoPendientePage';
import CoinsPage from './pages/CoinsPage';
import PagoMonedasExitosoPage from './pages/PagoMonedasExitosoPage';
import StoryUploadPage from './pages/StoryUploadPage';
import { getToken, getStoredUser, setToken, setStoredUser, clearAuth, getAppBootstrap, ensureApiDebug, markApiDebugRoute } from './lib/api';
import { UnreadProvider } from './hooks/useUnreadMessages';
import InstallAppBanner from './components/InstallAppBanner';
import ApiDebugOverlay from './components/ApiDebugOverlay';
import { AuthContext, useAuth } from './lib/authContext';

const VideoLabPage = lazy(() => import('./pages/admin/VideoLabPage'));
const VideoFeedPage = lazy(() => import('./pages/VideoFeedPage'));
const TopVisitedPage = lazy(() => import('./pages/TopVisitedPage'));

// Pages that don't show navbar/bottomnav (full-screen flows)
const FULLSCREEN_PATHS = ['/bienvenida', '/registro', '/login', '/recuperar-contrasena', '/mensajes/', '/vip', '/monedas', '/pago-exitoso', '/pago-fallido', '/pago-pendiente', '/pago-monedas-exitoso', '/admin/', '/historia/'];

function RequireRegistration({ children }) {
  const { registered } = useAuth();
  if (!registered) return <Navigate to="/bienvenida" replace />;
  return children;
}

function SEOCityLanding({ variant }) {
  const { citySlug = '' } = useParams();
  return <SEOLandingPage variant={variant} citySlug={citySlug || ''} />;
}

function AppLayout() {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;
  const profileOverlayOpen = location.state?.modal === 'profile' && !!backgroundLocation;
  const isFullscreen =
    FULLSCREEN_PATHS.some((p) => location.pathname.startsWith(p)) ||
    FULLSCREEN_PATHS.includes(location.pathname);
  const isChatDetail = location.pathname.match(/^\/mensajes\/.+$/);
  const showChrome = !isFullscreen && !isChatDetail;

  useEffect(() => {
    ensureApiDebug();
    markApiDebugRoute(location.pathname + location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!profileOverlayOpen || typeof window === 'undefined') return undefined;

    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
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

    return () => {
      bodyStyle.position = previousBody.position;
      bodyStyle.top = previousBody.top;
      bodyStyle.width = previousBody.width;
      bodyStyle.overflow = previousBody.overflow;
      htmlStyle.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [profileOverlayOpen]);

  return (
    <>
      {showChrome && <DesktopSidebar />}
      {showChrome && <Navbar />}

      <div className={showChrome ? 'lg:pl-64 xl:pl-72' : ''}>
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
        <AnimatePresence mode="wait">
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
        </AnimatePresence>
        </Suspense>
      </div>

      {showChrome && <BottomNav />}
    </>
  );
}

export default function App() {
  const { verified, verify } = useAgeVerified();
  const [registered, setRegisteredState] = useState(
    () => !!getToken() || localStorage.getItem('mansion_registered') === 'true'
  );
  const [user, setUserState] = useState(() => getStoredUser());
  const [bootstrapUnread, setBootstrapUnread] = useState(null);
  const [bootstrapResolved, setBootstrapResolved] = useState(() => !getToken());
  const [siteSettings, setSiteSettings] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('mansion_site_settings') || '{}'); } catch { return {}; }
  });
  const bootstrapStartedRef = useRef(false);

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
    if (bootstrapStartedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      localStorage.setItem('mansion_registered', 'true');
      setRegisteredState(true);
      window.history.replaceState({}, '', '/');
    }

    let cancelled = false;
    let detachVisibilityListener = null;

    const hasSessionSettings = !!siteSettings && Object.keys(siteSettings).length > 0;
    const hasAuthToken = !!getToken();

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
        setBootstrapResolved(true);

        if (data?.settings) {
          setSiteSettings(data.settings);
          try { sessionStorage.setItem('mansion_site_settings', JSON.stringify(data.settings)); } catch {}
        }
      }).catch(() => {
        setBootstrapUnread(null);
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
  }, [setUser, siteSettings]);

  return (
    <BrowserRouter>
      <AuthContext.Provider value={{ registered, setRegistered, user, setUser, siteSettings, setSiteSettings }}>
      <UnreadProvider initialUnread={bootstrapUnread} bootstrapResolved={bootstrapResolved}>
      <div className="relative min-h-screen">
        {!verified && <AgeVerificationModal onVerify={verify} />}
        <AppLayout />
        <InstallAppBanner />
        <ApiDebugOverlay />
      </div>
      </UnreadProvider>
      </AuthContext.Provider>
    </BrowserRouter>
  );
}
