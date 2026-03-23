import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import FilterBar from '../components/FilterBar';
import ProfileCard from '../components/ProfileCard';
import { getProfiles, getToken } from '../lib/api';

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [profiles, setProfiles] = useState([]);
  const [viewerPremium, setViewerPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    setLoading(true);
    getProfiles({ filter: activeFilter === 'all' ? undefined : activeFilter })
      .then(data => {
        setProfiles(data.profiles || []);
        setViewerPremium(data.viewerPremium || false);
      })
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, [activeFilter, navigate]);

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-16">
      {/* Hero greeting */}
      <div className="px-4 lg:px-8 pt-4 lg:pt-6 pb-2">
        <div>
          <p className="text-text-muted text-sm lg:text-base">Buenas noches 🌙</p>
          <h1 className="font-display text-2xl lg:text-4xl font-bold text-text-primary">
            Descubre la <span className="text-gradient-gold">Mansión</span>
          </h1>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />

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
              <ProfileCard key={profile.id} profile={profile} index={index} viewerPremium={viewerPremium} />
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
