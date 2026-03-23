import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import mockProfiles from '../data/mockProfiles';
import ProfileCard from '../components/ProfileCard';
import { getProfiles, getToken } from '../lib/api';

export default function ExplorePage() {
  const [search, setSearch] = useState('');
  const [apiProfiles, setApiProfiles] = useState(null);

  // Debounced API search
  useEffect(() => {
    if (!getToken()) return;
    const timeout = setTimeout(() => {
      getProfiles({ q: search || undefined })
        .then(data => setApiProfiles(data.profiles))
        .catch(() => setApiProfiles(null));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const results = useMemo(() => {
    if (apiProfiles && apiProfiles.length > 0) return apiProfiles;

    if (!search.trim()) return mockProfiles;
    const q = search.toLowerCase();
    return mockProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.interests.some((i) => i.toLowerCase().includes(q))
    );
  }, [search, apiProfiles]);

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-16">
      <div className="px-4 lg:px-8 pt-4 lg:pt-6 pb-3">
        <h1 className="font-display text-2xl font-bold text-text-primary mb-4">Explorar</h1>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ciudad, nombre, interés..."
              className="w-full pl-10 py-2.5 text-sm"
            />
          </div>
          <button className="w-11 h-11 rounded-xl bg-mansion-card border border-mansion-border/50 flex items-center justify-center text-text-muted hover:text-mansion-gold hover:border-mansion-gold/30 transition-all">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 lg:px-8 mt-2">
        <p className="text-text-dim text-xs mb-3">
          {results.length} resultados
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 lg:gap-4">
          {results.map((profile, index) => (
            <ProfileCard key={profile.id} profile={profile} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
