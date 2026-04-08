import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, MessageCircle, Shield, Crown,
  MapPin, ChevronLeft, ChevronRight as ChevronRightIcon, Lock, X, ZoomIn, GripVertical, Gift, Eye,
} from 'lucide-react';
import { getProfile, getToken, toggleFavorite, updateProfile, getGiftCatalog, sendGift as apiSendGift } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { formatLocation } from '../lib/location';
import { getDisplayPhotos, getGalleryPhotos } from '../lib/profileMedia';
import { resolveMediaUrl } from '../lib/media';

const ROLE_COLOR = {
  Pareja: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Hombre Solo': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Mujer Sola': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

const SEEKING_META = {
  hombre: { label: 'Hombres', emoji: '👨', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  mujer: { label: 'Mujeres', emoji: '👩', className: 'bg-pink-500/15 text-pink-300 border-pink-500/30' },
  pareja: { label: 'Parejas', emoji: '💑', className: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  pareja_hombres: { label: 'Pareja de Hombres', emoji: '👬', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  pareja_mujeres: { label: 'Pareja de Mujeres', emoji: '👭', className: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' },
  trans: { label: 'Trans', emoji: '⚧', className: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
};

const MESSAGE_BLOCK_META = SEEKING_META;

const PROFILE_DETAIL_CACHE_PREFIX = 'mansion_profile_detail_';
const PROFILE_DETAIL_CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_PROFILE_SETTINGS = { blurLevel: 14, blurMobile: 14, blurDesktop: 8, freeVisiblePhotos: 1, freeOwnPhotos: 3 };

function buildPreviewProfile(preview) {
  if (!preview) return null;
  const displayPhotos = getDisplayPhotos(preview);
  return {
    ...preview,
    interests: [],
    bio: '',
    totalPhotos: displayPhotos.length,
    visiblePhotos: preview.visiblePhotos ?? displayPhotos.length,
    blurred: !!preview.blurred,
    isOwnProfile: !!preview.isOwnProfile,
    receivedGifts: [],
  };
}

function getProfileDetailCacheKey(id) {
  return `${PROFILE_DETAIL_CACHE_PREFIX}${id}`;
}

function readProfileDetailCache(id) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(getProfileDetailCacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cachedAt || Date.now() - parsed.cachedAt > PROFILE_DETAIL_CACHE_TTL_MS) {
      sessionStorage.removeItem(getProfileDetailCacheKey(id));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeProfileDetailCache(id, payload) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(getProfileDetailCacheKey(id), JSON.stringify({
      ...payload,
      cachedAt: Date.now(),
    }));
  } catch {
    // Silently fail
  }
}

// Masquerade mask SVG icon for incognito mode
const MaskIcon = ({ className = 'w-8 h-8', customSvg = '' }) => {
  if (customSvg) return <span className={className} dangerouslySetInnerHTML={{ __html: customSvg }} />;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12c0-3.3 2.4-5.5 5.5-5.5 1.6 0 2.8.8 3.5 1.9.7-1.1 1.9-1.9 3.5-1.9C18.6 6.5 21 8.7 21 12c0 2.5-1.8 5-4.5 5-1.6 0-2.8-.8-3.5-1.9-.7 1.1-1.9 1.9-3.5 1.9C6.8 17 3 14.5 3 12z" />
      <circle cx="9" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M17.5 17c1.5 1.5 3.2 2 5 1.5" />
    </svg>
  );
};

export default function ProfileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const preview = location.state?.preview || null;
  const backTarget = location.state?.from || null;
  const backTargetState = location.state?.returnState;
  const cachedDetail = readProfileDetailCache(id);
  const previewProfile = buildPreviewProfile(preview);
  const initialProfile = cachedDetail?.profile || previewProfile;
  const [profile, setProfile] = useState(initialProfile);
  const [viewerPremium, setViewerPremium] = useState(cachedDetail?.viewerPremium || false);
  const [settings, setSettings] = useState(cachedDetail?.settings || DEFAULT_PROFILE_SETTINGS);
  const [isFavorited, setIsFavorited] = useState(initialProfile?.isFavorited ?? false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [loading, setLoading] = useState(!initialProfile);
  const [isReordering, setIsReordering] = useState(false);
  const [orderedPhotos, setOrderedPhotos] = useState(initialProfile?.photos || []);
  const [savingOrder, setSavingOrder] = useState(false);
  // Gift state
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftCatalog, setGiftCatalog] = useState([]);
  const [sendingGift, setSendingGift] = useState(null);
  const [giftSent, setGiftSent] = useState(null);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    const nextCachedDetail = readProfileDetailCache(id);
    const nextPreviewProfile = buildPreviewProfile(location.state?.preview || null);
    const nextInitialProfile = nextCachedDetail?.profile || nextPreviewProfile;

    setProfile(nextInitialProfile);
    setOrderedPhotos(nextInitialProfile?.photos || []);
    setViewerPremium(nextCachedDetail?.viewerPremium || false);
    setSettings(nextCachedDetail?.settings || DEFAULT_PROFILE_SETTINGS);
    setIsFavorited(nextInitialProfile?.isFavorited ?? false);
    setLoading(!nextInitialProfile);

    getProfile(id)
      .then(data => {
        const nextSettings = data.settings || DEFAULT_PROFILE_SETTINGS;
        setProfile(data.profile);
        setOrderedPhotos(data.profile.photos || []);
        setViewerPremium(data.viewerPremium || false);
        setSettings(nextSettings);
        if (data.profile.isFavorited !== undefined) setIsFavorited(data.profile.isFavorited);
        writeProfileDetailCache(id, {
          profile: data.profile,
          viewerPremium: data.viewerPremium || false,
          settings: nextSettings,
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [id, navigate, location.state]);

  const movePhoto = useCallback((from, dir) => {
    const to = from + dir;
    setOrderedPhotos(prev => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }, []);

  const savePhotoOrder = async () => {
    setSavingOrder(true);
    try {
      await updateProfile({ photos: orderedPhotos });
      setProfile(prev => {
        if (!prev) return prev;
        const nextProfile = { ...prev, photos: orderedPhotos, totalPhotos: getDisplayPhotos({ ...prev, photos: orderedPhotos }).length };
        writeProfileDetailCache(id, {
          profile: nextProfile,
          viewerPremium,
          settings,
        });
        return nextProfile;
      });
      setIsReordering(false);
    } catch {
      // Silently fail
    } finally {
      setSavingOrder(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (togglingFav) return;
    setTogglingFav(true);
    try {
      const data = await toggleFavorite(id);
      setIsFavorited(data.favorited);
      setProfile(prev => {
        if (!prev) return prev;
        const nextProfile = {
          ...prev,
          isFavorited: data.favorited,
          followers_total: Number(data?.followers_total ?? prev.followers_total ?? 0),
        };
        writeProfileDetailCache(id, {
          profile: nextProfile,
          viewerPremium,
          settings,
        });
        return nextProfile;
      });
    } catch {
      // Silently fail
    } finally {
      setTogglingFav(false);
    }
  };

  // Gift sending
  const openGiftModal = async () => {
    setGiftModalOpen(true);
    setGiftSent(null);
    if (giftCatalog.length === 0) {
      try {
        const data = await getGiftCatalog();
        setGiftCatalog(data.gifts || []);
      } catch {
        // Silently fail
      }
    }
  };

  const handleSendGift = async (giftId) => {
    if (sendingGift) return;
    setSendingGift(giftId);
    try {
      const data = await apiSendGift(id, giftId);
      const nextGift = {
        id: data.gift.id,
        gift_emoji: data.gift.gift_emoji,
        gift_name: data.gift.gift_name,
        sender_name: user?.username || '',
        sender_id: user?.id,
        created_at: new Date().toISOString(),
      };
      // Update local user coins
      if (user && data.coins !== undefined) {
        setUser(prev => prev ? { ...prev, coins: data.coins } : prev);
      }
      // Update profile's received gifts
      setProfile(prev => {
        if (!prev) return prev;
        const nextProfile = {
          ...prev,
          receivedGifts: [
            nextGift,
            ...(prev.receivedGifts || []),
          ],
        };
        writeProfileDetailCache(id, {
          profile: nextProfile,
          viewerPremium,
          settings,
        });
        return nextProfile;
      });
      setGiftSent(data.gift);
      setTimeout(() => { setGiftModalOpen(false); setGiftSent(null); }, 1500);
    } catch (err) {
      alert(err.message || 'Error al enviar regalo');
    } finally {
      setSendingGift(null);
    }
  };

  // ── Hero carousel state ──
  const [heroIndex, setHeroIndex] = useState(0);
  const heroScrollRef = useRef(null);

  const handleHeroScroll = useCallback(() => {
    const el = heroScrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    setHeroIndex(idx);
  }, []);

  const scrollToHeroPhoto = useCallback((idx) => {
    const el = heroScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.offsetWidth, behavior: 'smooth' });
  }, []);

  // ── Fullscreen lightbox state ──
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxScrollRef = useRef(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const lbZoomRef = useRef(1);
  const lbPanRef = useRef({ x: 0, y: 0 });
  const lbPinchRef = useRef({ startDist: 0, startZoom: 1, active: false });
  const lbDragRef = useRef({ startX: 0, startY: 0, startPanX: 0, startPanY: 0, active: false });
  const lbLastTapRef = useRef(0);

  const openLightbox = useCallback((idx) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 });
    lbZoomRef.current = 1; lbPanRef.current = { x: 0, y: 0 };
  }, []);

  // Sync lightbox scroll position when opening or index changes
  useEffect(() => {
    if (lightboxOpen && lightboxScrollRef.current) {
      lightboxScrollRef.current.scrollTo({ left: lightboxIndex * lightboxScrollRef.current.offsetWidth, behavior: 'instant' });
    }
    setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 });
    lbZoomRef.current = 1; lbPanRef.current = { x: 0, y: 0 };
  }, [lightboxOpen, lightboxIndex]);

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

  const handleBack = useCallback(() => {
    if (backTarget) {
      navigate(backTarget, backTargetState ? { state: backTargetState } : undefined);
      return;
    }
    navigate(-1);
  }, [backTarget, backTargetState, navigate]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const totalDisplayPhotos = getDisplayPhotos(profile);
    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight' && totalDisplayPhotos.length > 0) {
        setLightboxIndex(prev => Math.min(prev + 1, totalDisplayPhotos.length - 1));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, closeLightbox, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center">
        <p className="text-text-muted">Cargando perfil...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center">
        <p className="text-text-muted">Perfil no encontrado</p>
      </div>
    );
  }

  const { name, age, role, interests, bio, totalPhotos, verified, online, premium, blurred, isOwnProfile, receivedGifts } = profile;
  const visitsTotal = Number(profile?.visits_total || 0);
  const followersTotal = Number(profile?.followers_total || 0);
  const seeking = Array.isArray(profile?.seeking) ? profile.seeking : (profile?.seeking ? [profile.seeking] : []);
  const messageBlockRoles = Array.isArray(profile?.message_block_roles) ? profile.message_block_roles : [];
  const locationText = formatLocation(profile);
  const galleryPhotos = getGalleryPhotos(profile);
  const displayPhotos = getDisplayPhotos(profile);
  const avatarDisplayOffset = profile.avatar_url ? 1 : 0;

  // Incognito mode blur (whole profile)
  const isGhostBlurred = blurred;

  // A photo is blocked if its display index >= visiblePhotos count from backend.
  const visiblePhotos = profile.visiblePhotos ?? displayPhotos.length;
  const isPhotoBlocked = (index) => index >= visiblePhotos;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const baseBlur = isMobile ? (settings.blurMobile ?? settings.blurLevel ?? 14) : (settings.blurDesktop ?? settings.blurLevel ?? 8);
  // Scale blur proportionally: hero gets 1.8x, thumbnails 0.7x, lightbox 2.5x
  const heroBlur = Math.round(baseBlur * 1.8);
  const thumbBlur = Math.round(baseBlur * 0.7);
  const lightboxBlur = Math.round(baseBlur * 2.5);

  return (
    <div className="min-h-screen bg-mansion-base pb-28 lg:pb-8">
      {/* Desktop: two-column layout / Mobile: stacked */}
      <div className="lg:flex lg:gap-8 lg:px-8 lg:pt-20 lg:max-w-6xl lg:mx-auto">

      {/* Hero image carousel */}
      <div className="relative lg:w-[46%] lg:flex-shrink-0 lg:sticky lg:top-20 lg:self-start">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full aspect-[3/4] max-h-[70vh] lg:max-h-[85vh] overflow-hidden lg:rounded-3xl relative"
        >
          {/* Scroll-snap container */}
          <div
            ref={heroScrollRef}
            onScroll={handleHeroScroll}
            className="flex w-full h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          >
            {displayPhotos.map((photo, i) => {
              const blocked = isPhotoBlocked(i);
              return (
                <div
                  key={i}
                  className="w-full h-full flex-shrink-0 snap-start relative cursor-pointer overflow-hidden"
                  onClick={() => !blocked && openLightbox(i)}
                >
                  <img
                    src={resolveMediaUrl(photo)}
                    alt={blocked ? '' : `${name} ${i + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    style={blocked ? { filter: `blur(${heroBlur}px)`, transform: 'scale(1.1)' } : undefined}
                    draggable={false}
                  />
                  {blocked && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2 text-white/80">
                        {isGhostBlurred
                          ? <MaskIcon className="w-9 h-9" customSvg={settings.incognitoIconSvg || ''} />
                          : <Lock className="w-8 h-8" />}
                        <span className="text-sm font-semibold">{isGhostBlurred ? 'Modo Incógnito' : 'Contenido VIP'}</span>
                        <span className="text-xs text-white/60">Solo visible para usuarios VIP</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Bottom gradient — extended for smooth overlap */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-mansion-base via-mansion-base/60 to-transparent pointer-events-none" />
        </motion.div>

        {/* Top nav overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-14 lg:pt-4 z-[60]">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleBack}
            className="w-10 h-10 rounded-full glass flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-text-primary" />
          </motion.button>

          {/* Photo counter */}
          {displayPhotos.length > 1 && (
            <span className="text-xs font-medium text-white/80 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
              {heroIndex + 1} / {totalPhotos || displayPhotos.length}
            </span>
          )}

          <div className="flex gap-2">
          </div>
        </div>

        {/* Desktop arrow buttons */}
        {displayPhotos.length > 1 && (
          <>
            {heroIndex > 0 && (
              <button
                onClick={() => scrollToHeroPhoto(heroIndex - 1)}
                className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 items-center justify-center transition-colors z-20"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}
            {heroIndex < displayPhotos.length - 1 && (
              <button
                onClick={() => scrollToHeroPhoto(heroIndex + 1)}
                className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 items-center justify-center transition-colors z-20"
              >
                <ChevronRightIcon className="w-5 h-5 text-white" />
              </button>
            )}
          </>
        )}

        {/* Interactive dots */}
        {displayPhotos.length > 1 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1.5 lg:bottom-6 z-20">
            {displayPhotos.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToHeroPhoto(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === heroIndex
                    ? 'w-6 h-2 bg-white'
                    : 'w-2 h-2 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Profile info */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [.25,.46,.45,.94] }}
        className="relative -mt-20 px-4 z-10 lg:mt-0 lg:px-0 lg:flex-1"
      >
        <div className="glass-elevated rounded-[2rem] p-6 shadow-elevated">
          {/* Name row */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <h1 className="font-display text-3xl font-bold text-text-primary">
                  {name}
                </h1>
                <span className="text-text-muted text-xl font-light">{age}</span>
              </div>
              <div className="flex items-center gap-3">
                {locationText && (
                  <span className="flex items-center gap-1 text-sm text-text-muted">
                    <MapPin className="w-3.5 h-3.5" /> {locationText}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  {verified && <Shield className="w-4 h-4 text-green-400" />}
                  {premium && <Crown className="w-4 h-4 text-mansion-gold" />}
                </div>
              </div>
            </div>
            {online && (
              <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 rounded-full px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
                Online
              </span>
            )}
          </div>

          {/* Role badge */}
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full border ${ROLE_COLOR[role]}`}
          >
            {role}
          </motion.span>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="mt-4 mb-6"
          >
            <div className="flex flex-wrap items-center gap-2.5 text-sm text-text-primary">
              <div className="inline-flex items-center gap-2 rounded-full border border-mansion-border/30 bg-mansion-card/50 px-3 py-2">
                <Heart className="w-4 h-4 text-mansion-crimson" fill="currentColor" />
                <span className="font-semibold tabular-nums">{followersTotal.toLocaleString('es-AR')}</span>
                <span className="text-text-dim">seguidores</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-mansion-border/30 bg-mansion-card/50 px-3 py-2">
                <Eye className="w-4 h-4 text-mansion-gold" />
                <span className="font-semibold tabular-nums">{visitsTotal.toLocaleString('es-AR')}</span>
                <span className="text-text-dim">visitas al perfil</span>
              </div>
            </div>
          </motion.div>

          {/* Bio */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-6"
          >
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2.5">Sobre {name.split(' ')[0]}</h3>
            <div className="border-l-2 border-mansion-gold/40 pl-4">
              <p className="text-text-primary text-sm leading-relaxed font-display italic">
                "{bio}"
              </p>
            </div>
          </motion.div>

          {/* Seeking */}
          {seeking.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-6"
            >
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2.5">Busco</h3>
              <div className="flex flex-wrap gap-2">
                {seeking.map((value, idx) => {
                  const meta = SEEKING_META[value] || { label: value, emoji: '✨', className: 'bg-mansion-card/60 text-text-primary border-mansion-border/30' };
                  return (
                    <motion.span
                      key={value}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.45 + idx * 0.04 }}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${meta.className}`}
                    >
                      <span>{meta.emoji}</span>
                      <span>{meta.label}</span>
                    </motion.span>
                  );
                })}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.425 }}
            className="mb-6"
          >
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2.5">Privacidad de Mensajes</h3>
            {messageBlockRoles.length > 0 ? (
              <>
                <p className="text-text-dim text-xs mb-2.5">No recibe mensajes de:</p>
                <div className="flex flex-wrap gap-2">
                  {messageBlockRoles.map((value, idx) => {
                    const meta = MESSAGE_BLOCK_META[value] || { label: value, emoji: '⛔', className: 'bg-mansion-card/60 text-text-primary border-mansion-border/30' };
                    return (
                      <motion.span
                        key={value}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.47 + idx * 0.04 }}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${meta.className}`}
                      >
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </motion.span>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-text-primary text-sm">Acepta todos los mensajes</p>
            )}
          </motion.div>

          {/* Interests */}
          {interests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="mb-6"
            >
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2.5">Intereses</h3>
              <div className="flex flex-wrap gap-2">
                {interests.map((tag, idx) => (
                  <motion.span
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.04 }}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-mansion-gold/10 text-mansion-gold border border-mansion-gold/20 hover:bg-mansion-gold/15 transition-colors"
                  >
                    {tag}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Received Gifts */}
          {receivedGifts && receivedGifts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-6"
            >
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2.5">
                Regalos recibidos ({receivedGifts.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {receivedGifts.map((g, idx) => (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.55 + idx * 0.03 }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-mansion-card/40 border border-mansion-border/15"
                    title={`${g.gift_name} de ${g.sender_name}`}
                  >
                    <span className="text-lg">{g.gift_emoji}</span>
                    <span className="text-[10px] text-text-dim">{g.sender_name}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Photo gallery */}
          {galleryPhotos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mb-4"
            >
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider">Galería</h3>
                {isOwnProfile && !isReordering && (
                  <button
                    onClick={() => { setOrderedPhotos(galleryPhotos); setIsReordering(true); }}
                    className="text-xs text-mansion-gold hover:text-mansion-gold/80 transition-colors"
                  >
                    Editar orden
                  </button>
                )}
                {isOwnProfile && isReordering && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsReordering(false)}
                      className="text-xs text-text-muted hover:text-text-primary transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={savePhotoOrder}
                      disabled={savingOrder}
                      className="text-xs text-mansion-gold font-semibold hover:text-mansion-gold/80 transition-colors disabled:opacity-50"
                    >
                      {savingOrder ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {(isReordering ? orderedPhotos : galleryPhotos).map((photo, i) => {
                  const displayIndex = i + avatarDisplayOffset;
                  const blocked = !isReordering && isPhotoBlocked(displayIndex);
                  return (
                    <motion.div
                      key={isReordering ? photo : i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + i * 0.04 }}
                      className="aspect-square rounded-2xl overflow-hidden bg-mansion-card relative group"
                    >
                      <img
                        src={resolveMediaUrl(photo)}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        style={blocked ? { filter: `blur(${thumbBlur}px)`, transform: 'scale(1.1)' } : undefined}
                        draggable={false}
                      />
                      {blocked && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-white/60" />
                        </div>
                      )}
                      {isReordering ? (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
                          <button
                            onClick={() => movePhoto(i, -1)}
                            disabled={i === 0}
                            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 disabled:opacity-20 flex items-center justify-center transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4 text-white" />
                          </button>
                          <span className="text-white/70 text-xs font-bold">{i + 1}</span>
                          <button
                            onClick={() => movePhoto(i, 1)}
                            disabled={i === orderedPhotos.length - 1}
                            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 disabled:opacity-20 flex items-center justify-center transition-colors"
                          >
                            <ChevronRightIcon className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : !blocked && (
                        <div
                          className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center cursor-pointer"
                          onClick={() => openLightbox(displayIndex)}
                        >
                          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-70 transition-opacity" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      </div>{/* end two-column wrapper */}

      {/* Floating action bar — horizontal bottom */}
      {!isOwnProfile && (
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', damping: 20, stiffness: 200 }}
        className="fixed bottom-20 left-4 right-4 lg:bottom-8 lg:left-auto lg:right-8 lg:w-auto z-[60] flex items-center justify-center gap-3"
      >
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleToggleFavorite}
          disabled={togglingFav}
          className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-all shadow-lg ${
            isFavorited
              ? 'bg-mansion-crimson/20 border-mansion-crimson/40 text-mansion-crimson'
              : 'glass border-mansion-border/30 text-text-muted hover:text-mansion-crimson hover:border-mansion-crimson/30'
          }`}
        >
          <Heart
            className={`w-5 h-5 transition-transform ${isFavorited ? 'scale-110' : ''}`}
            fill={isFavorited ? 'currentColor' : 'none'}
          />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={openGiftModal}
          className="w-12 h-12 rounded-full backdrop-blur-md glass border border-mansion-gold/30 text-mansion-gold flex items-center justify-center transition-all shadow-lg hover:bg-mansion-gold/10"
        >
          <Gift className="w-5 h-5" />
        </motion.button>
        <Link
          to={`/mensajes/${id}`}
          state={{
            partnerPreview: {
              id,
              name,
              avatar_url: profile.avatar_url || '',
              avatar_crop: profile.avatar_crop || null,
              photos: profile.photos || [],
              online: profile.online,
            },
          }}
          className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-mansion-crimson text-white shadow-glow-crimson hover:bg-mansion-crimson-dark transition-all active:scale-95"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="font-display font-semibold text-sm">Mensaje</span>
        </Link>
      </motion.div>
      )}

      {/* ── Gift Picker Modal ── */}
      <AnimatePresence>
        {giftModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setGiftModalOpen(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-mansion-base border border-mansion-border/30 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-mansion-border/20">
                <div>
                  <h3 className="font-display text-lg font-bold text-text-primary">Enviar regalo</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#C9A84C" stroke="#A88A3D" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="7" fill="none" stroke="#A88A3D" strokeWidth="0.75" />
                      <text x="12" y="16" textAnchor="middle" fill="#8B7332" fontSize="10" fontWeight="bold" fontFamily="serif">$</text>
                    </svg>
                    <span className="text-xs font-bold text-mansion-gold">{user?.coins ?? 0} monedas</span>
                  </div>
                </div>
                <button
                  onClick={() => setGiftModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-mansion-elevated flex items-center justify-center text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Gift sent success */}
              {giftSent ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-5xl mb-3"
                  >
                    {giftSent.gift_emoji}
                  </motion.span>
                  <p className="text-text-primary font-semibold">¡Regalo enviado!</p>
                  <p className="text-text-dim text-sm mt-1">{giftSent.gift_name} para {name}</p>
                </div>
              ) : (
                /* Gift grid */
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  <div className="grid grid-cols-3 gap-2.5">
                    {giftCatalog.map((gift) => {
                      const canAfford = (user?.coins ?? 0) >= gift.price;
                      return (
                        <button
                          key={gift.id}
                          onClick={() => canAfford && handleSendGift(gift.id)}
                          disabled={!canAfford || !!sendingGift}
                          className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${
                            canAfford
                              ? 'bg-mansion-card/60 border-mansion-border/20 hover:border-mansion-gold/40 hover:bg-mansion-gold/5 active:scale-95'
                              : 'bg-mansion-card/30 border-mansion-border/10 opacity-50'
                          } ${sendingGift === gift.id ? 'animate-pulse' : ''}`}
                        >
                          <span className="text-3xl">{gift.emoji}</span>
                          <span className="text-xs font-medium text-text-primary truncate w-full text-center">{gift.name}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-mansion-gold font-bold">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" fill="#C9A84C" stroke="#A88A3D" strokeWidth="1.5" />
                              <text x="12" y="16" textAnchor="middle" fill="#8B7332" fontSize="10" fontWeight="bold" fontFamily="serif">$</text>
                            </svg>
                            {gift.price}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fullscreen Lightbox ── */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black"
          >
            {/* Close button – top-right, matching story upload style */}
            <button
              onClick={closeLightbox}
              className="absolute z-30 flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              style={{ top: 'max(env(safe-area-inset-top, 12px), 12px)', right: 16 }}
            >
              <X className="w-5 h-5 lg:w-6 lg:h-6" />
            </button>

            {/* Counter badge – top-left */}
            {displayPhotos.length > 1 && (
              <div
                className="absolute z-20 flex items-center justify-center px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-sm"
                style={{ top: 'max(env(safe-area-inset-top, 12px), 12px)', left: 16 }}
              >
                <span className="text-sm font-medium text-white/80">
                  {lightboxIndex + 1} / {totalPhotos || displayPhotos.length}
                </span>
              </div>
            )}

            {/* Image area with pinch-to-zoom */}
            <div className="absolute inset-0 flex flex-col">
              <div
                ref={lightboxScrollRef}
                onScroll={handleLightboxScroll}
                className="flex-1 flex overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
                style={{
                  scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
                  overflowX: lightboxZoom > 1 ? 'hidden' : 'auto',
                }}
              >
              {displayPhotos.map((photo, i) => {
                const blocked = isPhotoBlocked(i);
                return (
                  <div
                    key={i}
                    className="flex-shrink-0 snap-start relative flex items-center justify-center overflow-hidden"
                    style={{ width: '100%', minWidth: '100%', height: '100%', touchAction: lightboxZoom > 1 ? 'none' : 'pan-x' }}
                    onTouchStart={handleLbTouchStart}
                    onTouchMove={handleLbTouchMove}
                    onTouchEnd={handleLbTouchEnd}
                  >
                    <img
                      src={resolveMediaUrl(photo)}
                      alt={blocked ? '' : `${name} ${i + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain select-none"
                      style={{
                        ...(blocked ? { filter: `blur(${lightboxBlur}px)` } : {}),
                        ...(i === lightboxIndex ? {
                          transform: `scale(${lightboxZoom}) translate(${lightboxPan.x / lightboxZoom}px, ${lightboxPan.y / lightboxZoom}px)`,
                          transition: lbPinchRef.current.active || lbDragRef.current.active ? 'none' : 'transform 0.2s ease-out',
                        } : {}),
                      }}
                      draggable={false}
                    />
                    {blocked && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center gap-2 text-white/80">
                          <Lock className="w-10 h-10" />
                          <span className="text-base font-semibold">Contenido VIP</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>

              {/* Lightbox dots */}
              {displayPhotos.length > 1 && (
                <div className="flex justify-center gap-1.5 pb-6 pt-2">
                  {displayPhotos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxIndex(i)}
                      className={`rounded-full transition-all duration-300 ${
                        i === lightboxIndex
                          ? 'w-6 h-2 bg-white'
                          : 'w-2 h-2 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Desktop arrow buttons */}
            {displayPhotos.length > 1 && (
              <>
                {lightboxIndex > 0 && (
                  <button
                    onClick={() => setLightboxIndex(prev => prev - 1)}
                    className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-colors z-10"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                )}
                {lightboxIndex < displayPhotos.length - 1 && (
                  <button
                    onClick={() => setLightboxIndex(prev => prev + 1)}
                    className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-colors z-10"
                  >
                    <ChevronRightIcon className="w-6 h-6 text-white" />
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
