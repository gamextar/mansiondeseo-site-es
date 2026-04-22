import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, Camera, Heart, Shield, LogOut, ChevronLeft, ChevronRight, Crown, Plus, X, Image, Eye, EyeOff, Users, Gift, Filter, Move, MapPin, ExternalLink, Film, Pencil } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { getBrowserBottomNavOffset, getStandaloneBottomNavOffset } from '../lib/bottomNavConfig';
import { logout as apiLogout, uploadImage, deletePhoto, getMe, getStories, updateProfile, getOwnProfileDashboard, deleteOwnStory, invalidateProfilesCache } from '../lib/api';
import ImageCropper from '../components/ImageCropper';
import AvatarImg from '../components/AvatarImg';
import StoryPreviewOverlay from '../components/StoryPreviewOverlay';
import { formatLocation } from '../lib/location';
import { getDisplayPhotos, getGalleryPhotos } from '../lib/profileMedia';
import { resolveMediaUrl } from '../lib/media';

const ROLE_COLOR = {
  Pareja: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  'Pareja de Hombres': 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  'Pareja de Mujeres': 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25',
  Trans: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
  'Hombre Solo': 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  'Mujer Sola': 'bg-pink-500/15 text-pink-300 border-pink-500/25',
};

const ROLE_LABELS = {
  hombre: 'Hombre Solo',
  mujer: 'Mujer Sola',
  pareja: 'Pareja',
  pareja_hombres: 'Pareja de Hombres',
  pareja_mujeres: 'Pareja de Mujeres',
  trans: 'Trans',
};

