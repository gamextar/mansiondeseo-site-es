import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Camera, Heart, Shield, LogOut, ChevronRight, Crown, Plus, X, Image, Ghost, Eye, EyeOff, Users, Gift, Filter } from 'lucide-react';
import { useAuth } from '../App';
import { logout as apiLogout, uploadImage, deletePhoto, getMe, updateProfile, getVisits, getReceivedGifts } from '../lib/api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Justo ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { setRegistered, setUser, user } = useAuth();
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [togglingGhost, setTogglingGhost] = useState(false);
  const [visitors, setVisitors] = useState([]);
  const [receivedGifts, setReceivedGifts] = useState([]);
  const [feedFilter, setFeedFilter] = useState(() => localStorage.getItem('mansion_feed_filter') || 'all');
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  useEffect(() => {
    getVisits().then(data => setVisitors(data.visitors || [])).catch(() => {});
    if (user?.id) {
      getReceivedGifts(user.id).then(data => setReceivedGifts(data.gifts || [])).catch(() => {});
    }
  }, [user?.id]);

  // Auto-save reordered photos
  const persistOrder = useCallback(async (newPhotos) => {
    setUser(prev => prev ? { ...prev, photos: newPhotos } : prev);
    try {
      await updateProfile({ photos: newPhotos });
    } catch {
      // Silently fail — local state already updated
    }
  }, [setUser]);

  const handleDragStart = useCallback((i, e) => {
    dragItem.current = i;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((i, e) => {
    e.preventDefault();
    dragOverItem.current = i;
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const from = dragItem.current;
    const to = dragOverItem.current;
    dragItem.current = null;
    dragOverItem.current = null;
    if (from === null || to === null || from === to) return;
    const next = [...(user?.photos || [])];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    persistOrder(next);
  }, [user?.photos, persistOrder]);

  // Touch drag support
  const touchState = useRef({ index: null, el: null, clone: null, moved: false });

  const handleTouchStart = useCallback((i, e) => {
    const el = e.currentTarget;
    touchState.current = { index: i, el, clone: null, moved: false, timer: null };
    // Long-press to start drag (300ms)
    touchState.current.timer = setTimeout(() => {
      const touch = e.touches?.[0] || e.changedTouches?.[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      const clone = el.cloneNode(true);
      clone.style.cssText = `position:fixed;z-index:999;width:${rect.width}px;height:${rect.height}px;pointer-events:none;opacity:0.8;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);`;
      clone.style.left = `${rect.left}px`;
      clone.style.top = `${rect.top}px`;
      document.body.appendChild(clone);
      touchState.current.clone = clone;
      touchState.current.startX = touch.clientX;
      touchState.current.startY = touch.clientY;
      touchState.current.originLeft = rect.left;
      touchState.current.originTop = rect.top;
      touchState.current.moved = true;
      el.style.opacity = '0.3';
    }, 300);
  }, []);

  const handleTouchMove = useCallback((e) => {
    const ts = touchState.current;
    if (!ts.clone) return;
    e.preventDefault();
    const touch = e.touches[0];
    ts.clone.style.left = `${ts.originLeft + (touch.clientX - ts.startX)}px`;
    ts.clone.style.top = `${ts.originTop + (touch.clientY - ts.startY)}px`;
    const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = elUnder?.closest('[data-drag-idx]');
    if (cell) dragOverItem.current = Number(cell.dataset.dragIdx);
  }, []);

  const handleTouchEnd = useCallback(() => {
    const ts = touchState.current;
    if (ts.timer) clearTimeout(ts.timer);
    if (ts.clone) {
      ts.clone.remove();
      if (ts.el) ts.el.style.opacity = '';
      const from = ts.index;
      const to = dragOverItem.current;
      dragOverItem.current = null;
      if (from !== null && to !== null && from !== to) {
        const next = [...(user?.photos || [])];
        const [removed] = next.splice(from, 1);
        next.splice(to, 0, removed);
        persistOrder(next);
      }
    }
    touchState.current = { index: null, el: null, clone: null, moved: false };
  }, [user?.photos, persistOrder]);

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
      if (data?.user) {
        setUser({ ...user, ...data.user });
      }
    } catch (err) {
      console.error('Ghost mode toggle error:', err);
    } finally {
      setTogglingGhost(false);
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
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-mansion-gold to-mansion-gold-light p-[2px] mx-auto cursor-pointer hover:opacity-80 transition-opacity"
            >
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

          {/* Coins balance */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mansion-gold/10 border border-mansion-gold/20">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#C9A84C" stroke="#A88A3D" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="7" fill="none" stroke="#A88A3D" strokeWidth="0.75" />
              <text x="12" y="16" textAnchor="middle" fill="#8B7332" fontSize="10" fontWeight="bold" fontFamily="serif">$</text>
            </svg>
            <span className="text-sm font-bold text-mansion-gold">{user?.coins ?? 0}</span>
            <span className="text-xs text-mansion-gold/60">monedas</span>
          </div>
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
              <div
                key={url}
                data-drag-idx={i}
                draggable={photos.length > 1}
                onDragStart={(e) => handleDragStart(i, e)}
                onDragOver={(e) => handleDragOver(i, e)}
                onDrop={handleDrop}
                onTouchStart={(e) => handleTouchStart(i, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative group aspect-square rounded-xl overflow-hidden bg-mansion-card border border-mansion-border/30 cursor-grab active:cursor-grabbing"
              >
                <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />
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

        {/* Received Gifts */}
        {receivedGifts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-4 h-4 text-mansion-gold" />
              <h3 className="text-sm font-semibold text-text-primary">Regalos recibidos</h3>
              <span className="text-xs text-text-dim">({receivedGifts.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {receivedGifts.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-mansion-card/50 border border-mansion-border/20"
                  title={`De ${g.sender_name}`}
                >
                  <span className="text-lg">{g.gift_emoji}</span>
                  <div className="text-xs">
                    <p className="text-text-primary font-medium">{g.gift_name}</p>
                    <p className="text-text-dim">de {g.sender_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visitas (mobile only — desktop shows in sidebar) */}
        {visitors.length > 0 && (
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-mansion-gold" />
              <h3 className="text-sm font-semibold text-text-primary">Visitas recientes</h3>
              <span className="text-xs text-text-dim">({visitors.length})</span>
            </div>
            <div className="space-y-2">
              {visitors.map((v) => (
                <button
                  key={v.id}
                  onClick={() => navigate(`/perfiles/${v.id}`, { state: { preview: { id: v.id, name: v.name, age: v.age, city: v.city, role: v.role, photos: [], avatar_url: v.avatar_url, online: v.online, premium: v.premium } } })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-mansion-card/50 hover:bg-mansion-card transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-mansion-elevated overflow-hidden flex-shrink-0">
                    {v.avatar_url ? (
                      <img src={v.avatar_url} alt={v.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-dim">
                        <Camera className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{v.name}</p>
                    <p className="text-xs text-text-dim truncate">
                      Te visitó {timeAgo(v.visited_at).toLowerCase()}
                    </p>
                  </div>
                  {v.online && (
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                  )}
                  <ChevronRight className="w-4 h-4 text-text-dim flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu items */}
        <div className="space-y-1.5">

          {/* Feed filter preference */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2.5 px-1">
              <Filter className="w-4 h-4 text-mansion-gold" />
              <h3 className="text-sm font-semibold text-text-primary">Mostrar en inicio</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'Todos', emoji: '✨' },
                { id: 'swinger', label: 'Swinger', emoji: '🔄' },
                { id: 'trios', label: 'Tríos', emoji: '🔥' },
                { id: 'cuckold', label: 'Cuckold', emoji: '👀' },
                { id: 'fetiche', label: 'Fetiche', emoji: '⛓️' },
                { id: 'pareja', label: 'Parejas', emoji: '💑' },
                { id: 'mujer', label: 'Mujeres', emoji: '👩' },
                { id: 'hombre', label: 'Hombres', emoji: '👨' },
              ].map(f => {
                const isActive = feedFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => { setFeedFilter(f.id); localStorage.setItem('mansion_feed_filter', f.id); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-mansion-gold/15 text-mansion-gold border border-mansion-gold/40'
                        : 'bg-mansion-card border border-mansion-border/50 text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span>{f.emoji}</span>
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {[
            { icon: Settings, label: 'Configuración', sublabel: 'Privacidad, notificaciones', path: '/configuracion' },
            { icon: Heart, label: 'Mis favoritos', sublabel: 'Perfiles guardados', path: '/favoritos' },
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

          {/* VIP Status / Hacerse VIP */}
          {user?.premium ? (
            <div className="pt-6 border-t border-mansion-border/20 mt-4 space-y-2">
              <button
                onClick={() => navigate('/vip')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-mansion-gold/10 border border-mansion-gold/30 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-mansion-gold/20 text-mansion-gold flex items-center justify-center">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-mansion-gold">VIP activo</p>
                  <p className="text-xs text-text-dim">Disfrutás de todos los beneficios</p>
                </div>
              </button>

              {/* Ghost / Incognito mode toggle */}
              <button
                onClick={handleToggleGhostMode}
                disabled={togglingGhost}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-mansion-card/50 hover:bg-mansion-card border border-mansion-border/20 transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.ghost_mode ? 'bg-purple-500/20 text-purple-400' : 'bg-mansion-elevated text-text-muted'}`}>
                  {user.ghost_mode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-medium ${user.ghost_mode ? 'text-purple-400' : 'text-text-primary'}`}>Modo Incógnito</p>
                  <p className="text-xs text-text-dim">{user.ghost_mode ? 'Tu perfil está oculto' : 'Visitá perfiles sin ser visto'}</p>
                </div>
                <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${user.ghost_mode ? 'bg-purple-500' : 'bg-mansion-border/40'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${user.ghost_mode ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>
          ) : (
            <div className="pt-6 border-t border-mansion-border/20 mt-4">
              <button
                onClick={() => navigate('/vip')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-mansion-gold/20 to-mansion-gold/10 border border-mansion-gold/30 hover:from-mansion-gold/30 hover:to-mansion-gold/20 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-mansion-gold/20 text-mansion-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-mansion-gold">Hacete VIP</p>
                  <p className="text-xs text-text-dim">Mensajes ilimitados, fotos y más</p>
                </div>
                <ChevronRight className="w-4 h-4 text-mansion-gold" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
