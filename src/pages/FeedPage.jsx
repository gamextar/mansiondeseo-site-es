import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.045 } } };
const storyItem = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
};
import ProfileCard from '../components/ProfileCard';
import AvatarImg from '../components/AvatarImg';
import { getProfiles, getToken } from '../lib/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getPrimaryProfileCrop, getPrimaryProfilePhoto } from '../lib/profileMedia';

const FEED_CACHE_KEY = 'mansion_feed_';

function getSavedFilter() {
  return localStorage.getItem('mansion_feed_filter') || 'all';
}

function getCachedFeed(filter) {
  try {
    const raw = sessionStorage.getItem(FEED_CACHE_KEY + filter);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setCachedFeed(filter, data) {
  try { sessionStorage.setItem(FEED_CACHE_KEY + filter, JSON.stringify(data)); } catch {}
}

export default function FeedPage() {
  const savedFilter = getSavedFilter();
  const cached = getCachedFeed(savedFilter);
  const [profiles, setProfiles] = useState(cached?.profiles || []);
  const [viewerPremium, setViewerPremium] = useState(cached?.viewerPremium || false);
  const [settings, setSettings] = useState(cached?.settings || {});
  const [loading, setLoading] = useState(!cached);
  const navigate = useNavigate();

  const loadProfiles = useCallback((filter, { silent = false } = {}) => {
    const c = getCachedFeed(filter);
    if (!silent && !c) setLoading(true);
    if (!silent && c) {
      setProfiles(c.profiles || []);
      setViewerPremium(c.viewerPremium || false);
      if (c.settings) setSettings(c.settings);
    }
    return getProfiles({ filter: filter === 'all' ? undefined : filter })
      .then(data => {
        setProfiles(data.profiles || []);
        setViewerPremium(data.viewerPremium || false);
        if (data.settings) setSettings(data.settings);
        setCachedFeed(filter, { profiles: data.profiles || [], viewerPremium: data.viewerPremium || false, settings: data.settings || {} });
      })
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    loadProfiles(savedFilter);
  }, [navigate, loadProfiles, savedFilter]);

  const { indicatorRef } = usePullToRefresh(
    useCallback(() => loadProfiles(savedFilter, { silent: true }), [loadProfiles, savedFilter])
  );

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-navbar">
      {/* Pull-to-refresh indicator */}
      <div
        ref={indicatorRef}
        className="fixed top-16 left-0 right-0 z-50 flex justify-center py-2 pointer-events-none"
        style={{ transform: 'translateY(-100%)', opacity: 0, transition: 'transform 0.2s, opacity 0.2s' }}
      >
        <div className="w-7 h-7 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
      </div>
      {/* Stories section */}
      <motion.div
        className="px-4 lg:px-8 pt-2 lg:pt-4 pb-0"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Radio className="w-4 h-4 text-mansion-crimson" />
          <p className="text-text-muted text-sm lg:text-base font-medium">Transmitiendo</p>
        </div>
        <motion.div
          className="flex overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', gap: `${settings.storyCircleGap || 8}px` }}
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {profiles.slice(0, 15).map((p) => {
            const photo = getPrimaryProfilePhoto(p);
            const photoCrop = getPrimaryProfileCrop(p);
            const isOnline = p.online;
            const size = settings.storyCircleSize || 88;
            const border = settings.storyCircleBorder ?? 4;
            const innerGap = settings.storyCircleInnerGap ?? 3;
            const innerSize = size - border * 2;
            return (
              <motion.div key={`story-${p.id}`} variants={storyItem} className="flex-shrink-0" style={{ width: size + 6 }}>
              <Link
                to={`/perfiles/${p.id}`}
                state={{ preview: { id: p.id, name: p.name, age: p.age, city: p.city, role: p.role, photos: p.photos || [], avatar_url: p.avatar_url, avatar_crop: p.avatar_crop || null, online: p.online, premium: p.premium, verified: p.verified, blurred: p.blurred, visiblePhotos: p.visiblePhotos, ghost_mode: p.ghost_mode } }}
                className="flex flex-col items-center gap-1"
              >
                <div className={`rounded-full ${
                  isOnline
                    ? 'bg-gradient-to-tr from-mansion-crimson via-mansion-gold to-mansion-crimson'
                    : 'bg-gradient-to-tr from-mansion-border/60 to-mansion-border/40'
                }`} style={{ width: size, height: size, padding: border }}>
                  <div className="w-full h-full rounded-full bg-mansion-base" style={{ padding: innerGap }}>
                    <div className="w-full h-full rounded-full overflow-hidden bg-mansion-elevated">
                      {photo ? (
                        <AvatarImg src={photo} crop={photoCrop} alt={p.name} className="w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-dim text-xs font-bold">
                          {p.name?.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-text-muted truncate w-full text-center leading-tight">{p.name?.split(' ')[0]}</span>
              </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Results count */}
      <motion.div
        className="px-4 lg:px-8 pb-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <p className="text-text-dim text-xs">
          {profiles.length} {profiles.length === 1 ? 'usuario' : 'usuarios'} conectados
        </p>
      </motion.div>

      {/* Grid */}
      <motion.div
        className="px-4 lg:px-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>
        ) : profiles.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 lg:gap-4">
            {profiles.map((profile, index) => (
              <ProfileCard key={profile.id} profile={profile} index={index} viewerPremium={viewerPremium} settings={settings} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-text-muted text-lg mb-2">No hay perfiles</p>
            <p className="text-text-dim text-sm">Prueba con otro filtro</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
