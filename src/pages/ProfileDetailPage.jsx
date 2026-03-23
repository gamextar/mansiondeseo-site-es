import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, MessageCircle, Share2, Shield, Crown,
  MapPin, ChevronLeft, ChevronRight as ChevronRightIcon, Lock, X, ZoomIn,
} from 'lucide-react';
import { getProfile, getToken, toggleFavorite } from '../lib/api';

const ROLE_COLOR = {
  Pareja: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Hombre Solo': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Mujer Sola': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

export default function ProfileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [viewerPremium, setViewerPremium] = useState(false);
  const [settings, setSettings] = useState({ blurLevel: 14, freeVisiblePhotos: 1, freeOwnPhotos: 3 });
  const [isFavorited, setIsFavorited] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    setLoading(true);
    getProfile(id)
      .then(data => {
        setProfile(data.profile);
        setViewerPremium(data.viewerPremium || false);
        if (data.settings) setSettings(data.settings);
        if (data.profile.isFavorited !== undefined) setIsFavorited(data.profile.isFavorited);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [id, navigate]);

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

  const { name, age, city, role, interests, bio, photos, verified, online, premium, blurred, isOwnProfile } = profile;

  // Ghost mode blur (whole profile)
  const isGhostBlurred = blurred;

  // Per-photo blur: determines if a specific photo index should be blurred
  const shouldBlurPhoto = (index) => {
    if (viewerPremium) return false;
    if (isGhostBlurred) return true;
    if (isOwnProfile) return index >= settings.freeOwnPhotos;
    return index >= settings.freeVisiblePhotos;
  };

  return (
    <div className="min-h-screen bg-mansion-base pb-28 lg:pb-8">
      {/* Desktop: two-column layout / Mobile: stacked */}
      <div className="lg:flex lg:gap-8 lg:px-8 lg:pt-20 lg:max-w-6xl lg:mx-auto">

      {/* Hero image carousel */}
      <div className="relative lg:w-2/5 lg:flex-shrink-0 lg:sticky lg:top-20 lg:self-start">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="aspect-[3/4] max-h-[70vh] lg:max-h-[80vh] overflow-hidden lg:rounded-3xl relative"
        >
          {/* Scroll-snap container */}
          <div
            ref={heroScrollRef}
            onScroll={handleHeroScroll}
            className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {photos.map((photo, i) => {
              const blurThis = shouldBlurPhoto(i);
              return (
                <div
                  key={i}
                  className="w-full h-full flex-shrink-0 snap-center relative cursor-pointer"
                  onClick={() => !blurThis && openLightbox(i)}
                >
                  <img
                    src={photo}
                    alt={`${name} ${i + 1}`}
                    className="w-full h-full object-cover"
                    style={blurThis ? { filter: `blur(${settings.blurLevel}px)` } : undefined}
                    draggable={false}
                  />
                  {blurThis && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2 text-white/80">
                        <Lock className="w-8 h-8" />
                        <span className="text-sm font-semibold">{isGhostBlurred ? 'Modo Fantasma' : 'Contenido VIP'}</span>
                        <span className="text-xs text-white/60">Solo visible para usuarios VIP</span>
                      </div>
                    </div>
                  )}
                  {/* Zoom hint on non-blurred photos */}
                  {!blurThis && (
                    <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <ZoomIn className="w-4 h-4 text-white/70" />
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
              {heroIndex + 1} / {photos.length}
            </span>
          )}

          <div className="flex gap-2">
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="w-10 h-10 rounded-full glass flex items-center justify-center"
            >
              <Share2 className="w-4 h-4 text-text-muted" />
            </motion.button>
          </div>
        </div>

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

          {/* Photo gallery */}
          {photos.length > 1 && (
            <div className="mb-4">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">Galería</h3>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => {
                  const photoBlurred = shouldBlurPhoto(i);
                  return (
                    <button
                      key={i}
                      onClick={() => !photoBlurred && openLightbox(i)}
                      className="aspect-square rounded-xl overflow-hidden bg-mansion-card relative group"
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover"
                        style={photoBlurred ? { filter: `blur(${settings.blurLevel}px)` } : undefined}
                        draggable={false}
                      />
                      {photoBlurred && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-white/60" />
                        </div>
                      )}
                      {!photoBlurred && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-70 transition-opacity" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      </div>{/* end two-column wrapper */}

      {/* Floating action button — always visible */}
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
        <Link
          to={`/mensajes/${id}`}
          className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-mansion-crimson text-white shadow-glow-crimson hover:bg-mansion-crimson-dark transition-all"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="font-display font-semibold text-sm">Enviar Mensaje</span>
        </Link>
      </div>

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
                {lightboxIndex + 1} / {photos.length}
              </span>
              <div className="w-10" />
            </div>

            {/* Swipeable image container */}
            <div
              ref={lightboxScrollRef}
              onScroll={handleLightboxScroll}
              className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {photos.map((photo, i) => {
                const blurThis = shouldBlurPhoto(i);
                return (
                  <div key={i} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-4">
                    <img
                      src={photo}
                      alt={`${name} ${i + 1}`}
                      className="max-w-full max-h-full object-contain rounded-lg select-none"
                      style={blurThis ? { filter: `blur(${settings.blurLevel}px)` } : undefined}
                      draggable={false}
                    />
                    {blurThis && (
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
