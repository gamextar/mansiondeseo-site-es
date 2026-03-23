import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
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
import WelcomePage from './pages/WelcomePage';
import ProfilePage from './pages/ProfilePage';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function AnimatedPage({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

// Pages that don't show navbar/bottomnav (full-screen flows)
const FULLSCREEN_PATHS = ['/bienvenida', '/registro', '/login', '/mensajes/'];

function RequireRegistration({ children }) {
  const isRegistered = localStorage.getItem('mansion_registered') === 'true';
  if (!isRegistered) return <Navigate to="/bienvenida" replace />;
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
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Full-screen flows */}
          <Route path="/bienvenida" element={<WelcomePage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Chat detail (full-screen but with custom header) */}
          <Route
            path="/mensajes/:id"
            element={
              <AnimatedPage>
                <ChatPage />
              </AnimatedPage>
            }
          />

          {/* Standard layout pages (require registration) */}
          <Route
            path="/"
            element={
              <RequireRegistration>
                <AnimatedPage>
                  <FeedPage />
                </AnimatedPage>
              </RequireRegistration>
            }
          />
          <Route
            path="/explorar"
            element={
              <RequireRegistration>
                <AnimatedPage>
                  <ExplorePage />
                </AnimatedPage>
              </RequireRegistration>
            }
          />
          <Route
            path="/perfiles/:id"
            element={
              <RequireRegistration>
                <AnimatedPage>
                  <ProfileDetailPage />
                </AnimatedPage>
              </RequireRegistration>
            }
          />
          <Route
            path="/mensajes"
            element={
              <RequireRegistration>
                <AnimatedPage>
                  <ChatListPage />
                </AnimatedPage>
              </RequireRegistration>
            }
          />
          <Route
            path="/perfil"
            element={
              <RequireRegistration>
                <AnimatedPage>
                  <ProfilePage />
                </AnimatedPage>
              </RequireRegistration>
            }
          />
        </Routes>
      </AnimatePresence>
      </div>

      {showChrome && <BottomNav />}
    </>
  );
}

export default function App() {
  const { verified, verify } = useAgeVerified();

  return (
    <BrowserRouter>
      <div className="relative min-h-screen">
        {!verified && <AgeVerificationModal onVerify={verify} />}
        <AppLayout />
      </div>
    </BrowserRouter>
  );
}
