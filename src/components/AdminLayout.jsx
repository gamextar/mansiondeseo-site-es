import { NavLink, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Users, Home, Shield, Film } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/authContext';
import { useEffect } from 'react';
import { ADMIN_SECTIONS } from '../lib/adminSections';

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.is_admin) navigate('/');
  }, [user, navigate]);

  if (!user?.is_admin) return null;

  const currentSection = new URLSearchParams(location.search).get('section') || '';
  const isUsersActive = location.pathname.startsWith('/admin/usuarios');
  const isConfigActive = location.pathname.startsWith('/admin/configuracion');
  const isVideoLabActive = location.pathname.startsWith('/admin/video-lab');

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 xl:w-72 z-40 flex-col bg-mansion-card/50 border-r border-mansion-border/30 backdrop-blur-xl">
        {/* Logo */}
        <div className="px-6 h-16 flex items-center gap-3 border-b border-mansion-border/20">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-display text-lg font-semibold text-gradient-gold block leading-tight">
              Admin Panel
            </span>
            <span className="text-[10px] text-text-dim">Mansión Deseo</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Usuarios */}
          <NavLink
            to="/admin/usuarios"
            className="relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
          >
            {isUsersActive && (
              <motion.div
                layoutId="admin-sidebar-active"
                className="absolute inset-0 bg-mansion-gold/10 border border-mansion-gold/20 rounded-xl"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <div className="relative z-10 flex items-center gap-3 w-full">
              <Users className={`w-5 h-5 transition-colors ${isUsersActive ? 'text-mansion-gold' : 'text-text-muted group-hover:text-text-primary'}`} />
              <span className={`text-sm transition-colors ${isUsersActive ? 'text-mansion-gold font-semibold' : 'text-text-muted group-hover:text-text-primary'}`}>
                Usuarios
              </span>
            </div>
          </NavLink>

          <NavLink
            to="/admin/video-lab"
            className="relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
          >
            {isVideoLabActive && (
              <motion.div
                layoutId="admin-sidebar-active"
                className="absolute inset-0 bg-mansion-gold/10 border border-mansion-gold/20 rounded-xl"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <div className="relative z-10 flex items-center gap-3 w-full">
              <Film className={`w-5 h-5 transition-colors ${isVideoLabActive ? 'text-mansion-gold' : 'text-text-muted group-hover:text-text-primary'}`} />
              <span className={`text-sm transition-colors ${isVideoLabActive ? 'text-mansion-gold font-semibold' : 'text-text-muted group-hover:text-text-primary'}`}>
                Video Lab
              </span>
            </div>
          </NavLink>

          {/* Configuración — section divider */}
          <div className="pt-3 pb-1 px-4">
            <span className="text-[10px] uppercase tracking-wider font-bold text-text-dim">Configuración</span>
          </div>

          {/* Section links */}
          {ADMIN_SECTIONS.map(({ key, label, icon: Icon }) => {
            const to = `/admin/configuracion?section=${key}`;
            const isActive = isConfigActive && (currentSection === key || (!currentSection && key === 'fotos'));
            return (
              <Link
                key={key}
                to={to}
                className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group"
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-sidebar-active"
                    className="absolute inset-0 bg-mansion-gold/10 border border-mansion-gold/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-3 w-full">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-mansion-gold' : 'text-text-muted group-hover:text-text-primary'}`} />
                  <span className={`text-[13px] transition-colors ${isActive ? 'text-mansion-gold font-semibold' : 'text-text-muted group-hover:text-text-primary'}`}>
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-text-dim hover:text-text-muted transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="text-xs">Volver al sitio</span>
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 lg:hidden">
        <div className="glass border-b border-mansion-border/30">
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-lg font-semibold text-gradient-gold">Admin</span>
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/admin/usuarios"
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${isUsersActive ? 'bg-mansion-gold/10 text-mansion-gold' : 'text-text-muted'}`}
              >
                Usuarios
              </Link>
              <Link
                to="/admin/configuracion"
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${isConfigActive ? 'bg-mansion-gold/10 text-mansion-gold' : 'text-text-muted'}`}
              >
                Config
              </Link>
              <Link
                to="/admin/video-lab"
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${isVideoLabActive ? 'bg-mansion-gold/10 text-mansion-gold' : 'text-text-muted'}`}
              >
                Video
              </Link>
              <Link to="/" className="ml-1 px-2 py-2 rounded-lg text-text-dim hover:text-text-muted">
                <Home className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 xl:ml-72 pt-14 lg:pt-0 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
