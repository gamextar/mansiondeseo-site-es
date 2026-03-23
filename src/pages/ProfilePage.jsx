import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Camera, Heart, Shield, LogOut, ChevronRight, Crown, Plus, X, Image, Ghost, Eye, EyeOff, Bug } from 'lucide-react';
import { useAuth } from '../App';
import { logout as apiLogout, uploadImage, deletePhoto, getMe, updateProfile } from '../lib/api';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { setRegistered, setUser, user } = useAuth();
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [togglingGhost, setTogglingGhost] = useState(false);
  const [togglingPremium, setTogglingPremium] = useState(false);

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
      setUser(prev => prev ? { ...prev, avatar_url: data.url, photos: [...(prev.photos || []), data.url] } : prev);
    } catch {
      // Silently fail — user can retry
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const data = await uploadImage(file);
        setUser(prev => prev ? { ...prev, photos: [...(prev.photos || []), data.url] } : prev);
      }
    } catch {
      // Partial upload ok
    } finally {
      setUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (url) => {
    if (deleting) return;
    setDeleting(url);
    try {
      const data = await deletePhoto(url);
      setUser(prev => prev ? { ...prev, photos: data.photos, avatar_url: data.avatar_url } : prev);
    } catch {
      // Silently fail
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleGhostMode = async () => {
    if (togglingGhost || !user?.premium) return;
    setTogglingGhost(true);
    try {
      const data = await updateProfile({ ghost_mode: !user.ghost_mode });
      setUser(prev => prev ? { ...prev, ghost_mode: data.user.ghost_mode } : prev);
    } catch {
      // Silently fail
    } finally {
      setTogglingGhost(false);
    }
  };

  const handleTogglePremium = async () => {
    if (togglingPremium) return;
    setTogglingPremium(true);
    try {
      const newPremium = !user.premium;
      const fields = { premium: newPremium };
      if (!newPremium) fields.ghost_mode = false;
      const data = await updateProfile(fields);
      setUser(prev => prev ? { ...prev, premium: data.user.premium, ghost_mode: data.user.ghost_mode } : prev);
    } catch {
      // Silently fail
    } finally {
      setTogglingPremium(false);
    }
  };

  // Use real user data or fallback
  const displayName = user?.username || 'Tu Perfil';
  const displayCity = user?.city || '';
  const displayRole = user?.role || '';
  const avatarUrl = user?.avatar_url || '';
  const photos = user?.photos || [];

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-16">
      <div className="px-4 lg:px-8 pt-4 lg:pt-6 max-w-2xl lg:mx-auto">
        {/* Profile header */}
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-mansion-gold to-mansion-gold-light p-[2px] mx-auto">
              <div className="w-full h-full rounded-full bg-mansion-card flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Mi perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-8 h-8 text-text-dim" />
                )}
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
          {user?.premium ? (
            <>
              <div
                className="mt-4 mx-auto max-w-xs bg-gradient-to-r from-mansion-gold/10 to-mansion-gold/5 border border-mansion-gold/20 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-5 h-5 text-mansion-gold" />
                  <span className="font-display font-semibold text-mansion-gold text-sm">Mansión VIP</span>
                </div>
                <p className="text-green-400 text-xs font-medium">Miembro activo</p>
              </div>

              {/* Ghost Mode Toggle */}
              <div className="mt-3 mx-auto max-w-xs">
                <button
                  onClick={handleToggleGhostMode}
                  disabled={togglingGhost}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${
                    user.ghost_mode
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'bg-mansion-card/50 border border-mansion-border/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    user.ghost_mode ? 'bg-purple-500/20 text-purple-400' : 'bg-mansion-elevated text-text-muted'
                  }`}>
                    {user.ghost_mode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-text-primary">Modo Fantasma</p>
                    <p className="text-xs text-text-dim">
                      {user.ghost_mode
                        ? 'Activo — tu perfil aparece borroso'
                        : 'Tu perfil es visible para todos'}
                    </p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors relative ${
                    user.ghost_mode ? 'bg-purple-500' : 'bg-mansion-border'
                  }`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      user.ghost_mode ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                </button>
              </div>
            </>
          ) : (
            <div
              className="mt-4 mx-auto max-w-xs bg-gradient-to-r from-mansion-gold/10 to-mansion-gold/5 border border-mansion-gold/20 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-mansion-gold" />
                <span className="font-display font-semibold text-mansion-gold text-sm">Mansión VIP</span>
              </div>
              <p className="text-text-muted text-xs mb-3">Mensajes ilimitados, fotos Full HD sin blur, Modo Fantasma y badge exclusivo</p>
              <button className="btn-gold w-full py-2.5 rounded-xl text-sm">
                Desbloquear VIP
              </button>
            </div>
          )}
        </div>

        {/* Gallery */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-mansion-gold" />
              <h3 className="text-sm font-semibold text-text-primary">Mi Galería</h3>
              <span className="text-xs text-text-dim">({photos.length})</span>
            </div>
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs text-mansion-gold hover:text-mansion-gold-light transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {uploading ? 'Subiendo...' : 'Agregar'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-mansion-card border border-mansion-border/30">
                <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleDeletePhoto(url)}
                  disabled={deleting === url}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center lg:opacity-0 lg:group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  {deleting === url ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-mansion-border/40 hover:border-mansion-gold/40 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
            >
              <Plus className="w-5 h-5 text-text-dim" />
              <span className="text-[10px] text-text-dim">Foto</span>
            </button>
          </div>

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleGalleryUpload}
          />
        </div>

        {/* Menu items */}
        <div className="space-y-1.5">
          {[
            { icon: Settings, label: 'Configuración', sublabel: 'Privacidad, notificaciones', path: '/configuracion' },
            { icon: Heart, label: 'Mis favoritos', sublabel: 'Perfiles guardados', path: '/explorar' },
            { icon: Shield, label: 'Verificación', sublabel: 'Verificar mi identidad', path: null },
          ].map(({ icon: Icon, label, sublabel, path }) => (
            <button
              key={label}
              onClick={() => path && navigate(path)}
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

          {/* Debug: Premium toggle */}
          <div className="pt-6 border-t border-mansion-border/20 mt-4">
            <p className="text-[10px] uppercase tracking-wider text-text-dim mb-2 flex items-center gap-1">
              <Bug className="w-3 h-3" /> Debug
            </p>
            <button
              onClick={handleTogglePremium}
              disabled={togglingPremium}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${
                user?.premium
                  ? 'bg-mansion-gold/10 border border-mansion-gold/30'
                  : 'bg-mansion-card/50 border border-mansion-border/30'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                user?.premium ? 'bg-mansion-gold/20 text-mansion-gold' : 'bg-mansion-elevated text-text-muted'
              }`}>
                <Crown className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-text-primary">Modo Premium</p>
                <p className="text-xs text-text-dim">
                  {user?.premium ? 'VIP activo' : 'Usuario gratuito'}
                </p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${
                user?.premium ? 'bg-mansion-gold' : 'bg-mansion-border'
              }`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  user?.premium ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
