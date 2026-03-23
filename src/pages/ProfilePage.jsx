import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Camera, Heart, Shield, LogOut, ChevronRight, Crown } from 'lucide-react';
import { useAuth } from '../App';
import { logout as apiLogout, uploadImage } from '../lib/api';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { setRegistered, setUser, user } = useAuth();
  const fileInputRef = useRef(null);

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    setRegistered(false);
    navigate('/bienvenida');
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await uploadImage(file);
      // Refresh user data
      setUser(prev => prev ? { ...prev, avatar_url: data.url } : prev);
    } catch {
      // Silently fail — user can retry
    }
  };

  // Use real user data or fallback
  const displayName = user?.username || 'Tu Perfil';
  const displayCity = user?.city || '';
  const displayRole = user?.role || '';
  const avatarUrl = user?.avatar_url || 'https://picsum.photos/seed/myprofile/200/200';

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-16">
      <div className="px-4 lg:px-8 pt-4 lg:pt-6 max-w-2xl lg:mx-auto">
        {/* Profile header */}
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-mansion-gold to-mansion-gold-light p-[2px] mx-auto">
              <div className="w-full h-full rounded-full bg-mansion-card flex items-center justify-center overflow-hidden">
                <img
                  src={avatarUrl}
                  alt="Mi perfil"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-mansion-crimson text-white flex items-center justify-center"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          <h2 className="font-display text-xl font-bold text-text-primary mt-4">{displayName}</h2>
          <p className="text-text-muted text-sm">{[displayCity, displayRole].filter(Boolean).join(' · ')}</p>

          {/* Premium banner */}
          <div
            className="mt-4 mx-auto max-w-xs bg-gradient-to-r from-mansion-gold/10 to-mansion-gold/5 border border-mansion-gold/20 rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-mansion-gold" />
              <span className="font-display font-semibold text-mansion-gold text-sm">Mansión VIP</span>
            </div>
            <p className="text-text-muted text-xs mb-3">Mensajes ilimitados, perfiles sin blur y badge exclusivo</p>
            <button className="btn-gold w-full py-2.5 rounded-xl text-sm">
              Desbloquear VIP
            </button>
          </div>
        </div>

        {/* Menu items */}
        <div className="space-y-1.5">
          {[
            { icon: Settings, label: 'Configuración', sublabel: 'Privacidad, notificaciones' },
            { icon: Heart, label: 'Mis favoritos', sublabel: '12 perfiles guardados' },
            { icon: Shield, label: 'Verificación', sublabel: 'Verificar mi identidad' },
          ].map(({ icon: Icon, label, sublabel }) => (
            <button
              key={label}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-mansion-card/50 hover:bg-mansion-card transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-mansion-elevated flex items-center justify-center text-text-muted group-hover:text-mansion-gold transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-text-primary">{label}</p>
                <p className="text-xs text-text-dim">{sublabel}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-dim" />
            </button>
          ))}

          <div className="pt-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-mansion-crimson/5 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-mansion-crimson/10 flex items-center justify-center text-mansion-crimson">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-mansion-crimson">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
