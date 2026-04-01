import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, Camera, Heart, Shield, LogOut, ChevronRight, Crown, Plus, X, Image, Eye, EyeOff, Users, Gift, Filter, Move, MapPin, ExternalLink, Film } from 'lucide-react';
import { useAuth } from '../App';
import { logout as apiLogout, uploadImage, deletePhoto, getMe, getStories, updateProfile, getVisits, getReceivedGifts, deleteOwnStory } from '../lib/api';
import ImageCropper from '../components/ImageCropper';
import AvatarImg from '../components/AvatarImg';
import { getDisplayPhotos, getGalleryPhotos } from '../lib/profileMedia';

const ROLE_COLOR = {
  Pareja: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  'Hombre Solo': 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  'Mujer Sola': 'bg-pink-500/15 text-pink-300 border-pink-500/25',
};

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [.25,.46,.45,.94] } },
};

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
  const [cropFile, setCropFile] = useState(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [adjustUrl, setAdjustUrl] = useState(null);
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
    const next = [...getGalleryPhotos(user)];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    persistOrder(next);
  }, [user, persistOrder]);

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
        const next = [...getGalleryPhotos(user)];
        const [removed] = next.splice(from, 1);
        next.splice(to, 0, removed);
        persistOrder(next);
      }
    }
    touchState.current = { index: null, el: null, clone: null, moved: false };
  }, [user, persistOrder]);

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    setRegistered(false);
    navigate('/bienvenida');
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setCropFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCroppedAvatar = async (croppedFile) => {
    setCropFile(null);
    try {
      const data = await uploadImage(croppedFile, { purpose: 'avatar' });
      setUser(prev => prev ? { ...prev, avatar_url: data.url, avatar_crop: null } : prev);
    } catch {
      // Silently fail — user can retry
    }
  };

  const handleAvatarPosition = async (crop) => {
    try {
      const data = await updateProfile({ avatar_crop: crop });
      if (data?.user) {
        setUser(data.user);
      } else {
        setUser(prev => prev ? { ...prev, avatar_crop: crop } : prev);
      }
      setAdjustUrl(null);
    } catch (err) {
      console.error('Avatar position save error:', err);
    }
  };

  const handleAvatarTap = () => {
    if (avatarUrl) {
      setShowAvatarMenu(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const data = await uploadImage(file, { purpose: 'gallery' });
        setUser(prev => prev ? { ...prev, photos: [...getGalleryPhotos(prev), data.url] } : prev);
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
  const photos = getGalleryPhotos(user);
  const displayPhotos = getDisplayPhotos(user);
  const ownProfilePreview = user ? {
    id: user.id,
    name: user.username,
    age: user.age,
    city: user.city,
    role: user.role,
    photos,
    avatar_url: user.avatar_url || '',
    avatar_crop: user.avatar_crop || null,
    online: user.online,
    premium: user.premium,
    verified: user.verified,
    blurred: false,
    visiblePhotos: displayPhotos.length,
    ghost_mode: user.ghost_mode,
    isOwnProfile: true,
  } : null;

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-navbar">
      {cropFile && (
        <ImageCropper
          file={cropFile}
          onCrop={handleCroppedAvatar}
          onCancel={() => setCropFile(null)}
        />
      )}

      {adjustUrl && (
        <ImageCropper
          imageUrl={adjustUrl}
          positionOnly
          initialPosition={user?.avatar_crop}
          onPosition={handleAvatarPosition}
          onCancel={() => setAdjustUrl(null)}
        />
      )}

      {/* Avatar action menu */}
      {showAvatarMenu && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center" onClick={() => setShowAvatarMenu(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm mx-4 mb-8 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-mansion-card/95 backdrop-blur-xl border border-mansion-border/30 rounded-2xl overflow-hidden">
              <button
                onClick={() => { setShowAvatarMenu(false); fileInputRef.current?.click(); }}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-text-primary hover:bg-mansion-elevated/50 transition-colors"
              >
                <Camera className="w-4.5 h-4.5 text-mansion-gold" />
                <span className="text-sm font-medium">Cambiar foto</span>
              </button>
              <div className="h-px bg-mansion-border/20 mx-4" />
              <button
                onClick={() => { setShowAvatarMenu(false); setAdjustUrl(avatarUrl); }}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-text-primary hover:bg-mansion-elevated/50 transition-colors"
              >
                <Move className="w-4.5 h-4.5 text-mansion-gold" />
                <span className="text-sm font-medium">Ajustar posición</span>
              </button>
            </div>
            <button
              onClick={() => setShowAvatarMenu(false)}
              className="w-full mt-2 py-3.5 rounded-2xl bg-mansion-card/95 backdrop-blur-xl border border-mansion-border/30 text-sm font-semibold text-text-muted hover:bg-mansion-elevated/50 transition-colors"
            >
              Cancelar
            </button>
          </motion.div>
        </div>
      )}

      <motion.div
        initial="initial"
        animate="animate"
        variants={stagger}
        className="px-4 lg:px-8 pt-4 lg:pt-6 max-w-2xl lg:mx-auto"
      >
        {/* ── Hero Section ── */}
        <motion.div variants={fadeUp} className="flex flex-col items-center mb-8">
          <div className="relative">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
              onClick={handleAvatarTap}
              className="w-28 h-28 rounded-full bg-gradient-to-br from-mansion-gold to-mansion-gold-light p-[2.5px] cursor-pointer hover:shadow-glow-gold transition-shadow"
            >
              <div className="w-full h-full rounded-full bg-mansion-card flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <AvatarImg src={avatarUrl} crop={user?.avatar_crop} alt="Mi perfil" className="w-full h-full" />
                ) : (
                  <Camera className="w-9 h-9 text-text-dim" />
                )}
              </div>
            </motion.div>
            <button
              onClick={handleAvatarTap}
              className="absolute -bottom-0.5 -right-0.5 w-9 h-9 rounded-full bg-mansion-crimson text-white flex items-center justify-center shadow-lg ring-4 ring-mansion-base"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarSelect} />
          </div>

          <motion.h2
            variants={fadeUp}
            className="font-display text-2xl font-bold text-text-primary mt-5 cursor-pointer hover:text-mansion-gold transition-colors"
            onClick={() => user?.id && navigate(`/perfiles/${user.id}`, { state: ownProfilePreview ? { preview: ownProfilePreview } : undefined })}
          >
            {displayName}
          </motion.h2>

          <motion.div variants={fadeUp} className="flex items-center gap-2 mt-1.5">
            {displayCity && (
              <span className="flex items-center gap-1 text-sm text-text-muted">
                <MapPin className="w-3.5 h-3.5" /> {displayCity}
              </span>
            )}
            {displayRole && (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${ROLE_COLOR[displayRole] || 'bg-mansion-card text-text-muted border-mansion-border/30'}`}>
                {displayRole}
              </span>
            )}
          </motion.div>

          {/* Coins pill */}
          <motion.div variants={fadeUp} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-mansion-gold/10 border border-mansion-gold/20">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#C9A84C" stroke="#A88A3D" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="7" fill="none" stroke="#A88A3D" strokeWidth="0.75" />
              <text x="12" y="16" textAnchor="middle" fill="#8B7332" fontSize="10" fontWeight="bold" fontFamily="serif">$</text>
            </svg>
            <span className="text-sm font-bold text-mansion-gold">{user?.coins ?? 0}</span>
            <span className="text-xs text-mansion-gold/60">monedas</span>
          </motion.div>

          {/* View public profile link */}
          <motion.button
            variants={fadeUp}
            onClick={() => user?.id && navigate(`/perfiles/${user.id}`, { state: ownProfilePreview ? { preview: ownProfilePreview } : undefined })}
            className="mt-3 flex items-center gap-1.5 text-xs text-text-dim hover:text-mansion-gold transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Ver perfil público
          </motion.button>

          {/* Upload story button */}
          <motion.button
            variants={fadeUp}
            onClick={() => navigate('/historia/nueva')}
            className="mt-4 inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-mansion-crimson/10 border border-mansion-crimson/25 text-mansion-crimson font-semibold text-sm hover:bg-mansion-crimson/20 transition-colors"
          >
            <Film className="w-4 h-4" />
            Subir Historia
          </motion.button>
          {user?.has_active_story && (
            <motion.button
              variants={fadeUp}
              onClick={async () => {
                if (!confirm('¿Eliminar tu historia actual?')) return;
                try {
                  const storiesData = await getStories({ limit: 100 });
                  const currentStory = (storiesData.stories || []).find((story) => story.user_id === user?.id);

                  if (currentStory?.id) {
                    await deleteOwnStory(currentStory.id);
                  }

                  const me = await getMe().catch(() => null);
                  if (me?.user) {
                    setUser({ ...me.user, has_active_story: false });
                  } else {
                    setUser(prev => prev ? { ...prev, has_active_story: false } : prev);
                  }
                } catch { /* best-effort */ }
              }}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 font-semibold text-sm hover:bg-red-500/20 transition-colors"
            >
              <X className="w-4 h-4" />
              Eliminar Historia
            </motion.button>
          )}
        </motion.div>

        {/* ── Stats Row ── */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-px mb-8 rounded-2xl overflow-hidden bg-mansion-border/10">
          {[
            { value: photos.length, label: 'Fotos', icon: Image },
            { value: receivedGifts.length, label: 'Regalos', icon: Gift },
            { value: visitors.length, label: 'Visitas', icon: Users },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center py-4 bg-mansion-card/40">
              <Icon className="w-4 h-4 text-mansion-gold/60 mb-1" />
              <span className="text-xl font-bold text-text-primary font-display">{value}</span>
              <span className="text-[10px] uppercase tracking-wider text-text-dim mt-0.5">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Gallery ── */}
        <motion.div variants={fadeUp} className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Mi Galería</h3>
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs text-mansion-gold hover:text-mansion-gold-light transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {uploading ? 'Subiendo...' : 'Agregar'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {photos.map((url, i) => (
              <motion.div
                key={url}
                data-drag-idx={i}
                draggable={photos.length > 1}
                onDragStart={(e) => handleDragStart(i, e)}
                onDragOver={(e) => handleDragOver(i, e)}
                onDrop={handleDrop}
                onTouchStart={(e) => handleTouchStart(i, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="relative group aspect-square rounded-2xl overflow-hidden bg-mansion-card border border-mansion-border/20 cursor-grab active:cursor-grabbing"
              >
                <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover pointer-events-none transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
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
              </motion.div>
            ))}
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-2xl border-2 border-dashed border-mansion-border/30 hover:border-mansion-gold/40 flex flex-col items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Plus className="w-5 h-5 text-text-dim" />
              <span className="text-[10px] text-text-dim">Foto</span>
            </button>
          </div>

          <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleGalleryUpload} />
        </motion.div>

        {/* ── Received Gifts ── */}
        {receivedGifts.length > 0 && (
          <motion.div variants={fadeUp} className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Regalos recibidos
            </h3>
            <div className="flex flex-wrap gap-2">
              {receivedGifts.map((g, i) => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-mansion-card/40 border border-mansion-border/15"
                  title={`De ${g.sender_name}`}
                >
                  <span className="text-xl">{g.gift_emoji}</span>
                  <div className="text-xs">
                    <p className="text-text-primary font-medium">{g.gift_name}</p>
                    <p className="text-text-dim">de {g.sender_name}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Recent Visitors (mobile only) ── */}
        {visitors.length > 0 && (
          <motion.div variants={fadeUp} className="mb-8 lg:hidden">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Visitas recientes
            </h3>
            <div className="space-y-1.5">
              {visitors.map((v, i) => (
                <motion.button
                  key={v.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/perfiles/${v.id}`, { state: { preview: { id: v.id, name: v.name, age: v.age, city: v.city, role: v.role, photos: [], avatar_url: v.avatar_url, avatar_crop: v.avatar_crop || null, online: v.online, premium: v.premium } } })}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-mansion-card/30 hover:bg-mansion-card/60 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-mansion-elevated overflow-hidden flex-shrink-0">
                    {v.avatar_url ? (
                      <AvatarImg src={v.avatar_url} crop={v.avatar_crop} alt={v.name} className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-dim">
                        <Camera className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{v.name}</p>
                    <p className="text-xs text-text-dim truncate">Te visitó {timeAgo(v.visited_at).toLowerCase()}</p>
                  </div>
                  {v.online && <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0 animate-pulse-slow" />}
                  <ChevronRight className="w-4 h-4 text-text-dim flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Feed Filter ── */}
        <motion.div variants={fadeUp} className="mb-8 glass-elevated rounded-3xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-mansion-gold" />
            Mostrar en inicio
          </h3>
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
                      : 'bg-mansion-card/60 border border-mansion-border/30 text-text-muted hover:text-text-primary hover:border-mansion-border/50'
                  }`}
                >
                  <span>{f.emoji}</span>
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Account Section ── */}
        <motion.div variants={fadeUp} className="glass-elevated rounded-3xl p-4 mb-4 space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">Mi Cuenta</h3>
          {[
            { icon: Settings, label: 'Configuración', sublabel: 'Privacidad, notificaciones', path: '/configuracion' },
            { icon: Heart, label: 'Mis favoritos', sublabel: 'Perfiles guardados', path: '/favoritos' },
            { icon: Shield, label: 'Verificación', sublabel: 'Verificar mi identidad', path: null },
          ].map(({ icon: Icon, label, sublabel, path }) => (
            <button
              key={label}
              onClick={() => path && navigate(path)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03] transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-mansion-elevated/60 flex items-center justify-center text-text-muted group-hover:text-mansion-gold transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-text-primary">{label}</p>
                <p className="text-xs text-text-dim">{sublabel}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-dim group-hover:text-text-muted transition-colors" />
            </button>
          ))}
        </motion.div>

        {/* ── VIP Section ── */}
        <motion.div variants={fadeUp} className="glass-elevated rounded-3xl p-4 mb-4 space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">Membresía</h3>
          {user?.premium ? (
            <>
              <button
                onClick={() => navigate('/vip')}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-mansion-gold/8 border border-mansion-gold/20 transition-all hover:bg-mansion-gold/12"
              >
                <div className="w-10 h-10 rounded-xl bg-mansion-gold/15 text-mansion-gold flex items-center justify-center">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-mansion-gold">VIP activo</p>
                  <p className="text-xs text-text-dim">Disfrutás de todos los beneficios</p>
                </div>
              </button>

              <button
                onClick={handleToggleGhostMode}
                disabled={togglingGhost}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03] transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.ghost_mode ? 'bg-purple-500/15 text-purple-400' : 'bg-mansion-elevated/60 text-text-muted'}`}>
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
            </>
          ) : (
            <button
              onClick={() => navigate('/vip')}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-mansion-gold/15 to-mansion-gold/5 border border-mansion-gold/25 hover:from-mansion-gold/25 hover:to-mansion-gold/10 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-mansion-gold/15 text-mansion-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                <Crown className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-mansion-gold">Hacete VIP</p>
                <p className="text-xs text-text-dim">Mensajes ilimitados, fotos y más</p>
              </div>
              <ChevronRight className="w-4 h-4 text-mansion-gold" />
            </button>
          )}
        </motion.div>

        {/* ── Logout ── */}
        <motion.div variants={fadeUp} className="pt-2 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl text-mansion-crimson/70 hover:text-mansion-crimson hover:bg-mansion-crimson/5 transition-all"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span className="text-sm font-medium">Cerrar sesión</span>
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
