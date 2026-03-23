import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Heart, MessageCircle, Share2, Shield, Crown,
  MapPin, Clock, ChevronLeft,
} from 'lucide-react';
import mockProfiles from '../data/mockProfiles';

const ROLE_COLOR = {
  Pareja: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Hombre Solo': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Mujer Sola': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

export default function ProfileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const profile = mockProfiles.find((p) => p.id === id);

  if (!profile) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center">
        <p className="text-text-muted">Perfil no encontrado</p>
      </div>
    );
  }

  const { name, age, city, role, interests, bio, photos, verified, online, premium, lastActive } = profile;

  return (
    <div className="min-h-screen bg-mansion-base pb-28 lg:pb-8">
      {/* Desktop: two-column layout / Mobile: stacked */}
      <div className="lg:flex lg:gap-8 lg:px-8 lg:pt-20 lg:max-w-6xl lg:mx-auto">

      {/* Hero image */}
      <div className="relative lg:w-2/5 lg:flex-shrink-0 lg:sticky lg:top-20 lg:self-start">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="aspect-[3/4] max-h-[70vh] lg:max-h-[80vh] overflow-hidden lg:rounded-3xl"
        >
          <img
            src={photos[0]}
            alt={name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-mansion-base via-mansion-base/20 to-transparent" />
        </motion.div>

        {/* Top nav overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-6 safe-top lg:pt-4">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full glass flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-text-primary" />
          </motion.button>

          <div className="flex gap-2">
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="w-10 h-10 rounded-full glass flex items-center justify-center"
            >
              <Share2 className="w-4 h-4 text-text-muted" />
            </motion.button>
          </div>
        </div>

        {/* Photo dots */}
        {photos.length > 1 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1.5 lg:bottom-6">
            {photos.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i === 0 ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Profile info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative -mt-16 px-4 z-10 lg:mt-0 lg:px-0 lg:flex-1"
      >
        <div className="glass-elevated rounded-3xl p-5">
          {/* Name row */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-display text-2xl font-bold text-text-primary">
                  {name}
                </h1>
                <span className="text-text-muted text-lg">{age}</span>
                {verified && <Shield className="w-4 h-4 text-green-400" />}
                {premium && <Crown className="w-4 h-4 text-mansion-gold" />}
              </div>
              <div className="flex items-center gap-3 text-sm text-text-muted">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {city}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {lastActive}
                </span>
              </div>
            </div>
            {online && (
              <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 rounded-full px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
                Online
              </span>
            )}
          </div>

          {/* Role badge */}
          <span className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full border ${ROLE_COLOR[role]}`}>
            {role}
          </span>

          {/* Bio */}
          <div className="mt-5 mb-5">
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">Sobre {name.split(' ')[0]}</h3>
            <p className="text-text-primary text-sm leading-relaxed font-display italic">
              "{bio}"
            </p>
          </div>

          {/* Interests */}
          <div className="mb-5">
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">Intereses</h3>
            <div className="flex flex-wrap gap-2">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-mansion-gold/10 text-mansion-gold border border-mansion-gold/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Photo gallery */}
          {photos.length > 1 && (
            <div className="mb-4">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">Galería</h3>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden bg-mansion-card">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      </div>{/* end two-column wrapper */}

      {/* Sticky bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 safe-bottom lg:left-64 xl:left-72">
        <div className="glass border-t border-mansion-border/30">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3 flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="w-12 h-12 rounded-full border border-mansion-border flex items-center justify-center text-text-muted hover:text-mansion-crimson hover:border-mansion-crimson/40 transition-all"
            >
              <Heart className="w-5 h-5" />
            </motion.button>
            <Link
              to={`/mensajes/conv1`}
              className="btn-crimson flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="font-display font-semibold">Enviar Mensaje</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
