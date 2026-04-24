import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Shield, Crown, Lock } from 'lucide-react';
import { getDisplayPhotos, getPrimaryProfilePhoto } from '../lib/profileMedia';
import { formatLocation } from '../lib/location';
import { resolveMediaUrl } from '../lib/media';
import { isSafariDesktopBrowser } from '../lib/browser';

// Masquerade mask SVG icon for incognito mode
const MaskIcon = ({ className = 'w-6 h-6', customSvg = '' }) => {
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

const FEED_SCROLL_KEY = 'mansion_feed_scroll_y';

function formatCardLocation(profile) {
  const province = String(profile?.province ?? profile?.city ?? '').trim();
  const locality = String(profile?.locality ?? '').trim();
  if (locality && province) return province;
  return formatLocation(profile);
}

const CARD_ROLE_LABELS = {
  hombre: 'Hombre',
  mujer: 'Mujer',
  pareja: 'Pareja',
  pareja_hombres: 'Pareja de hombres',
  pareja_mujeres: 'Pareja de mujeres',
  trans: 'Trans',
  'Hombre Solo': 'Hombre',
  'Mujer Sola': 'Mujer',
  'Pareja de Hombres': 'Pareja de hombres',
  'Pareja de Mujeres': 'Pareja de mujeres',
};

function formatRoleAge(role, age) {
  const cleanRole = String(role || '').trim();
  const roleLabel = CARD_ROLE_LABELS[cleanRole] || cleanRole;
  const ageNumber = Number(age || 0);
  const ageText = ageNumber > 0 ? `${ageNumber} años` : '';
  if (roleLabel && ageText) return `${roleLabel} de ${ageText}`;
  return roleLabel || ageText;
}

export default function ProfileCard({
  profile,
  index = 0,
  viewerPremium = false,
  settings = {},
  safariDesktopOverride,
  isMobileOverride,
  immersiveMobile = false,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStartRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);
  const { id, name, age, role, interests, photos = [], verified, online, premium, blurred } = profile;
  const safariDesktop = typeof safariDesktopOverride === 'boolean' ? safariDesktopOverride : isSafariDesktopBrowser();
  const locationText = formatCardLocation(profile);
  const roleAgeText = formatRoleAge(role, age);
  const isMobile = typeof isMobileOverride === 'boolean'
    ? isMobileOverride
    : (typeof window !== 'undefined' && window.innerWidth < 1024);
  const baseBlur = isMobile ? (settings.blurMobile ?? settings.blurLevel ?? 14) : (settings.blurDesktop ?? settings.blurLevel ?? 8);
  // Profile cards are medium-sized — use base value as-is
  const blurLevel = baseBlur;

  // visiblePhotos tells us how many photos are unblurred
  const displayPhotos = getDisplayPhotos(profile);
  const visiblePhotos = profile.visiblePhotos ?? displayPhotos.length;
  const cardBlocked = blurred || visiblePhotos === 0;
  const mainPhoto = getPrimaryProfilePhoto(profile);
  const resolvedMainPhoto = resolveMediaUrl(mainPhoto);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedMainPhoto]);

  const returnToPath = `${location.pathname}${location.search}${location.hash}`;
  const useOverlayNavigation = location.pathname === '/' || location.pathname === '/feed' || location.pathname === '/explorar';
  const profilePath = `/perfiles/${id}`;
  const profileState = {
    ...(useOverlayNavigation ? {
      backgroundLocation: location,
      backgroundScrollY: typeof window !== 'undefined'
        ? (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0)
        : 0,
      modal: 'profile',
    } : {}),
    from: returnToPath,
    preview: { id, name, age, city: profile.city, province: profile.province, locality: profile.locality, role, photos, avatar_url: profile.avatar_url, avatar_crop: profile.avatar_crop || null, online, premium, verified, blurred, visiblePhotos, ghost_mode: profile.ghost_mode },
  };

  const handleOpenProfile = () => {
    if (typeof window === 'undefined') return;
    if (location.pathname !== '/' && location.pathname !== '/feed' && location.pathname !== '/explorar') return;
    try {
      sessionStorage.setItem(
        FEED_SCROLL_KEY,
        String(window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0)
      );
    } catch {}
  };

  const handleTouchStart = (event) => {
    if (!isMobile) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: event.timeStamp || Date.now(),
    };
  };

  const handleTouchEnd = (event) => {
    if (!isMobile || !touchStartRef.current) return;
    const touch = event.changedTouches?.[0];
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!touch) return;

    const dx = Math.abs(touch.clientX - start.x);
    const dy = Math.abs(touch.clientY - start.y);
    const elapsed = (event.timeStamp || Date.now()) - start.time;
    if (dx > 10 || dy > 10 || elapsed > 700) return;

    event.preventDefault();
    handleOpenProfile();
    navigate(profilePath, { state: profileState });
  };

  return (
    <div className={immersiveMobile ? 'rounded-xl overflow-hidden' : 'rounded-2xl overflow-hidden'}>
      <Link
        to={profilePath}
        state={profileState}
        onClick={handleOpenProfile}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`block group overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-mansion-gold/40 focus-visible:ring-offset-0 ${
          immersiveMobile ? 'rounded-xl' : 'rounded-2xl'
        }`}
        style={{ touchAction: 'manipulation' }}
      >
        <div
          className={`relative aspect-[3/4] overflow-hidden bg-mansion-card ${
            immersiveMobile
              ? 'rounded-xl ring-0 shadow-[0_8px_18px_rgba(0,0,0,0.2)]'
              : 'rounded-2xl ring-1 ring-white/5 shadow-[0_14px_28px_rgba(0,0,0,0.24)]'
          }`}
        >
          {/* Photo — use actual photo with blur for blocked cards */}
          {mainPhoto && !imageFailed ? (
            <img
              src={resolvedMainPhoto}
              alt={cardBlocked ? '' : name}
              onError={() => setImageFailed(true)}
              referrerPolicy="no-referrer"
              draggable={false}
              loading={index < (safariDesktop ? 2 : 6) ? 'eager' : 'lazy'}
              fetchPriority={index < (safariDesktop ? 1 : 4) ? 'high' : 'auto'}
              decoding="async"
              className={`absolute inset-0 w-full h-full object-cover ${safariDesktop ? '' : 'lg:transition-all lg:duration-500 lg:scale-105 lg:group-hover:scale-100'}`}
              style={cardBlocked ? { filter: `blur(${blurLevel}px)`, transform: 'scale(1.1)' } : undefined}
            />
          ) : null}

          {/* Incognito mode overlay */}
          {cardBlocked && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-1 text-white/70">
                {blurred
                  ? <MaskIcon className="w-6 h-6" customSvg={settings.incognitoIconSvg || ''} />
                  : <Lock className="w-5 h-5" />}
                <span className="text-[10px] font-semibold">{blurred ? 'Modo Incógnito' : 'Contenido VIP'}</span>
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-20">
            <div className="flex gap-1.5">
              {premium && (
                <span className={`flex items-center gap-1 border border-mansion-gold/30 rounded-full px-2 py-0.5 text-[10px] font-semibold text-mansion-gold ${safariDesktop ? 'bg-black/55' : 'bg-mansion-gold/20 backdrop-blur-sm'}`}>
                  <Crown className="w-3 h-3" />
                  VIP
                </span>
              )}
              {verified && (
                <span className={`flex items-center gap-1 border border-mansion-border/40 rounded-full px-2 py-0.5 text-[10px] font-medium text-text-muted ${safariDesktop ? 'bg-black/55' : 'bg-mansion-elevated/80 backdrop-blur-sm'}`}>
                  <Shield className="w-3 h-3 text-green-400" />
                </span>
              )}
            </div>

            {online && (
              <span className={`w-3 h-3 rounded-full bg-green-400 border-2 border-black/40 shadow-lg ${safariDesktop ? '' : 'animate-pulse-slow'}`} />
            )}
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
            {/* Name & details */}
            <div>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold text-white leading-tight">
                  {name}
                </h3>
                {roleAgeText && (
                  <p className="mt-0.5 text-xs font-semibold text-white/80 leading-tight">
                    {roleAgeText}
                  </p>
                )}
                {locationText && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-text-muted" />
                    <span className="text-xs text-text-muted">{locationText}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
