import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, Camera, Heart, Shield, LogOut, ChevronLeft, ChevronRight, Crown, Plus, X, Image, Eye, EyeOff, Users, Filter, Move, MapPin, ExternalLink, Film, Pencil } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { logout as apiLogout, uploadImage, deletePhoto, updateProfile, invalidateProfilesCache, getFavorites } from '../lib/api';
import ImageCropper from '../components/ImageCropper';
import AvatarImg from '../components/AvatarImg';
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

const ROLE_IMAGE_KEYS = {
  hombre: 'roleHombreImg',
  mujer: 'roleMujerImg',
  pareja: 'roleParejaImg',
  pareja_hombres: 'roleParejaHombresImg',
  pareja_mujeres: 'roleParejaMujeresImg',
  trans: 'roleTransImg',
};

const INTEREST_OPTIONS = [
  { id: 'swinger', label: 'Swinger', emoji: '🔄' },
  { id: 'trios', label: 'Tríos', emoji: '🔥' },
  { id: 'cuckold', label: 'Cuckold', emoji: '👀' },
  { id: 'fetiche', label: 'Fetiches', emoji: '⛓️' },
  { id: 'voyeur', label: 'Voyeur', emoji: '🕶️' },
  { id: 'bdsm', label: 'BDSM', emoji: '🖤' },
  { id: 'exhib', label: 'Exhibicionismo', emoji: '✨' },
  { id: 'roleplay', label: 'Roleplay', emoji: '🎭' },
];

const PROFILE_TABS = [
  { id: 'gallery', label: 'Galería', icon: Camera },
  { id: 'preferences', label: 'Preferencias', icon: Heart },
  { id: 'followers', label: 'Seguidores', icon: Users },
  { id: 'account', label: 'Cuenta', icon: Settings },
];

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [.25,.46,.45,.94] } },
};

const tabPanelMotion = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.28, ease: [.25,.46,.45,.94] } },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.16, ease: 'easeOut' } },
};

