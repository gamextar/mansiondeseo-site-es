import { useState, createContext, useContext, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
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

// Pages that don't show navbar/bottomnav (full-screen flows)
const FULLSCREEN_PATHS = ['/bienvenida', '/registro', '/login', '/mensajes/'];

// Auth context so child pages (Register, Login, Profile) can update registration state
const AuthContext = createContext({ registered: false, setRegistered: () => {} });
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
    FULLSCREEN_PATHS.some((p) => location.pathname.startsWith(p) && p.endsWith('/')) ||
    FULLSCREEN_PATHS.includes(location.pathname);
  const isChatDetail = location.pathname.match(/^\/mensajes\/.+$/);
  const showChrome = !isFullscreen && !isChatDetail;

  return (
    <>
      {showChrome && <DesktopSidebar />}
      {showChrome && <Navbar />}

      <div className={showChrome ? 'lg:pl-64 xl:pl-72' : ''}>
        <Routes location={location}>
          {/* Full-screen flows */}
          <Route path="/bienvenida" element={<WelcomePage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />

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
        </Routes>
      </div>

      {showChrome && <BottomNav />}
    </>
  );
}

export default function App() {
  const { verified, verify } = useAgeVerified();
  const [registered, setRegisteredState] = useState(
    () => localStorage.getItem('mansion_registered') === 'true'
  );

  const setRegistered = useCallback((val) => {
    if (val) {
      localStorage.setItem('mansion_registered', 'true');
    } else {
      localStorage.removeItem('mansion_registered');
    }
    setRegisteredState(val);
  }, []);

  return (
    <BrowserRouter>
      <AuthContext.Provider value={{ registered, setRegistered }}>
      <div className="relative min-h-screen">
        {!verified && <AgeVerificationModal onVerify={verify} />}
        <AppLayout />
      </div>
      </AuthContext.Provider>
    </BrowserRouter>
  );
}