const SEEKING_OPTIONS = [
  { id: 'hombre', label: 'Hombres', emoji: '👨', color: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
  { id: 'mujer', label: 'Mujeres', emoji: '👩', color: 'bg-pink-500/15 text-pink-300 border-pink-500/40' },
  { id: 'pareja', label: 'Parejas', emoji: '💑', color: 'bg-purple-500/15 text-purple-300 border-purple-500/40' },
  { id: 'pareja_hombres', label: 'Pareja de Hombres', emoji: '👬', color: 'bg-sky-500/15 text-sky-300 border-sky-500/40' },
  { id: 'pareja_mujeres', label: 'Pareja de Mujeres', emoji: '👭', color: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40' },
  { id: 'trans', label: 'Trans', emoji: '⚧', color: 'bg-teal-500/15 text-teal-300 border-teal-500/40' },
];

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [.25,.46,.45,.94] } },
};

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

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
  const isStandaloneMobileApp = detectStandaloneMobile();
  const navBottomOffset = isStandaloneMobileApp
    ? getStandaloneBottomNavOffset()
    : getBrowserBottomNavOffset();
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
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [galleryEditing, setGalleryEditing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxScrollRef = useRef(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const lbZoomRef = useRef(1);
  const lbPanRef = useRef({ x: 0, y: 0 });
  const lbPinchRef = useRef({ startDist: 0, startZoom: 1, active: false });
  const lbDragRef = useRef({ startX: 0, startY: 0, startPanX: 0, startPanY: 0, active: false });
  const [showStoryPreview, setShowStoryPreview] = useState(false);
  const lbLastTapRef = useRef(0);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 });
    lbZoomRef.current = 1; lbPanRef.current = { x: 0, y: 0 };
  }, []);

  const handleLightboxScroll = useCallback(() => {
    const el = lightboxScrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    setLightboxIndex(idx);
  }, []);

  const handleLbTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lbPinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: lbZoomRef.current, active: true };
    } else if (e.touches.length === 1 && lbZoomRef.current > 1) {
      lbDragRef.current = {
        startX: e.touches[0].clientX, startY: e.touches[0].clientY,
        startPanX: lbPanRef.current.x, startPanY: lbPanRef.current.y, active: true
      };
    }
  }, []);

  const handleLbTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && lbPinchRef.current.active) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const z = Math.max(1, Math.min((dist / lbPinchRef.current.startDist) * lbPinchRef.current.startZoom, 5));
      lbZoomRef.current = z;
      setLightboxZoom(z);
      if (z <= 1) { lbPanRef.current = { x: 0, y: 0 }; setLightboxPan({ x: 0, y: 0 }); }
    } else if (e.touches.length === 1 && lbDragRef.current.active && lbZoomRef.current > 1) {
      e.preventDefault();
      const px = lbDragRef.current.startPanX + (e.touches[0].clientX - lbDragRef.current.startX);
      const py = lbDragRef.current.startPanY + (e.touches[0].clientY - lbDragRef.current.startY);
      lbPanRef.current = { x: px, y: py };
      setLightboxPan({ x: px, y: py });
    }
  }, []);

  const handleLbTouchEnd = useCallback((e) => {
    lbPinchRef.current.active = false;
    lbDragRef.current.active = false;
    // Double-tap to toggle zoom
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      const now = Date.now();
      if (now - lbLastTapRef.current < 300) {
        if (lbZoomRef.current > 1) {
          lbZoomRef.current = 1; lbPanRef.current = { x: 0, y: 0 };
          setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 });
        } else {
          lbZoomRef.current = 2.5;
          setLightboxZoom(2.5);
        }
      }
      lbLastTapRef.current = now;
    }
  }, []);

  useEffect(() => {
    if (lightboxOpen && lightboxScrollRef.current) {
      lightboxScrollRef.current.scrollTo({ left: lightboxIndex * lightboxScrollRef.current.offsetWidth, behavior: 'instant' });
    }
    setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 });
    lbZoomRef.current = 1; lbPanRef.current = { x: 0, y: 0 };
  }, [lightboxOpen, lightboxIndex]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') setLightboxIndex(prev => Math.min(prev + 1, (getGalleryPhotos(user) || []).length - 1));
      if (e.key === 'ArrowLeft') setLightboxIndex(prev => Math.max(prev - 1, 0));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, user]);

  useEffect(() => {
    if (!user?.id) return;
    getOwnProfileDashboard().then(data => {
      setVisitors(data.visitors || []);
      setReceivedGifts(data.gifts || []);
    }).catch(() => {});
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
    navigate('/login', { replace: true });
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
      const nextAvatarUrl = data?.avatar_url || data?.url || '';
      if (nextAvatarUrl) {
        setUser(prev => prev ? { ...prev, avatar_url: nextAvatarUrl, avatar_crop: null } : prev);
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
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
  const displayLocation = formatLocation(user);
  const displayRole = ROLE_LABELS[user?.role] || user?.role || '';
  const avatarUrl = user?.avatar_url || '';
  const photos = getGalleryPhotos(user);
  const displayPhotos = getDisplayPhotos(user);
  const ownProfilePreview = user ? {
    id: user.id,
    name: user.username,
    age: user.age,
    city: user.city,
    province: user.province,
    locality: user.locality,
    role: displayRole,
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
    <div className="min-h-mobile-browser-screen bg-mansion-base pb-mobile-legacy-nav lg:pb-8 pt-navbar lg:pt-0">
      <div className="h-6 lg:hidden" />
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
        className="px-3 lg:px-8 pt-6 lg:pt-6 max-w-2xl lg:mx-auto"
      >
        {/* ── Hero Section ── */}
        <motion.div variants={fadeUp} className="mb-4">
          {/* Avatar + info row */}
          <div className="flex items-center gap-4 mb-3">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`rounded-full p-[3px] ${user?.has_active_story ? 'bg-gradient-to-tr from-emerald-400 via-emerald-500 to-emerald-400' : 'bg-gradient-to-br from-mansion-gold/50 to-mansion-gold-light/30'}`}>
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
                  onClick={handleAvatarTap}
                  className="w-20 h-20 rounded-full bg-mansion-base p-[2.5px] cursor-pointer"
                >
                  <div className="w-full h-full rounded-full bg-mansion-card flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <AvatarImg src={avatarUrl} crop={user?.avatar_crop} alt="Mi perfil" className="w-full h-full" />
                    ) : (
                      <Camera className="w-7 h-7 text-text-dim" />
                    )}
                  </div>
                </motion.div>
              </div>
              <button
                onClick={handleAvatarTap}
                className="absolute -bottom-0 -right-0 w-6 h-6 rounded-full bg-mansion-crimson text-white flex items-center justify-center shadow-lg ring-2 ring-mansion-base"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarSelect} />
            </div>

            {/* Name + meta + actions */}
            <div className="flex-1 min-w-0">
              <h2
                className="font-display text-xl font-bold text-text-primary cursor-pointer hover:text-mansion-gold transition-colors leading-tight truncate"
                onClick={() => user?.id && navigate(`/perfiles/${user.id}`, { state: ownProfilePreview ? { preview: ownProfilePreview } : undefined })}
              >
                {displayName}
              </h2>

              {(displayLocation || displayRole) && (
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {displayLocation && (
                    <span className="flex items-center gap-0.5 text-[11px] text-text-dim">
                      <MapPin className="w-2.5 h-2.5" /> {displayLocation}
                    </span>
                  )}
                  {displayLocation && displayRole && <span className="text-text-dim/30 text-[11px]">·</span>}
                  {displayRole && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${ROLE_COLOR[displayRole] || 'bg-mansion-card text-text-muted border-mansion-border/30'}`}>
                      {displayRole}
                    </span>
                  )}
                </div>
              )}

              {/* Coins + quick link */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-mansion-gold/10 border border-mansion-gold/20">
                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="#C9A84C" stroke="#A88A3D" strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="7" fill="none" stroke="#A88A3D" strokeWidth="0.75" />
                    <text x="12" y="16" textAnchor="middle" fill="#8B7332" fontSize="10" fontWeight="bold" fontFamily="serif">$</text>
                  </svg>
                  <span className="text-[11px] font-bold text-mansion-gold">{user?.coins ?? 0}</span>
                </div>
                <button
                  onClick={() => user?.id && navigate(`/perfiles/${user.id}`, { state: ownProfilePreview ? { preview: ownProfilePreview } : undefined })}
                  className="flex items-center gap-1 text-[11px] text-text-dim hover:text-mansion-gold transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver perfil
                </button>
              </div>
            </div>
          </div>

          {/* Action pills row */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/historia/nueva', { state: { from: '/perfil' } })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mansion-crimson/10 border border-mansion-crimson/25 text-[11px] font-medium text-mansion-crimson hover:bg-mansion-crimson/20 transition-all"
            >
              <Film className="w-3 h-3" />
              {user?.has_active_story ? 'Ver / nueva historia' : 'Subir historia'}
            </button>

            {user?.has_active_story && (
              <button
                onClick={async () => {
                  if (!confirm('¿Eliminar tu historia actual?')) return;
                  try {
                    const storiesData = await getStories({ limit: 50 });
                    const currentStory = (storiesData.stories || []).find((story) => story.user_id === user?.id);
                    if (currentStory?.id) await deleteOwnStory(currentStory.id);
                    const me = await getMe().catch(() => null);
                    if (me?.user) {
                      setUser({ ...me.user, has_active_story: false });
                    } else {
                      setUser(prev => prev ? { ...prev, has_active_story: false } : prev);
                    }
                  } catch { /* best-effort */ }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 hover:bg-red-500/15 transition-all"
              >
                <X className="w-3 h-3" />
                Eliminar historia
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Stats Row ── */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-px mb-5 rounded-2xl overflow-hidden bg-mansion-border/10">
          {[
            { value: photos.length, label: 'Fotos', icon: Image },
            { value: receivedGifts.length, label: 'Regalos', icon: Gift },
            { value: visitors.length, label: 'Visitas', icon: Users },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center py-3.5 bg-mansion-card/40">
              <Icon className="w-3.5 h-3.5 text-mansion-gold/50 mb-1" />
              <span className="text-lg font-bold text-text-primary font-display">{value}</span>
              <span className="text-[10px] uppercase tracking-wider text-text-dim mt-0.5">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Gallery ── */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Mi Galería</h3>
            <div className="flex items-center gap-2">
              {galleryEditing && (
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 text-xs text-mansion-gold hover:text-mansion-gold-light transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {uploading ? 'Subiendo...' : 'Agregar'}
                </button>
              )}
              <button
                onClick={() => setGalleryEditing(prev => !prev)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  galleryEditing
                    ? 'text-mansion-gold hover:text-mansion-gold-light'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                {galleryEditing ? 'Listo' : 'Editar'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {photos.map((url, i) => (
              <motion.div
                key={url}
                data-drag-idx={i}
                draggable={galleryEditing && photos.length > 1}
                onDragStart={galleryEditing ? (e) => handleDragStart(i, e) : undefined}
                onDragOver={galleryEditing ? (e) => handleDragOver(i, e) : undefined}
                onDrop={galleryEditing ? handleDrop : undefined}
                onTouchStart={galleryEditing ? (e) => handleTouchStart(i, e) : undefined}
                onTouchMove={galleryEditing ? handleTouchMove : undefined}
                onTouchEnd={galleryEditing ? handleTouchEnd : undefined}
                onClick={galleryEditing ? undefined : () => { setLightboxIndex(i); setLightboxOpen(true); }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`relative group aspect-square rounded-2xl overflow-hidden bg-mansion-card border border-mansion-border/20 ${
                  galleryEditing ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                }`}
              >
                <img src={resolveMediaUrl(url)} alt={`Foto ${i + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover pointer-events-none transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                {galleryEditing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePhoto(url); }}
                    disabled={deleting === url}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center lg:opacity-0 lg:group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {deleting === url ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                )}
              </motion.div>
            ))}
            {galleryEditing && (
              <button
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-2xl border-2 border-dashed border-mansion-border/30 hover:border-mansion-gold/40 flex flex-col items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Plus className="w-5 h-5 text-text-dim" />
                <span className="text-[10px] text-text-dim">Foto</span>
              </button>
            )}
          </div>

          <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleGalleryUpload} />
        </motion.div>

        {/* ── Received Gifts ── */}
        {receivedGifts.length > 0 && (
          <motion.div variants={fadeUp} className="mb-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-dim mb-3">
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
          <motion.div variants={fadeUp} className="mb-6 lg:hidden">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-dim mb-3">
              Visitas recientes
            </h3>
            <div className="space-y-1.5">
              {visitors.map((v, i) => (
                <motion.button
                  key={v.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/perfiles/${v.id}`, { state: { preview: { id: v.id, name: v.name, age: v.age, city: v.city, province: v.province, locality: v.locality, role: v.role, photos: [], avatar_url: v.avatar_url, avatar_crop: v.avatar_crop || null, online: v.online, premium: v.premium } } })}
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

        {/* ── Busco (seeking) ── */}
        <motion.div variants={fadeUp} className="mb-6 glass-elevated rounded-3xl p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-dim mb-3 flex items-center gap-1.5">
            <Heart className="w-3 h-3 text-mansion-crimson/70" />
            Busco
          </h3>
          <div className="flex flex-wrap gap-2">
            {SEEKING_OPTIONS.map(s => {
              const seekingArr = Array.isArray(user?.seeking) ? user.seeking : (user?.seeking ? [user.seeking] : []);
              const isActive = seekingArr.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={async () => {
                    let newSeeking;
                    if (isActive) {
                      newSeeking = seekingArr.filter(x => x !== s.id);
                      if (newSeeking.length === 0) return; // must keep at least 1
                    } else {
                      newSeeking = [...seekingArr, s.id];
                    }
                    // Optimistic update
                    setUser(prev => prev ? { ...prev, seeking: newSeeking } : prev);
                    // Mark feed as dirty so it reloads with new seeking
                    invalidateProfilesCache();
                    try { sessionStorage.setItem('mansion_feed_dirty', '1'); localStorage.removeItem('mansion_feed'); } catch {}
                    try {
                      await updateProfile({ seeking: newSeeking });
                    } catch {
                      // Revert on error
                      setUser(prev => prev ? { ...prev, seeking: seekingArr } : prev);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? s.color
                      : 'bg-mansion-card/60 border border-mansion-border/30 text-text-muted hover:text-text-primary hover:border-mansion-border/50'
                  } ${isActive ? 'border' : ''}`}
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="mb-6 glass-elevated rounded-3xl p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-dim mb-1.5 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-mansion-gold/70" />
            Bloquear Mensajes De
          </h3>
          <p className="text-[10px] text-text-dim mb-3">Si seleccionas opciones, esos roles no podrán iniciarte chat.</p>
          <div className="flex flex-wrap gap-2">
            {SEEKING_OPTIONS.map((option) => {
              const currentBlocked = Array.isArray(user?.message_block_roles) ? user.message_block_roles : [];
              const isActive = currentBlocked.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={async () => {
                    const previous = Array.isArray(user?.message_block_roles) ? user.message_block_roles : [];
                    const nextBlocked = isActive
                      ? previous.filter((value) => value !== option.id)
                      : [...previous, option.id];
                    setUser(prev => prev ? { ...prev, message_block_roles: nextBlocked } : prev);
                    try {
                      await updateProfile({ message_block_roles: nextBlocked });
                    } catch {
                      setUser(prev => prev ? { ...prev, message_block_roles: previous } : prev);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-mansion-gold/15 text-mansion-gold border border-mansion-gold/40'
                      : 'bg-mansion-card/60 border border-mansion-border/30 text-text-muted hover:text-text-primary hover:border-mansion-border/50'
                  }`}
                >
                  <span>{option.emoji}</span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Mis Intereses (secondary, for feed priority) ── */}
        <motion.div variants={fadeUp} className="mb-6 glass-elevated rounded-3xl p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-dim mb-1.5 flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-mansion-gold/70" />
            Mis Intereses
          </h3>
          <p className="text-[10px] text-text-dim mb-3">Seleccioná tus intereses para ver primero perfiles afines</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'swinger', label: 'Swinger', emoji: '🔄' },
              { id: 'trios', label: 'Tríos', emoji: '🔥' },
              { id: 'cuckold', label: 'Cuckold', emoji: '👀' },
              { id: 'fetiche', label: 'Fetiches', emoji: '⛓️' },
              { id: 'voyeur', label: 'Voyeur', emoji: '🕶️' },
              { id: 'bdsm', label: 'BDSM', emoji: '🖤' },
              { id: 'exhib', label: 'Exhibicionismo', emoji: '✨' },
              { id: 'roleplay', label: 'Roleplay', emoji: '🎭' },
            ].map(interest => {
              const userInterests = Array.isArray(user?.interests) ? user.interests : [];
              const isActive = userInterests.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  onClick={async () => {
                    const current = Array.isArray(user?.interests) ? user.interests : [];
                    const newInterests = isActive
                      ? current.filter(x => x !== interest.id)
                      : [...current, interest.id];
                    setUser(prev => prev ? { ...prev, interests: newInterests } : prev);
                    // Mark feed as dirty so it reloads with new interest priority
                    invalidateProfilesCache();
                    try { sessionStorage.setItem('mansion_feed_dirty', '1'); localStorage.removeItem('mansion_feed'); } catch {}
                    try {
                      await updateProfile({ interests: newInterests });
                    } catch {
                      setUser(prev => prev ? { ...prev, interests: current } : prev);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-mansion-gold/15 text-mansion-gold border border-mansion-gold/40'
                      : 'bg-mansion-card/60 border border-mansion-border/30 text-text-muted hover:text-text-primary hover:border-mansion-border/50'
                  }`}
                >
                  <span>{interest.emoji}</span>
                  <span>{interest.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Account Section ── */}
        <motion.div variants={fadeUp} className="glass-elevated rounded-3xl p-4 mb-3 space-y-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-dim mb-2 px-1">Mi Cuenta</h3>
          {[
            { icon: Settings, label: 'Configuración', sublabel: 'Privacidad, notificaciones', path: user?.is_admin ? '/admin/configuracion' : null },
            { icon: Heart, label: 'Seguidores', sublabel: 'Seguidores y siguiendo', path: '/seguidores' },
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
        <motion.div variants={fadeUp} className="glass-elevated rounded-3xl p-4 mb-3 space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-dim mb-2 px-1">Membresía</h3>
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

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-[100] bg-black" onClick={closeLightbox}>
          {/* Close button – top-right, matching story upload style */}
          <button
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            className="absolute z-30 flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            style={{ top: 'max(env(safe-area-inset-top, 12px), 12px)', right: 16 }}
          >
            <X className="w-5 h-5 lg:w-6 lg:h-6" />
          </button>

          {/* Counter badge – top-left */}
          {photos.length > 1 && (
            <div
              className="absolute z-20 flex items-center justify-center px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-sm"
              style={{ top: 'max(env(safe-area-inset-top, 12px), 12px)', left: 16 }}
            >
              <span className="text-sm font-medium text-white/80">
                {lightboxIndex + 1} / {photos.length}
              </span>
            </div>
          )}

          {/* Image area with pinch-to-zoom */}
          <div className="absolute inset-0 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div
              ref={lightboxScrollRef}
              onScroll={handleLightboxScroll}
              className="flex-1 flex overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
              style={{
                scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
                overflowX: lightboxZoom > 1 ? 'hidden' : 'auto',
              }}
            >
              {photos.map((url, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 snap-start flex items-center justify-center overflow-hidden"
                  style={{ width: '100%', minWidth: '100%', height: '100%', touchAction: lightboxZoom > 1 ? 'none' : 'pan-x' }}
                  onTouchStart={handleLbTouchStart}
                  onTouchMove={handleLbTouchMove}
                  onTouchEnd={handleLbTouchEnd}
                >
                  <img
                    src={resolveMediaUrl(url)}
                    alt={`Foto ${i + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain select-none"
                    draggable={false}
                    style={i === lightboxIndex ? {
                      transform: `scale(${lightboxZoom}) translate(${lightboxPan.x / lightboxZoom}px, ${lightboxPan.y / lightboxZoom}px)`,
                      transition: lbPinchRef.current.active || lbDragRef.current.active ? 'none' : 'transform 0.2s ease-out',
                    } : undefined}
                  />
                </div>
              ))}
            </div>

            {/* Dots pagination */}
            {photos.length > 1 && (
              <div className="flex justify-center gap-1.5 pb-6 pt-2">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIndex(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === lightboxIndex ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop arrows */}
          {photos.length > 1 && (
            <>
              {lightboxIndex > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev - 1); }}
                  className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-colors z-10"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
              )}
              {lightboxIndex < photos.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev + 1); }}
                  className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-colors z-10"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showStoryPreview && user?.active_story_url && (
        <div className="fixed inset-0 z-50 bg-black lg:left-64 xl:left-72 lg:bg-mansion-base">
          <div className="relative w-full h-full lg:h-[calc(100%-32px)] lg:max-w-[520px] lg:mx-auto lg:my-4 lg:rounded-2xl lg:overflow-hidden">
            <StoryPreviewOverlay
              videoUrl={user.active_story_url}
              user={user}
              navBottomOffset={navBottomOffset}
              onDismiss={() => setShowStoryPreview(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
