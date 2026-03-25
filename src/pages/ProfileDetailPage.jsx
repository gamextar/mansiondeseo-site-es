import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, MessageCircle, Shield, Crown,
  MapPin, ChevronLeft, ChevronRight as ChevronRightIcon, Lock, X, ZoomIn, GripVertical, Gift,
} from 'lucide-react';
import { getProfile, getToken, toggleFavorite, updateProfile, getGiftCatalog, sendGift as apiSendGift } from '../lib/api';
import { useAuth } from '../App';

const ROLE_COLOR = {
  Pareja: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Hombre Solo': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Mujer Sola': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

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
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [viewerPremium, setViewerPremium] = useState(false);
  const [settings, setSettings] = useState({ blurLevel: 14, blurMobile: 14, blurDesktop: 8, freeVisiblePhotos: 1, freeOwnPhotos: 3 });
  const [isFavorited, setIsFavorited] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
  const [orderedPhotos, setOrderedPhotos] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);
  // Gift state
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftCatalog, setGiftCatalog] = useState([]);
  const [sendingGift, setSendingGift] = useState(null);
  const [giftSent, setGiftSent] = useState(null);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    setLoading(true);
    getProfile(id)
      .then(data => {
        setProfile(data.profile);
        setOrderedPhotos(data.profile.photos || []);
        setViewerPremium(data.viewerPremium || false);
        if (data.settings) setSettings(data.settings);
        if (data.profile.isFavorited !== undefined) setIsFavorited(data.profile.isFavorited);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [id, navigate]);

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
      // Update local user coins
      if (user && data.coins !== undefined) {
        setUser(prev => prev ? { ...prev, coins: data.coins } : prev);
      }
      // Update profile's received gifts
      setProfile(prev => prev ? {
        ...prev,
        receivedGifts: [
          { id: data.gift.id, gift_emoji: data.gift.gift_emoji, gift_name: data.gift.gift_name, sender_name: user?.username || '', sender_id: user?.id, created_at: new Date().toISOString() },
          ...(prev.receivedGifts || []),
        ],
      } : prev);
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

  const openLightbox = useCallback((idx) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  // Sync lightbox scroll position when opening or index changes
  useEffect(() => {
    if (lightboxOpen && lightboxScrollRef.current) {
      lightboxScrollRef.current.scrollTo({ left: lightboxIndex * lightboxScrollRef.current.offsetWidth, behavior: 'instant' });
    }
  }, [lightboxOpen, lightboxIndex]);

  const handleLightboxScroll = useCallback(() => {
    const el = lightboxScrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    setLightboxIndex(idx);
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight' && profile?.photos) {
        setLightboxIndex(prev => Math.min(prev + 1, profile.photos.length - 1));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, closeLightbox, profile?.photos]);

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

  const { name, age, city, role, interests, bio, photos, totalPhotos, verified, online, premium, blurred, isOwnProfile, receivedGifts } = profile;

  // Incognito mode blur (whole profile)
  const isGhostBlurred = blurred;

  // A photo is blocked if its index >= visiblePhotos count from backend
  const visiblePhotos = profile.visiblePhotos ?? photos.length;
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
            {photos.map((photo, i) => {
              const blocked = isPhotoBlocked(i);
              return (
                <div
                  key={i}
                  className="w-full h-full flex-shrink-0 snap-start relative cursor-pointer overflow-hidden"
                  onClick={() => !blocked && openLightbox(i)}
                >
                  <img
                    src={photo}
                    alt={blocked ? '' : `${name} ${i + 1}`}
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
          {/* Bottom gradient */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-mansion-base via-mansion-base/40 to-transparent pointer-events-none" />
        </motion.div>

        {/* Top nav overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-14 lg:pt-4 z-[60]">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full glass flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-text-primary" />
          </motion.button>

          {/* Photo counter */}
          {photos.length > 1 && (
            <span className="text-xs font-medium text-white/80 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
              {heroIndex + 1} / {totalPhotos || photos.length}
            </span>
          )}

          <div className="flex gap-2">
          </div>
        </div>

        {/* Desktop arrow buttons */}
        {photos.length > 1 && (
          <>
            {heroIndex > 0 && (
              <button
                onClick={() => scrollToHeroPhoto(heroIndex - 1)}
                className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 items-center justify-center transition-colors z-20"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}
            {heroIndex < photos.length - 1 && (
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
        {photos.length > 1 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1.5 lg:bottom-6 z-20">
            {photos.map((_, i) => (
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative -mt-16 px-4 z-10 lg:mt-0 lg:px-0 lg:flex-1"
      >
        <div className="glass-elevated rounded-3xl p-5">
          {/* Name row */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-display text-2xl font-bold text-text-primary">
                  {name}
                </h1>
                <span className="text-text-muted text-lg">{age}</span>
                {verified && <Shield className="w-4 h-4 text-green-400" />}
                {premium && <Crown className="w-4 h-4 text-mansion-gold" />}
              </div>
              <div className="flex items-center gap-3 text-sm text-text-muted">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {city}
                </span>
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
          <span className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full border ${ROLE_COLOR[role]}`}>
            {role}
          </span>

          {/* Bio */}
          <div className="mt-5 mb-5">
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">Sobre {name.split(' ')[0]}</h3>
            <p className="text-text-primary text-sm leading-relaxed font-display italic">
              "{bio}"
            </p>
          </div>

          {/* Interests */}
          <div className="mb-5">
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">Intereses</h3>
            <div className="flex flex-wrap gap-2">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-mansion-gold/10 text-mansion-gold border border-mansion-gold/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Received Gifts */}
          {receivedGifts && receivedGifts.length > 0 && (
            <div className="mb-5">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">
                Regalos recibidos ({receivedGifts.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {receivedGifts.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-mansion-card/60 border border-mansion-border/20"
                    title={`${g.gift_name} de ${g.sender_name}`}
                  >
                    <span className="text-base">{g.gift_emoji}</span>
                    <span className="text-[10px] text-text-dim">{g.sender_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo gallery */}
          {photos.length > 1 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider">Galería</h3>
                {isOwnProfile && !isReordering && (
                  <button
                    onClick={() => { setOrderedPhotos(photos); setIsReordering(true); }}
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
              <div className="grid grid-cols-3 gap-2">
                {(isReordering ? orderedPhotos : photos).map((photo, i) => {
                  const blocked = !isReordering && isPhotoBlocked(i);
                  return (
                    <div key={isReordering ? photo : i} className="aspect-square rounded-xl overflow-hidden bg-mansion-card relative group">
                      <img
                        src={photo}
                        alt=""
                        className="w-full h-full object-cover"
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
                          onClick={() => openLightbox(i)}
                        >
                          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-70 transition-opacity" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      </div>{/* end two-column wrapper */}

      {/* Floating action button — always visible */}
      {!isOwnProfile && (
      <div className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 z-[60] flex flex-col items-end gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleToggleFavorite}
          disabled={togglingFav}
          className={`w-12 h-12 rounded-full backdrop-blur border flex items-center justify-center transition-all shadow-lg ${
            isFavorited
              ? 'bg-mansion-crimson/20 border-mansion-crimson/40 text-mansion-crimson'
              : 'bg-mansion-card/80 border-mansion-border/40 text-text-muted hover:text-mansion-crimson hover:border-mansion-crimson/40'
          }`}
        >
          <Heart className="w-5 h-5" fill={isFavorited ? 'currentColor' : 'none'} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={openGiftModal}
          className="w-12 h-12 rounded-full backdrop-blur border bg-mansion-gold/20 border-mansion-gold/40 text-mansion-gold flex items-center justify-center transition-all shadow-lg hover:bg-mansion-gold/30"
        >
          <Gift className="w-5 h-5" />
        </motion.button>
        <Link
          to={`/mensajes/${id}`}
          className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-mansion-crimson text-white shadow-glow-crimson hover:bg-mansion-crimson-dark transition-all"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="font-display font-semibold text-sm">Enviar Mensaje</span>
        </Link>
      </div>
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
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            {/* Lightbox header */}
            <div className="flex items-center justify-between px-4 py-3 relative z-10">
              <button
                onClick={closeLightbox}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <span className="text-sm font-medium text-white/80">
                {lightboxIndex + 1} / {totalPhotos || photos.length}
              </span>
              <div className="w-10" />
            </div>

            {/* Swipeable image container — flex-1 min-h-0 + absolute inner guarantees correct height */}
            <div className="flex-1 relative min-h-0">
              <div
                ref={lightboxScrollRef}
                onScroll={handleLightboxScroll}
                className="absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
                style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
              >
              {photos.map((photo, i) => {
                const blocked = isPhotoBlocked(i);
                return (
                  <div key={i} className="flex-shrink-0 snap-start relative overflow-hidden" style={{ width: '100%', minWidth: '100%', height: '100%' }}>
                    <img
                      src={photo}
                      alt={blocked ? '' : `${name} ${i + 1}`}
                      className="w-full h-full object-contain select-none"
                      style={blocked ? { filter: `blur(${lightboxBlur}px)` } : undefined}
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
            </div>

            {/* Desktop arrow buttons */}
            {photos.length > 1 && (
              <>
                {lightboxIndex > 0 && (
                  <button
                    onClick={() => setLightboxIndex(prev => prev - 1)}
                    className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-colors z-10"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                )}
                {lightboxIndex < photos.length - 1 && (
                  <button
                    onClick={() => setLightboxIndex(prev => prev + 1)}
                    className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-colors z-10"
                  >
                    <ChevronRightIcon className="w-6 h-6 text-white" />
                  </button>
                )}
              </>
            )}

            {/* Lightbox dots */}
            {photos.length > 1 && (
              <div className="flex justify-center gap-1.5 pb-6 pt-2">
                {photos.map((_, i) => (
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
