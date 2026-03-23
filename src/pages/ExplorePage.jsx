import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
import { getProfiles, getToken } from '../lib/api';

export default function ExplorePage() {
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [viewerPremium, setViewerPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    setLoading(true);
    const timeout = setTimeout(() => {
      getProfiles({ q: search || undefined })
        .then(data => {
          setProfiles(data.profiles || []);
          setViewerPremium(data.viewerPremium || false);
        })
        .catch(() => setProfiles([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, navigate]);

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
          {profiles.length} resultados
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 lg:gap-4">
          {profiles.map((profile, index) => (
            <ProfileCard key={profile.id} profile={profile} index={index} viewerPremium={viewerPremium} />
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
