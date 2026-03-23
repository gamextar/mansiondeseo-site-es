import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { getConversations } from '../lib/api';

export default function Navbar() {
  const location = useLocation();
  const isChat = location.pathname.startsWith('/mensajes');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    getConversations()
      .then((convos) => {
        const total = (convos || []).reduce((sum, c) => sum + (c.unread || 0), 0);
        setUnreadCount(total);
      })
      .catch(() => {});
  }, [location.pathname]);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 safe-top lg:left-64 xl:left-72"
    >
      <div className="glass border-b border-mansion-border/30">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo — hidden on desktop (sidebar has its own) */}
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
              <span className="font-display text-white text-sm font-bold">M</span>
            </div>
            <span className="font-display text-lg font-semibold text-gradient-gold hidden sm:inline">
              Mansión Deseo
            </span>
            <span className="font-display text-lg font-semibold text-gradient-gold sm:hidden">
              Mansión
            </span>
          </Link>
          {/* Desktop left spacer when logo hidden */}
          <div className="hidden lg:block" />

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Notifications */}
            <button className="relative w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-mansion-gold hover:bg-mansion-elevated/50 transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-mansion-crimson animate-pulse-slow" />
            </button>

            {/* Messages */}
            <Link
              to="/mensajes"
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isChat
                  ? 'text-mansion-gold bg-mansion-gold/10'
                  : 'text-text-muted hover:text-mansion-gold hover:bg-mansion-elevated/50'
              }`}
            >
              <MessageCircle className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-mansion-crimson text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </Link>

            {/* Avatar */}
            <Link to="/perfil" className="ml-1">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-mansion-gold to-mansion-gold-light p-[2px]">
                <div className="w-full h-full rounded-full bg-mansion-card flex items-center justify-center">
                  <span className="text-mansion-gold text-xs font-bold">TÚ</span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
