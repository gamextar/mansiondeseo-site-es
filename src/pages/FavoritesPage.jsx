import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
import { getFavorites, getToken } from '../lib/api';

export default function FavoritesPage() {
  const [profiles, setProfiles] = useState([]);
  const [viewerPremium, setViewerPremium] = useState(false);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    getFavorites()
      .then(data => {
        setProfiles(data.profiles || []);
        setViewerPremium(data.viewerPremium || false);
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-16">
      <div className="px-4 lg:px-8 pt-4 lg:pt-6 pb-3">
        <h1 className="font-display text-2xl font-bold text-text-primary mb-4">Mis Favoritos</h1>
      </div>

      <div className="px-4 lg:px-8 mt-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart className="w-12 h-12 text-text-dim mb-4" />
            <p className="text-text-muted text-sm">Aún no tenés perfiles favoritos</p>
            <button
              onClick={() => navigate('/explorar')}
              className="mt-4 text-mansion-gold text-sm font-medium hover:underline"
            >
              Explorar perfiles
            </button>
          </div>
        ) : (
          <>
            <p className="text-text-dim text-xs mb-3">
              {profiles.length} {profiles.length === 1 ? 'favorito' : 'favoritos'}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 lg:gap-4">
              {profiles.map((profile, index) => (
                <ProfileCard key={profile.id} profile={profile} index={index} viewerPremium={viewerPremium} settings={settings} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
