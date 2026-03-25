import { NavLink, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Settings, Users, Home, Shield, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../App';
import { useEffect } from 'react';

const ADMIN_NAV = [
  { to: '/admin/usuarios', icon: Users, label: 'Usuarios' },
  { to: '/admin/configuracion', icon: Settings, label: 'Configuración' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.is_admin) navigate('/');
  }, [user, navigate]);

  if (!user?.is_admin) return null;

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
        <nav className="flex-1 px-3 py-4 space-y-1">
          {ADMIN_NAV.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-sidebar-active"
                    className="absolute inset-0 bg-mansion-gold/10 border border-mansion-gold/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-3 w-full">
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-mansion-gold' : 'text-text-muted group-hover:text-text-primary'}`} />
                  <span className={`text-sm transition-colors ${isActive ? 'text-mansion-gold font-semibold' : 'text-text-muted group-hover:text-text-primary'}`}>
                    {label}
                  </span>
                </div>
              </NavLink>
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
              {ADMIN_NAV.map(({ to, icon: Icon, label }) => {
                const isActive = location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-mansion-gold/10 text-mansion-gold' : 'text-text-muted'}`}
                  >
                    {label}
                  </Link>
                );
              })}
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
