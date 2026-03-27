import { Link } from 'react-router-dom';
import { MapPin, Shield, Crown, Lock } from 'lucide-react';
import { getDisplayPhotos, getPrimaryProfilePhoto } from '../lib/profileMedia';

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

const ROLE_COLORS = {
  Pareja: 'from-purple-500/80 to-purple-700/80',
  'Hombre Solo': 'from-blue-500/80 to-blue-700/80',
  'Mujer Sola': 'from-pink-500/80 to-pink-700/80',
};

const ROLE_BG = {
  Pareja: 'bg-purple-500/20 text-purple-300',
  'Hombre Solo': 'bg-blue-500/20 text-blue-300',
  'Mujer Sola': 'bg-pink-500/20 text-pink-300',
};

const ROLE_IMG_KEYS = {
  'Hombre Solo': 'galleryHombreImg',
  'Mujer Sola': 'galleryMujerImg',
  'Pareja': 'galleryParejaImg',
};

const RoleFallbackIcon = ({ role }) => {
  if (role === 'Hombre Solo') return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/80 text-white shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4Z"/></svg>
    </span>
  );
  if (role === 'Mujer Sola') return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-pink-500/80 text-white shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4Z"/></svg>
    </span>
  );
  return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-500/80 text-white shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z"/></svg>
    </span>
  );
};

export default function ProfileCard({ profile, index = 0, viewerPremium = false, settings = {} }) {
  const { id, name, age, city, role, interests, photos = [], verified, online, premium, blurred } = profile;
  const roleImg = settings[ROLE_IMG_KEYS[role]] || null;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const baseBlur = isMobile ? (settings.blurMobile ?? settings.blurLevel ?? 14) : (settings.blurDesktop ?? settings.blurLevel ?? 8);
  // Profile cards are medium-sized — use base value as-is
  const blurLevel = baseBlur;

  // visiblePhotos tells us how many photos are unblurred
  const displayPhotos = getDisplayPhotos(profile);
  const visiblePhotos = profile.visiblePhotos ?? displayPhotos.length;
  const cardBlocked = blurred || visiblePhotos === 0;
  const mainPhoto = getPrimaryProfilePhoto(profile);

  return (
    <div>
      <Link to={`/perfiles/${id}`} state={{ preview: { id, name, age, city, role, photos, avatar_url: profile.avatar_url, avatar_crop: profile.avatar_crop || null, online, premium, verified, blurred, visiblePhotos, ghost_mode: profile.ghost_mode } }} className="block group">
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-mansion-card shadow-card">
          {/* Photo — use actual photo with blur for blocked cards */}
          {mainPhoto ? (
            <img
              src={mainPhoto}
              alt={cardBlocked ? '' : name}
              loading={index < 6 ? 'eager' : 'lazy'}
              fetchPriority={index < 4 ? 'high' : 'auto'}
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-all duration-500 scale-105 group-hover:scale-100"
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
                <span className="flex items-center gap-1 bg-mansion-gold/20 backdrop-blur-sm border border-mansion-gold/30 rounded-full px-2 py-0.5 text-[10px] font-semibold text-mansion-gold">
                  <Crown className="w-3 h-3" />
                  VIP
                </span>
              )}
              {verified && (
                <span className="flex items-center gap-1 bg-mansion-elevated/80 backdrop-blur-sm border border-mansion-border/40 rounded-full px-2 py-0.5 text-[10px] font-medium text-text-muted">
                  <Shield className="w-3 h-3 text-green-400" />
                </span>
              )}
            </div>

            {online && (
              <span className="w-3 h-3 rounded-full bg-green-400 border-2 border-black/40 shadow-lg animate-pulse-slow" />
            )}
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
            {/* Name & details */}
            <div className="flex items-end justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-white leading-tight">
                  {name}<span className="text-text-muted font-body text-sm ml-1">{age}</span>
                </h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-text-muted" />
                  <span className="text-xs text-text-muted">{city}</span>
                </div>
              </div>

              {roleImg
                ? <img src={roleImg} alt={role} title={role} className="w-7 h-7 rounded-full object-contain" />
                : <RoleFallbackIcon role={role} />
              }
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
