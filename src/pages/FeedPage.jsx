import { useState, useMemo, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Plus } from 'lucide-react';
import { useAuth } from '../App';

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
  const { user } = useAuth();

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

  const storyCircleSize = settings.storyCircleSize || 88;
  const storyCircleGap = Math.max(0, Math.round((storyCircleSize * (settings.storyCircleGap ?? 8)) / 100));
  const storyCircleBorder = Math.max(1, Math.round((storyCircleSize * (settings.storyCircleBorder ?? 4)) / 100));
  const storyCircleInnerGap = Math.max(0, Math.round((storyCircleSize * (settings.storyCircleInnerGap ?? 3)) / 100));

  const viewedRaw = useSyncExternalStore(
    useCallback((cb) => {
      const handler = () => cb();
      window.addEventListener('storage', handler);
      window.addEventListener('focus', handler);
      window.addEventListener('visibilitychange', handler);
      return () => { window.removeEventListener('storage', handler); window.removeEventListener('focus', handler); window.removeEventListener('visibilitychange', handler); };
    }, []),
    () => localStorage.getItem('viewed_story_users') || '[]',
  );
  const viewedStoryUsers = useMemo(() => {
    try { return new Set(JSON.parse(viewedRaw)); } catch { return new Set(); }
  }, [viewedRaw]);

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
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', gap: `${storyCircleGap}px` }}
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {/* User's own story circle */}
          {user && (
            <motion.div variants={storyItem} className="flex-shrink-0" style={{ width: storyCircleSize + 6 }}>
              <div className="relative">
                <button
                  type="button"
                  onClick={user.has_active_story ? () => navigate('/videos', { state: { storyUserId: user.id } }) : () => navigate('/historia/nueva')}
                  className="flex flex-col items-center gap-1 w-full"
                >
                  <div className={`rounded-full ${
                    user.has_active_story
                      ? viewedStoryUsers.has(String(user.id))
                        ? 'bg-white/20'
                        : 'bg-gradient-to-tr from-emerald-400 via-emerald-500 to-emerald-400'
                      : 'bg-mansion-border/40'
                  }`} style={{ width: storyCircleSize, height: storyCircleSize, padding: storyCircleBorder }}>
                    <div className="w-full h-full rounded-full bg-mansion-base" style={{ padding: storyCircleInnerGap }}>
                      <div className="w-full h-full rounded-full overflow-hidden bg-mansion-elevated">
                        {user.avatar_url ? (
                          <AvatarImg src={user.avatar_url} crop={user.avatar_crop} alt={user.username} className="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-dim text-xs font-bold">
                            {user.username?.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-mansion-gold truncate w-full text-center leading-tight">Tú</span>
                </button>
                {/* Plus badge */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate('/historia/nueva'); }}
                  className="absolute bottom-4 right-0 w-5 h-5 rounded-full bg-mansion-gold flex items-center justify-center border-2 border-mansion-base shadow-md"
                >
                  <Plus className="w-3 h-3 text-mansion-base" strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          )}
          {profiles.filter(p => p.has_active_story).slice(0, 15).map((p) => {
            const photo = getPrimaryProfilePhoto(p);
            const photoCrop = getPrimaryProfileCrop(p);
            const isViewed = viewedStoryUsers.has(p.id);
            const size = storyCircleSize;
            const border = storyCircleBorder;
            const innerGap = storyCircleInnerGap;
            return (
              <motion.div key={`story-${p.id}`} variants={storyItem} className="flex-shrink-0" style={{ width: size + 6 }}>
                <button
                  type="button"
                  onClick={() => navigate('/videos', { state: { storyUserId: p.id } })}
                  className="flex flex-col items-center gap-1"
                >
                  <div className={`rounded-full ${
                    isViewed
                      ? 'bg-white/20'
                      : 'bg-gradient-to-tr from-mansion-crimson via-mansion-gold to-mansion-crimson'
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
                </button>
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
