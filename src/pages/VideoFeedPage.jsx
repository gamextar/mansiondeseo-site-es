import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Plus, Volume2, VolumeX, Play, Film, ChevronUp, ChevronDown } from 'lucide-react';
import { getStories } from '../lib/api';
import { useAuth } from '../App';
import AvatarImg from '../components/AvatarImg';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z').getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function StoryCard({ story, isActive, onLike, isMuted, onToggleMute }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  };

  const handleVideoEnd = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center snap-start snap-always">
      {/* Video */}
      <video
        ref={videoRef}
        src={story.video_url}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        playsInline
        muted={isMuted}
        preload="auto"
        onClick={togglePlay}
        onEnded={handleVideoEnd}
      />

      {/* Play/Pause overlay */}
      <AnimatePresence>
        {showPlayIcon && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <div className="w-20 h-20 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm">
              <Play className={`w-10 h-10 text-white ${isPlaying ? 'hidden' : ''}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

      {/* Right side actions */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-20">
        {/* Like */}
        <button
          onClick={() => onLike(story.id)}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center ${story.liked ? 'bg-mansion-crimson/20' : 'bg-black/30 backdrop-blur-sm'}`}>
            <Heart className={`w-6 h-6 ${story.liked ? 'text-mansion-crimson fill-mansion-crimson' : 'text-white'}`} />
          </div>
          <span className="text-white text-[11px] font-semibold">{story.likes || 0}</span>
        </button>

        {/* Comment */}
        <button className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-[11px] font-semibold">{story.comments || 0}</span>
        </button>

        {/* Share */}
        <button className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-[11px] font-semibold">Enviar</span>
        </button>

        {/* Mute toggle */}
        <button onClick={onToggleMute} className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </div>
        </button>
      </div>

      {/* Bottom user info */}
      <div className="absolute left-4 right-20 bottom-6 z-20">
        <button
          onClick={() => navigate(`/perfiles/${story.user_id}`)}
          className="flex items-center gap-2.5 mb-3"
        >
          <div className="w-10 h-10 rounded-full border-2 border-white/60 overflow-hidden bg-mansion-elevated flex-shrink-0">
            {story.avatar_url ? (
              <AvatarImg src={story.avatar_url} crop={story.avatar_crop} alt={story.username} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/60 text-xs font-bold">{(story.username || '?')[0]}</div>
            )}
          </div>
          <div className="text-left">
            <p className="text-white font-semibold text-sm leading-tight">{story.username}</p>
            <p className="text-white/50 text-[11px]">{timeAgo(story.created_at)}</p>
          </div>
        </button>

        {story.caption && (
          <p className="text-white/90 text-sm leading-relaxed line-clamp-2">{story.caption}</p>
        )}
      </div>

      {/* Progress bar at top */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-[2px] z-30">
          <motion.div
            className="h-full bg-mansion-gold"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 15, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  );
}

export default function VideoFeedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const containerRef = useRef(null);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getStories()
      .then(data => {
        if (!cancelled) setStories(data.stories || []);
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const height = container.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < stories.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, stories.length]);

  const handleLike = useCallback((storyId) => {
    setStories(prev => prev.map(s =>
      s.id === storyId
        ? { ...s, liked: !s.liked, likes: s.liked ? (s.likes || 1) - 1 : (s.likes || 0) + 1 }
        : s
    ));
  }, []);

  const scrollToIndex = useCallback((index) => {
    const container = containerRef.current;
    if (!container) return;
    const height = container.clientHeight;
    container.scrollTo({ top: index * height, behavior: 'smooth' });
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-40">
        <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state
  if (stories.length === 0) {
    return (
      <div className="fixed inset-0 bg-mansion-base flex flex-col items-center justify-center z-40 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full bg-mansion-crimson/10 blur-3xl" />
          <div className="absolute bottom-[-12%] left-[-6%] w-[460px] h-[460px] rounded-full bg-mansion-gold/10 blur-3xl" />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative flex flex-col items-center text-center max-w-sm"
        >
          <div className="w-24 h-24 rounded-[2rem] bg-mansion-gold/10 border border-mansion-gold/20 flex items-center justify-center mb-6">
            <Film className="w-12 h-12 text-mansion-gold" />
          </div>

          <h1 className="font-display text-3xl font-bold text-text-primary mb-3">Historias</h1>
          <p className="text-text-muted mb-2">Todavía no hay historias publicadas.</p>
          <p className="text-sm text-text-dim mb-8">Sé el primero en compartir un momento con la comunidad.</p>

          <button
            onClick={() => navigate('/historia/nueva')}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light transition-colors shadow-[0_12px_30px_rgba(212,175,55,0.18)]"
          >
            <Plus className="w-5 h-5" />
            Subir mi historia
          </button>
        </motion.div>

        {/* Bottom nav spacing */}
        <div className="h-20" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-40">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 safe-top">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="font-display text-lg font-bold text-white drop-shadow-lg">Historias</h1>
          <button
            onClick={() => navigate('/historia/nueva')}
            className="w-9 h-9 rounded-full bg-mansion-gold flex items-center justify-center shadow-lg"
          >
            <Plus className="w-5 h-5 text-mansion-base" />
          </button>
        </div>
      </div>

      {/* Video feed container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {stories.map((story, index) => (
          <div key={story.id} className="h-full w-full" style={{ height: '100dvh' }}>
            <StoryCard
              story={story}
              isActive={index === activeIndex}
              onLike={handleLike}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(m => !m)}
            />
          </div>
        ))}
      </div>

      {/* Scroll hints */}
      {stories.length > 1 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30">
          {activeIndex > 0 && (
            <button
              onClick={() => scrollToIndex(activeIndex - 1)}
              className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
            >
              <ChevronUp className="w-4 h-4 text-white/70" />
            </button>
          )}
          {activeIndex < stories.length - 1 && (
            <button
              onClick={() => scrollToIndex(activeIndex + 1)}
              className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
            >
              <ChevronDown className="w-4 h-4 text-white/70" />
            </button>
          )}
        </div>
      )}

      {/* Story counter */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50">
        <div className="flex gap-1">
          {stories.length <= 10 && stories.map((_, i) => (
            <div
              key={i}
              className={`h-[2px] rounded-full transition-all duration-300 ${
                i === activeIndex ? 'w-6 bg-mansion-gold' : 'w-2 bg-white/30'
              }`}
            />
          ))}
          {stories.length > 10 && (
            <span className="text-white/60 text-xs font-medium">{activeIndex + 1} / {stories.length}</span>
          )}
        </div>
      </div>

      {/* Bottom safe area for nav */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-20 lg:hidden" />
    </div>
  );
}
