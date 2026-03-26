import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProfileCard from '../components/ProfileCard';
import { getProfiles, getToken } from '../lib/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

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
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-16">
      {/* Pull-to-refresh indicator */}
      <div
        ref={indicatorRef}
        className="fixed top-16 left-0 right-0 z-50 flex justify-center py-2 pointer-events-none"
        style={{ transform: 'translateY(-100%)', opacity: 0, transition: 'transform 0.2s, opacity 0.2s' }}
      >
        <div className="w-7 h-7 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
      </div>
      {/* Hero greeting */}
      <div className="px-4 lg:px-8 pt-4 lg:pt-6 pb-2">
        <div>
          <p className="text-text-muted text-sm lg:text-base">Buenas noches 🌙</p>
          <h1 className="font-display text-2xl lg:text-4xl font-bold text-text-primary">
            Descubre la <span className="text-gradient-gold">Mansión</span>
          </h1>
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 lg:px-8 pb-3">
        <p className="text-text-dim text-xs">
          {profiles.length} {profiles.length === 1 ? 'perfil' : 'perfiles'} encontrados
        </p>
      </div>

      {/* Grid */}
      <div className="px-4 lg:px-8">
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
      </div>
    </div>
  );
}
