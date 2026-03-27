import { useState, createContext, useContext, useCallback, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import WelcomePage from './pages/WelcomePage';
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
import { getToken, getStoredUser, setToken, setStoredUser, clearAuth, getAppBootstrap } from './lib/api';
import { UnreadProvider } from './hooks/useUnreadMessages';
import InstallAppBanner from './components/InstallAppBanner';

const VideoLabPage = lazy(() => import('./pages/admin/VideoLabPage'));

// Pages that don't show navbar/bottomnav (full-screen flows)
const FULLSCREEN_PATHS = ['/bienvenida', '/registro', '/login', '/mensajes/', '/vip', '/monedas', '/pago-exitoso', '/pago-fallido', '/pago-pendiente', '/pago-monedas-exitoso', '/admin/', '/historia/'];

// Auth context — exposes registered boolean + user object + setters
const AuthContext = createContext({
  registered: false,
  user: null,
  siteSettings: {},
  setRegistered: () => {},
  setUser: () => {},
  setSiteSettings: () => {},
});
export function useAuth() {
  return useContext(AuthContext);
}

function RequireRegistration({ children }) {
  const { registered } = useAuth();
  if (!registered) return <Navigate to="/bienvenida" replace />;
  return children;
}

function AppLayout() {
  const location = useLocation();
  const isFullscreen =
    FULLSCREEN_PATHS.some((p) => location.pathname.startsWith(p)) ||
    FULLSCREEN_PATHS.includes(location.pathname);
  const isChatDetail = location.pathname.match(/^\/mensajes\/.+$/);
  const showChrome = !isFullscreen && !isChatDetail;

  return (
    <>
      {showChrome && <DesktopSidebar />}
      {showChrome && <Navbar />}

      <div className={showChrome ? 'lg:pl-64 xl:pl-72' : ''}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
        <Suspense
          fallback={(
            <div className="min-h-screen bg-mansion-base flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
            </div>
          )}
        >
        <Routes location={location}>
          {/* Full-screen flows */}
          <Route path="/bienvenida" element={<WelcomePage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />

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
        </Suspense>
        </motion.div>
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
  const [siteSettings, setSiteSettings] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('mansion_site_settings') || '{}'); } catch { return {}; }
  });

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      localStorage.setItem('mansion_registered', 'true');
      setRegisteredState(true);
      window.history.replaceState({}, '', '/');
    }

    let cancelled = false;

    getAppBootstrap().then(data => {
      if (cancelled) return;

      if (data?.user) {
        setUser(data.user);
        setRegisteredState(true);
      }

      if (data?.settings) {
        setSiteSettings(data.settings);
        try { sessionStorage.setItem('mansion_site_settings', JSON.stringify(data.settings)); } catch {}
      }
    }).catch(() => {
      if (cancelled || !getToken()) return;
      clearAuth();
      setUserState(null);
      setRegisteredState(false);
    });

    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return (
    <BrowserRouter>
      <AuthContext.Provider value={{ registered, setRegistered, user, setUser, siteSettings, setSiteSettings }}>
      <UnreadProvider>
      <div className="relative min-h-screen">
        {!verified && <AgeVerificationModal onVerify={verify} />}
        <AppLayout />
        <InstallAppBanner />
      </div>
      </UnreadProvider>
      </AuthContext.Provider>
    </BrowserRouter>
  );
}
