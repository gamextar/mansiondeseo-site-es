import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Shield, Crown } from 'lucide-react';

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

export default function ProfileCard({ profile, index = 0 }) {
  const { id, name, age, city, role, interests, photos = [], verified, online, premium } = profile;
  const mainPhoto = photos[0] || profile.avatar_url || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.4), duration: 0.35 }}
      style={{ willChange: 'opacity, transform' }}
    >
      <Link to={`/perfiles/${id}`} className="block group">
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-mansion-card shadow-card">
          {/* Photo with blur effect */}
          <img
            src={mainPhoto}
            alt={name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500 
                       filter blur-[6px] group-hover:blur-0 group-focus:blur-0
                       scale-105 group-hover:scale-100"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
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
          <div className="absolute bottom-0 left-0 right-0 p-3">
            {/* Interests pills */}
            <div className="flex flex-wrap gap-1 mb-2">
              {interests.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm text-white/80 border border-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>

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

              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ROLE_BG[role]}`}>
                {role}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