function RoleSelectorTile({ option, active, roleImage, tone = 'gold', onClick }) {
  const selectedClass = tone === 'danger'
    ? 'border-mansion-crimson/55 bg-mansion-crimson/14 text-white shadow-[0_18px_40px_rgba(212,24,61,0.12)]'
    : 'border-mansion-gold/55 bg-mansion-gold/12 text-white shadow-[0_18px_40px_rgba(201,168,76,0.12)]';

  return (
    <motion.button
      type="button"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group relative min-h-[132px] overflow-hidden rounded-[1.35rem] border p-3 text-left transition-all ${
        active
          ? selectedClass
          : 'border-mansion-border/25 bg-mansion-card/45 text-text-muted hover:border-mansion-gold/30 hover:bg-mansion-card/70 hover:text-text-primary'
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.05] to-transparent opacity-70" />
      <div className="relative flex h-full flex-col justify-between gap-3">
        <div className="flex justify-center">
          <div className={`flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-2xl border transition-transform group-hover:scale-[1.04] ${
            active ? 'border-white/15 bg-black/24' : 'border-white/8 bg-black/18'
          }`}>
            {roleImage ? (
              <img src={roleImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl">{option.emoji}</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold leading-tight">{option.label}</span>
          <span className={`h-2.5 w-2.5 rounded-full ${active ? (tone === 'danger' ? 'bg-mansion-crimson' : 'bg-mansion-gold') : 'bg-white/12'}`} />
        </div>
      </div>
    </motion.button>
  );
}

function FollowMiniCard({ profile, relation, onOpen }) {
  return (
    <motion.button
      type="button"
      layout
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      onClick={onOpen}
      className="group flex min-w-0 items-center gap-4 rounded-[1.4rem] border border-mansion-border/20 bg-mansion-card/42 p-3 text-left transition-all hover:border-mansion-gold/25 hover:bg-mansion-card/70"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-mansion-elevated">
        {profile.avatar_url ? (
          <AvatarImg src={profile.avatar_url} crop={profile.avatar_crop} alt={profile.name} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-dim">
            <Users className="h-5 w-5" />
          </div>
        )}
        {profile.online && <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.5)]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-text-primary group-hover:text-white">{profile.name}</p>
          {profile.age && <span className="text-xs text-text-dim">{profile.age}</span>}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-dim">{formatLocation(profile) || profile.role || relation}</p>
        <span className="mt-2 inline-flex rounded-full bg-mansion-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mansion-gold">
          {relation}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-dim transition-colors group-hover:text-mansion-gold" />
    </motion.button>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { setRegistered, setUser, user, siteSettings } = useAuth();
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [adjustUrl, setAdjustUrl] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [togglingGhost, setTogglingGhost] = useState(false);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const avatarUploadSeqRef = useRef(0);
  const avatarPreviewUrlRef = useRef(null);
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
  const [activeTab, setActiveTab] = useState('gallery');
  const [followTab, setFollowTab] = useState('followers');
  const [followProfiles, setFollowProfiles] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followersError, setFollowersError] = useState('');
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
    if (!user?.id || activeTab !== 'followers') return;
    let cancelled = false;
    setFollowersLoading(true);
    setFollowersError('');
    getFavorites(followTab, 50)
      .then((data) => {
        if (cancelled) return;
        setFollowProfiles(data?.profiles || []);
        setFollowersCount(Number(data?.followersCount || 0));
        setFollowingCount(Number(data?.followingCount || 0));
      })
      .catch((err) => {
        if (!cancelled) setFollowersError(err?.message || 'No pudimos cargar seguidores');
      })
      .finally(() => {
        if (!cancelled) setFollowersLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeTab, followTab, user?.id]);

  useEffect(() => () => {
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
      avatarPreviewUrlRef.current = null;
    }
  }, []);

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
    window.location.href = '/';
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setCropFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCroppedAvatar = async (croppedFile) => {
    setCropFile(null);
    const uploadSeq = avatarUploadSeqRef.current + 1;
    avatarUploadSeqRef.current = uploadSeq;
    const previewUrl = URL.createObjectURL(croppedFile);
    const previousAvatarUrl = user?.avatar_url || '';
    if (avatarPreviewUrlRef.current) URL.revokeObjectURL(avatarPreviewUrlRef.current);
    avatarPreviewUrlRef.current = previewUrl;
    setUser(prev => prev ? { ...prev, avatar_url: previewUrl, avatar_crop: null } : prev);

    try {
      const data = await uploadImage(croppedFile, { purpose: 'avatar' });
      const nextAvatarUrl = data?.avatar_url || data?.url || '';
      if (nextAvatarUrl && avatarUploadSeqRef.current === uploadSeq) {
        setUser(prev => prev ? { ...prev, avatar_url: nextAvatarUrl, avatar_crop: null } : prev);
      }
    } catch (err) {
      if (avatarUploadSeqRef.current === uploadSeq) {
        setUser(prev => prev ? { ...prev, avatar_url: previousAvatarUrl, avatar_crop: null } : prev);
      }
      console.error('Avatar upload error:', err);
    } finally {
      if (avatarUploadSeqRef.current === uploadSeq && avatarPreviewUrlRef.current === previewUrl) {
        URL.revokeObjectURL(previewUrl);
        avatarPreviewUrlRef.current = null;
      }
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
  const roleImages = useMemo(() => {
    const settings = siteSettings || {};
    return SEEKING_OPTIONS.reduce((acc, option) => {
      acc[option.id] = settings[ROLE_IMAGE_KEYS[option.id]] || '';
      return acc;
    }, {});
  }, [siteSettings]);
  const seekingArr = Array.isArray(user?.seeking) ? user.seeking : (user?.seeking ? [user.seeking] : []);
  const blockedRoles = Array.isArray(user?.message_block_roles) ? user.message_block_roles : [];
  const userInterests = Array.isArray(user?.interests) ? user.interests : [];

  const openOwnPublicProfile = useCallback(() => {
    if (!user?.id) return;
    navigate(`/perfiles/${user.id}`, { state: ownProfilePreview ? { preview: ownProfilePreview } : undefined });
  }, [navigate, ownProfilePreview, user?.id]);

  const openFollowProfile = useCallback((profile) => {
    navigate(`/perfiles/${profile.id}`, {
      state: {
        preview: {
          id: profile.id,
          name: profile.name,
          age: profile.age,
          city: profile.city,
          province: profile.province,
          locality: profile.locality,
          role: profile.role,
          photos: [],
          avatar_url: profile.avatar_url,
          avatar_crop: profile.avatar_crop || null,
          online: profile.online,
          premium: profile.premium,
          verified: profile.verified,
        },
      },
    });
  }, [navigate]);

  const toggleSeekingRole = useCallback(async (roleId) => {
    const current = Array.isArray(user?.seeking) ? user.seeking : (user?.seeking ? [user.seeking] : []);
    const active = current.includes(roleId);
    const next = active ? current.filter((value) => value !== roleId) : [...current, roleId];
    if (next.length === 0) return;
    setUser(prev => prev ? { ...prev, seeking: next } : prev);
    invalidateProfilesCache();
    try { sessionStorage.setItem('mansion_feed_dirty', '1'); localStorage.removeItem('mansion_feed'); } catch {}
    try {
      await updateProfile({ seeking: next });
    } catch {
      setUser(prev => prev ? { ...prev, seeking: current } : prev);
    }
  }, [setUser, user?.seeking]);

  const toggleBlockedRole = useCallback(async (roleId) => {
    const current = Array.isArray(user?.message_block_roles) ? user.message_block_roles : [];
    const active = current.includes(roleId);
    const next = active ? current.filter((value) => value !== roleId) : [...current, roleId];
    setUser(prev => prev ? { ...prev, message_block_roles: next } : prev);
    try {
      await updateProfile({ message_block_roles: next });
    } catch {
      setUser(prev => prev ? { ...prev, message_block_roles: current } : prev);
    }
  }, [setUser, user?.message_block_roles]);

  const toggleInterest = useCallback(async (interestId) => {
    const current = Array.isArray(user?.interests) ? user.interests : [];
    const active = current.includes(interestId);
    const next = active ? current.filter((value) => value !== interestId) : [...current, interestId];
    setUser(prev => prev ? { ...prev, interests: next } : prev);
    invalidateProfilesCache();
    try { sessionStorage.setItem('mansion_feed_dirty', '1'); localStorage.removeItem('mansion_feed'); } catch {}
    try {
      await updateProfile({ interests: next });
    } catch {
      setUser(prev => prev ? { ...prev, interests: current } : prev);
    }
  }, [setUser, user?.interests]);

  return (
    <div className="min-h-mobile-browser-screen bg-mansion-base pb-mobile-legacy-nav lg:pb-8 pt-navbar lg:pt-0">
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
        className="w-full px-3 pt-6 lg:px-10 lg:pt-8"
      >
        {/* ── Profile Header ── */}
        <motion.div variants={fadeUp} className="-mx-3 mb-0.5 border-b border-mansion-border/15 bg-mansion-base/90 px-3 pb-3 pt-2 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl lg:-mx-10 lg:px-10 lg:pt-4">
          {/* Avatar + info row */}
          <div className="mb-[17px] flex items-center gap-4">
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

          <div className="-mx-1 overflow-x-auto scrollbar-hide rounded-2xl border border-mansion-border/20 bg-mansion-card/45 p-1.5">
            <div className="grid min-w-max grid-cols-4 gap-1 lg:min-w-0">
              {PROFILE_TABS.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`relative flex min-w-[112px] flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-xs font-semibold transition-all lg:min-w-0 lg:flex-row lg:gap-2 lg:text-sm ${
                      active ? 'text-mansion-base' : 'text-text-muted hover:bg-white/[0.04] hover:text-text-primary'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="profileTabActive"
                        className="absolute inset-0 rounded-xl bg-mansion-gold shadow-[0_14px_32px_rgba(201,168,76,0.18)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors lg:h-7 lg:w-7 ${
                      active ? 'bg-mansion-base/12' : 'bg-white/[0.04] text-mansion-gold/85'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="relative whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'gallery' && (
            <motion.section key="gallery" variants={tabPanelMotion} initial="initial" animate="animate" exit="exit" className="-mx-1">
              <div className="rounded-[2rem] border border-mansion-border/20 bg-mansion-card/35 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.18)] lg:p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-text-primary">Galería</h3>
                    <p className="mt-1 text-sm text-text-dim">Ordená tus fotos y suma contenido nuevo desde el mismo panel.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-2 rounded-full bg-mansion-gold px-4 py-2 text-xs font-bold text-mansion-base transition-all hover:brightness-110 disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      {uploading ? 'Subiendo...' : 'Subir foto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/historia/nueva', { state: { from: '/perfil' } })}
                      className="inline-flex items-center gap-2 rounded-full border border-mansion-crimson/35 bg-mansion-crimson/12 px-4 py-2 text-xs font-bold text-mansion-crimson transition-all hover:bg-mansion-crimson/18"
                    >
                      <Film className="h-4 w-4" />
                      Subir video
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryEditing(prev => !prev)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                        galleryEditing
                          ? 'border-mansion-gold/40 bg-mansion-gold/10 text-mansion-gold'
                          : 'border-mansion-border/25 bg-mansion-card/60 text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <Pencil className="h-4 w-4" />
                      {galleryEditing ? 'Listo' : 'Editar'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
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
                      layout
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.025 }}
                      className={`group relative aspect-[4/5] overflow-hidden rounded-[1.4rem] border border-mansion-border/20 bg-mansion-card ${
                        galleryEditing ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      }`}
                    >
                      <img src={resolveMediaUrl(url)} alt={`Foto ${i + 1}`} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      {galleryEditing && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeletePhoto(url); }}
                          disabled={deleting === url}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/62 text-white backdrop-blur transition-opacity disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100"
                        >
                          {deleting === url ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <X className="h-4 w-4" />}
                        </button>
                      )}
                    </motion.div>
                  ))}

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-[4/5] rounded-[1.4rem] border-2 border-dashed border-mansion-border/30 bg-mansion-card/25 p-4 text-text-dim transition-colors hover:border-mansion-gold/40 hover:text-mansion-gold disabled:opacity-50"
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                      <Plus className="h-6 w-6" />
                      <span className="text-xs font-semibold">{uploading ? 'Subiendo...' : 'Nueva foto'}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/historia/nueva', { state: { from: '/perfil' } })}
                    className="aspect-[4/5] rounded-[1.4rem] border border-mansion-crimson/25 bg-[radial-gradient(circle_at_top,rgba(212,24,61,0.2),transparent_60%),rgba(212,24,61,0.08)] p-4 text-mansion-crimson transition-colors hover:border-mansion-crimson/45 hover:bg-mansion-crimson/12"
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                      <Film className="h-7 w-7" />
                      <span className="text-xs font-bold">{user?.has_active_story ? 'Cambiar video' : 'Subir video'}</span>
                    </div>
                  </button>
                </div>
                <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleGalleryUpload} />
              </div>
            </motion.section>
          )}

          {activeTab === 'preferences' && (
            <motion.section key="preferences" variants={tabPanelMotion} initial="initial" animate="animate" exit="exit" className="-mx-1 space-y-4">
              <div className="grid items-start gap-4 xl:grid-cols-2">
                <div className="h-full rounded-[2rem] border border-mansion-border/20 bg-mansion-card/35 p-3 lg:p-4">
                  <div className="mb-3 min-h-[58px] lg:mb-4">
                    <h3 className="flex items-center gap-2 font-display text-2xl font-bold text-text-primary">
                      <Heart className="h-5 w-5 text-mansion-gold" />
                      Busco
                    </h3>
                    <p className="mt-1 text-sm text-text-dim">Elegí varios roles para ordenar tu feed por afinidad.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {SEEKING_OPTIONS.map((option) => (
                      <RoleSelectorTile
                        key={option.id}
                        option={option}
                        active={seekingArr.includes(option.id)}
                        roleImage={roleImages[option.id]}
                        onClick={() => toggleSeekingRole(option.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="h-full rounded-[2rem] border border-mansion-border/20 bg-mansion-card/35 p-3 lg:p-4">
                  <div className="mb-3 min-h-[58px] lg:mb-4">
                    <h3 className="flex items-center gap-2 font-display text-2xl font-bold text-text-primary">
                      <Shield className="h-5 w-5 text-mansion-crimson" />
                      Bloquear
                    </h3>
                    <p className="mt-1 text-sm text-text-dim">Los roles seleccionados no podrán iniciarte chat.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {SEEKING_OPTIONS.map((option) => (
                      <RoleSelectorTile
                        key={option.id}
                        option={option}
                        active={blockedRoles.includes(option.id)}
                        roleImage={roleImages[option.id]}
                        tone="danger"
                        onClick={() => toggleBlockedRole(option.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-mansion-border/20 bg-mansion-card/35 p-3 lg:p-4">
                <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                  <Filter className="h-3.5 w-3.5 text-mansion-gold" />
                  Intereses
                </h3>
                <p className="mb-4 text-xs text-text-dim">Estos intereses afinan el orden del feed después de tus preferencias principales.</p>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((interest) => {
                    const active = userInterests.includes(interest.id);
                    return (
                      <motion.button
                        key={interest.id}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => toggleInterest(interest.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all ${
                          active
                            ? 'border-mansion-gold/45 bg-mansion-gold/14 text-mansion-gold'
                            : 'border-mansion-border/25 bg-mansion-card/55 text-text-muted hover:border-mansion-gold/25 hover:text-text-primary'
                        }`}
                      >
                        <span>{interest.emoji}</span>
                        <span>{interest.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'followers' && (
            <motion.section key="followers" variants={tabPanelMotion} initial="initial" animate="animate" exit="exit" className="-mx-1 rounded-[2rem] border border-mansion-border/20 bg-mansion-card/35 p-3 lg:p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold text-text-primary">Seguidores</h3>
                  <p className="mt-1 text-sm text-text-dim">Tu red de seguidores y perfiles que estás siguiendo.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'followers', label: 'Seguidores', count: followersCount },
                    { id: 'following', label: 'Siguiendo', count: followingCount },
                  ].map((option) => {
                    const active = followTab === option.id;
                    return (
                      <button key={option.id} type="button" onClick={() => setFollowTab(option.id)} className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${active ? 'bg-mansion-gold text-mansion-base' : 'bg-mansion-card/65 text-text-muted hover:text-text-primary'}`}>
                        {option.label} <span className="tabular-nums opacity-70">{option.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {followersLoading ? (
                <div className="flex min-h-[240px] items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold" />
                </div>
              ) : followersError ? (
                <div className="mt-4 rounded-2xl border border-mansion-crimson/20 bg-mansion-crimson/8 p-4 text-sm text-red-300">{followersError}</div>
              ) : followProfiles.length === 0 ? (
                <div className="mt-4 rounded-[1.5rem] bg-mansion-card/45 p-10 text-center">
                  <Heart className="mx-auto mb-3 h-10 w-10 text-text-dim" />
                  <p className="text-sm text-text-dim">{followTab === 'followers' ? 'Todavía no tienes seguidores.' : 'Todavía no sigues a ningún perfil.'}</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {followProfiles.map((profile) => (
                    <FollowMiniCard key={`${followTab}-${profile.id}`} profile={profile} relation={followTab === 'followers' ? (profile.mutual_follow ? 'Mutuo' : 'Te sigue') : (profile.mutual_follow ? 'Mutuo' : 'Siguiendo')} onOpen={() => openFollowProfile(profile)} />
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {activeTab === 'account' && (
            <motion.section key="account" variants={tabPanelMotion} initial="initial" animate="animate" exit="exit" className="-mx-1 grid gap-6 xl:grid-cols-2">
              <div className="rounded-[2rem] border border-mansion-border/20 bg-mansion-card/35 p-4 lg:p-6">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-dim">Mi cuenta</h3>
                {[
                  { icon: Settings, label: 'Configuración', sublabel: 'Privacidad, notificaciones', path: user?.is_admin ? '/admin/configuracion' : null },
                  { icon: Shield, label: 'Verificación', sublabel: 'Verificar mi identidad', path: null },
                  { icon: ExternalLink, label: 'Ver perfil público', sublabel: 'Revisar cómo te ve la comunidad', action: openOwnPublicProfile },
                ].map(({ icon: Icon, label, sublabel, path, action }) => (
                  <button key={label} type="button" onClick={() => (action ? action() : path && navigate(path))} className="group flex w-full items-center gap-3 rounded-2xl p-3 transition-all hover:bg-white/[0.04]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mansion-elevated/60 text-text-muted transition-colors group-hover:text-mansion-gold">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-text-primary">{label}</p>
                      <p className="text-xs text-text-dim">{sublabel}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-dim" />
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div className="rounded-[2rem] border border-mansion-border/20 bg-mansion-card/35 p-4 lg:p-6">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-dim">Membresía</h3>
                  {user?.premium ? (
                    <>
                      <button type="button" onClick={() => navigate('/vip')} className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-mansion-gold/20 bg-mansion-gold/8 p-3 transition-all hover:bg-mansion-gold/12">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mansion-gold/15 text-mansion-gold"><Crown className="h-5 w-5" /></div>
                        <div className="flex-1 text-left"><p className="text-sm font-medium text-mansion-gold">VIP activo</p><p className="text-xs text-text-dim">Beneficios activos en tu cuenta</p></div>
                      </button>
                      <button type="button" onClick={handleToggleGhostMode} disabled={togglingGhost} className="flex w-full items-center gap-3 rounded-2xl p-3 transition-all hover:bg-white/[0.04] disabled:opacity-60">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${user.ghost_mode ? 'bg-purple-500/15 text-purple-400' : 'bg-mansion-elevated/60 text-text-muted'}`}>{user.ghost_mode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</div>
                        <div className="flex-1 text-left"><p className={`text-sm font-medium ${user.ghost_mode ? 'text-purple-400' : 'text-text-primary'}`}>Modo incógnito</p><p className="text-xs text-text-dim">{user.ghost_mode ? 'Tu perfil está oculto' : 'Visitá perfiles sin ser visto'}</p></div>
                        <div className={`h-6 w-11 rounded-full p-0.5 transition-colors ${user.ghost_mode ? 'bg-purple-500' : 'bg-mansion-border/40'}`}><div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${user.ghost_mode ? 'translate-x-5' : 'translate-x-0'}`} /></div>
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => navigate('/vip')} className="group flex w-full items-center gap-3 rounded-2xl border border-mansion-gold/25 bg-gradient-to-r from-mansion-gold/15 to-mansion-gold/5 p-3 transition-all hover:from-mansion-gold/25 hover:to-mansion-gold/10">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mansion-gold/15 text-mansion-gold transition-transform group-hover:scale-110"><Crown className="h-5 w-5" /></div>
                      <div className="flex-1 text-left"><p className="text-sm font-bold text-mansion-gold">Hacete VIP</p><p className="text-xs text-text-dim">Mensajes ilimitados, fotos y más</p></div>
                      <ChevronRight className="h-4 w-4 text-mansion-gold" />
                    </button>
                  )}
                </div>

                <button type="button" onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl p-3.5 text-mansion-crimson/75 transition-all hover:bg-mansion-crimson/5 hover:text-mansion-crimson">
                  <LogOut className="h-4.5 w-4.5" />
                  <span className="text-sm font-medium">Cerrar sesión</span>
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
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
    </div>
  );
}
