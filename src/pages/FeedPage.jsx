import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import mockProfiles from '../data/mockProfiles';
import FilterBar from '../components/FilterBar';
import ProfileCard from '../components/ProfileCard';

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return mockProfiles;

    return mockProfiles.filter((p) => {
      const filterLower = activeFilter.toLowerCase();

      // Role-based filters
      if (filterLower === 'pareja') return p.role === 'Pareja';
      if (filterLower === 'mujer') return p.role === 'Mujer Sola';
      if (filterLower === 'hombre') return p.role === 'Hombre Solo';

      // Interest-based filters
      return p.interests.some((i) => i.toLowerCase().includes(filterLower));
    });
  }, [activeFilter]);

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-16">
      {/* Hero greeting */}
      <div className="px-4 lg:px-8 pt-4 lg:pt-6 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-text-muted text-sm lg:text-base">Buenas noches 🌙</p>
          <h1 className="font-display text-2xl lg:text-4xl font-bold text-text-primary">
            Descubre la <span className="text-gradient-gold">Mansión</span>
          </h1>
        </motion.div>
      </div>

      {/* Filter bar */}
      <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {/* Results count */}
      <div className="px-4 lg:px-8 pb-3">
        <p className="text-text-dim text-xs">
          {filtered.length} {filtered.length === 1 ? 'perfil' : 'perfiles'} encontrados
        </p>
      </div>

      {/* Grid */}
      <div className="px-4 lg:px-8">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 lg:gap-4">
            {filtered.map((profile, index) => (
              <ProfileCard key={profile.id} profile={profile} index={index} />
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
