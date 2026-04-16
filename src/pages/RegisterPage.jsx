import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Camera,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Sparkles,
  Check,
  Heart,
  Globe,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { register as apiRegister, uploadImage, verifyCode as apiVerifyCode, resendCode as apiResendCode, detectCountry as apiDetectCountry, getPublicSettings, checkEmail as apiCheckEmail, checkUsername as apiCheckUsername, getMe } from '../lib/api';
import { calculateAgeFromBirthdate, getLatestAdultBirthdate, isAdultBirthdate } from '../lib/birthdate';
import { formatLocation } from '../lib/location';
import ImageCropper from '../components/ImageCropper';

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const TOTAL_STEPS = 5;

const ROLES = [
  {
    id: 'hombre',
    label: 'Hombre',
    color: '#3B82F6',
    colorDark: '#2563EB',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.4)',
  },
  {
    id: 'mujer',
    label: 'Mujer',
    color: '#EC4899',
    colorDark: '#DB2777',
    bg: 'rgba(236,72,153,0.12)',
    border: 'rgba(236,72,153,0.4)',
  },
  {
    id: 'pareja',
    label: 'Pareja',
    color: '#8B5CF6',
    colorDark: '#7C3AED',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.4)',
  },
];

const OTHER_ROLES = [
  {
    id: 'pareja_hombres',
    label: 'Pareja de Hombres',
    color: '#60A5FA',
    colorDark: '#2563EB',
    bg: 'rgba(96,165,250,0.12)',
    border: 'rgba(96,165,250,0.4)',
  },
  {
    id: 'pareja_mujeres',
    label: 'Pareja de Mujeres',
    color: '#F472B6',
    colorDark: '#DB2777',
    bg: 'rgba(244,114,182,0.12)',
    border: 'rgba(244,114,182,0.4)',
  },
  {
    id: 'trans',
    label: 'Trans',
    color: '#2DD4BF',
    colorDark: '#0F766E',
    bg: 'rgba(45,212,191,0.12)',
    border: 'rgba(45,212,191,0.4)',
  },
];

const ALL_ROLE_OPTIONS = [...ROLES, ...OTHER_ROLES];
const ALL_SEEKING_OPTIONS = [...ROLES, ...OTHER_ROLES];

const INTERESTS = [
  { id: 'swinger', label: 'Swinger', emoji: '🔄' },
  { id: 'trios', label: 'Tríos', emoji: '🔥' },
  { id: 'cuckold', label: 'Cuckold', emoji: '👀' },
  { id: 'fetiche', label: 'Fetiches', emoji: '⛓️' },
  { id: 'voyeur', label: 'Voyeur', emoji: '🕶️' },
  { id: 'bdsm', label: 'BDSM', emoji: '🖤' },
  { id: 'exhib', label: 'Exhibicionismo', emoji: '✨' },
  { id: 'roleplay', label: 'Roleplay', emoji: '🎭' },
];

const COUNTRY_NAMES = {
  AR: 'Argentina', CL: 'Chile', MX: 'México', CO: 'Colombia',
  PE: 'Perú', UY: 'Uruguay', EC: 'Ecuador', VE: 'Venezuela',
  BO: 'Bolivia', PY: 'Paraguay', BR: 'Brasil', PA: 'Panamá',
  CR: 'Costa Rica', DO: 'Rep. Dominicana', GT: 'Guatemala',
  HN: 'Honduras', SV: 'El Salvador', NI: 'Nicaragua', CU: 'Cuba',
  PR: 'Puerto Rico', ES: 'España', US: 'Estados Unidos',
};

// ────────────────────────────────────────────
// Person Figure SVG
// ────────────────────────────────────────────

function PersonFigure({ type, isActive, size = 'lg', optimizeMotion = false }) {
  const dimColor = '#3A3A4A';
  const dimColorDark = '#2A2A38';
  const roleData = ALL_ROLE_OPTIONS.find((r) => r.id === type) || ROLES[0];
  const color = isActive ? roleData.color : dimColor;
  const colorDark = isActive ? roleData.colorDark : dimColorDark;
  const soloSizeClass = size === 'lg' ? 'w-[68px] h-[96px]' : 'w-8 h-11';
  const pairSizeClass = size === 'lg' ? 'w-[78px] h-[96px]' : 'w-12 h-11';
  const shellTransition = optimizeMotion
    ? { duration: 0.22, ease: 'easeOut' }
    : { type: 'spring', stiffness: 300, damping: 22 };
  const shellScale = isActive ? (size === 'lg' ? 1.05 : 1.03) : 1;

  if (type === 'hombre') {
    return (
      <motion.div
        className="relative flex items-center justify-center transform-gpu"
        style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        animate={{ scale: shellScale }}
        transition={shellTransition}
      >
      <svg viewBox="0 0 80 120" className={soloSizeClass}>
        <motion.circle
          cx="40"
          cy="22"
          r="13"
          fill={color}
          animate={optimizeMotion ? undefined : { r: isActive ? 15 : 13 }}
          transition={optimizeMotion ? undefined : { type: 'spring', stiffness: 300 }}
        />
        <motion.rect
          x="23"
          y="40"
          width="34"
          height="38"
          rx="8"
          fill={color}
          animate={optimizeMotion ? undefined : { y: isActive ? 38 : 40 }}
        />
        <rect x="24" y="78" width="13" height="30" rx="6" fill={colorDark} />
        <rect x="43" y="78" width="13" height="30" rx="6" fill={colorDark} />
        {isActive && !optimizeMotion && (
          <motion.circle
            cx="40"
            cy="60"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="1"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        )}
      </svg>
      {isActive && optimizeMotion && (
        <motion.span
          className="pointer-events-none absolute inset-[14px] rounded-full border"
          style={{ borderColor: `${color}55`, willChange: 'transform, opacity', transform: 'translateZ(0)' }}
          initial={{ opacity: 0.18, scale: 0.94 }}
          animate={{ opacity: [0.18, 0], scale: [1, 1.12] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      </motion.div>
    );
  }

  if (type === 'mujer') {
    return (
      <motion.div
        className="relative flex items-center justify-center transform-gpu"
        style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        animate={{ scale: shellScale }}
        transition={shellTransition}
      >
      <svg viewBox="0 0 80 120" className={soloSizeClass}>
        <motion.circle
          cx="40"
          cy="22"
          r="13"
          fill={color}
          animate={optimizeMotion ? undefined : { r: isActive ? 15 : 13 }}
          transition={optimizeMotion ? undefined : { type: 'spring', stiffness: 300 }}
        />
        <motion.path
          d="M27 19 Q31 6 40 6 Q49 6 53 19"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <motion.path
          d="M29 40 L24 84 Q24 88 32 88 L48 88 Q56 88 56 84 L51 40 Q49 36 40 36 Q31 36 29 40 Z"
          fill={color}
        />
        <rect x="28" y="88" width="11" height="22" rx="5" fill={colorDark} />
        <rect x="41" y="88" width="11" height="22" rx="5" fill={colorDark} />
        {isActive && !optimizeMotion && (
          <motion.circle
            cx="40"
            cy="60"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="1"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        )}
      </svg>
      {isActive && optimizeMotion && (
        <motion.span
          className="pointer-events-none absolute inset-[14px] rounded-full border"
          style={{ borderColor: `${color}55`, willChange: 'transform, opacity', transform: 'translateZ(0)' }}
          initial={{ opacity: 0.18, scale: 0.94 }}
          animate={{ opacity: [0.18, 0], scale: [1, 1.12] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      </motion.div>
    );
  }

  if (type === 'trans') {
    return (
      <motion.div
        className="relative flex items-center justify-center transform-gpu"
        style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        animate={{ scale: shellScale }}
        transition={shellTransition}
      >
      <svg viewBox="0 0 80 120" className={soloSizeClass}>
        <motion.circle
          cx="40"
          cy="22"
          r="13"
          fill={color}
          animate={optimizeMotion ? undefined : { r: isActive ? 15 : 13 }}
          transition={optimizeMotion ? undefined : { type: 'spring', stiffness: 300 }}
        />
        <motion.path
          d="M27 20 Q32 8 40 8 Q48 8 53 20"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <motion.path
          d="M28 40 Q30 34 40 34 Q50 34 52 40 L48 82 Q47 88 40 88 Q33 88 32 82 Z"
          fill={color}
        />
        <rect x="30" y="88" width="10" height="22" rx="5" fill={colorDark} />
        <rect x="40" y="88" width="10" height="22" rx="5" fill={colorDark} />
        {isActive && !optimizeMotion && (
          <motion.circle
            cx="40"
            cy="60"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="1"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        )}
      </svg>
      {isActive && optimizeMotion && (
        <motion.span
          className="pointer-events-none absolute inset-[14px] rounded-full border"
          style={{ borderColor: `${color}55`, willChange: 'transform, opacity', transform: 'translateZ(0)' }}
          initial={{ opacity: 0.18, scale: 0.94 }}
          animate={{ opacity: [0.18, 0], scale: [1, 1.12] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      </motion.div>
    );
  }

  if (type === 'pareja_hombres') {
    return (
      <motion.div
        className="relative flex items-center justify-center transform-gpu"
        style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        animate={{ scale: shellScale }}
        transition={shellTransition}
      >
      <svg viewBox="0 0 120 120" className={pairSizeClass}>
        <motion.circle cx="38" cy="22" r="11" fill={color} animate={optimizeMotion ? undefined : { r: isActive ? 12 : 11 }} />
        <motion.rect x="27" y="38" width="22" height="30" rx="5" fill={color} />
        <rect x="28" y="70" width="9" height="22" rx="4" fill={colorDark} />
        <rect x="41" y="70" width="9" height="22" rx="4" fill={colorDark} />
        <motion.circle cx="82" cy="22" r="11" fill={color} animate={optimizeMotion ? undefined : { r: isActive ? 12 : 11 }} />
        <motion.rect x="71" y="38" width="22" height="30" rx="5" fill={color} />
        <rect x="72" y="70" width="9" height="22" rx="4" fill={colorDark} />
        <rect x="85" y="70" width="9" height="22" rx="4" fill={colorDark} />
        {isActive && !optimizeMotion && (
          <motion.circle
            cx="60"
            cy="58"
            r="44"
            fill="none"
            stroke={color}
            strokeWidth="1"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.35], opacity: [0.4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        )}
      </svg>
      {isActive && optimizeMotion && (
        <motion.span
          className="pointer-events-none absolute inset-[10px] rounded-full border"
          style={{ borderColor: `${color}55`, willChange: 'transform, opacity', transform: 'translateZ(0)' }}
          initial={{ opacity: 0.16, scale: 0.95 }}
          animate={{ opacity: [0.16, 0], scale: [1, 1.1] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      </motion.div>
    );
  }

  if (type === 'pareja_mujeres') {
    return (
      <motion.div
        className="relative flex items-center justify-center transform-gpu"
        style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        animate={{ scale: shellScale }}
        transition={shellTransition}
      >
      <svg viewBox="0 0 120 120" className={pairSizeClass}>
        <motion.circle cx="38" cy="22" r="11" fill={color} animate={optimizeMotion ? undefined : { r: isActive ? 12 : 11 }} />
        <motion.path d="M28 18 Q32 8 38 8 Q44 8 48 18" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        <motion.path d="M28 38 L26 70 Q26 74 32 74 L44 74 Q50 74 50 70 L48 38 Q46 34 38 34 Q30 34 28 38 Z" fill={color} />
        <rect x="29" y="74" width="8" height="18" rx="4" fill={colorDark} />
        <rect x="39" y="74" width="8" height="18" rx="4" fill={colorDark} />
        <motion.circle cx="82" cy="22" r="11" fill={color} animate={optimizeMotion ? undefined : { r: isActive ? 12 : 11 }} />
        <motion.path d="M72 18 Q76 8 82 8 Q88 8 92 18" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        <motion.path d="M72 38 L70 70 Q70 74 76 74 L88 74 Q94 74 94 70 L92 38 Q90 34 82 34 Q74 34 72 38 Z" fill={color} />
        <rect x="73" y="74" width="8" height="18" rx="4" fill={colorDark} />
        <rect x="83" y="74" width="8" height="18" rx="4" fill={colorDark} />
        {isActive && !optimizeMotion && (
          <motion.circle
            cx="60"
            cy="58"
            r="44"
            fill="none"
            stroke={color}
            strokeWidth="1"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.35], opacity: [0.4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        )}
      </svg>
      {isActive && optimizeMotion && (
        <motion.span
          className="pointer-events-none absolute inset-[10px] rounded-full border"
          style={{ borderColor: `${color}55`, willChange: 'transform, opacity', transform: 'translateZ(0)' }}
          initial={{ opacity: 0.16, scale: 0.95 }}
          animate={{ opacity: [0.16, 0], scale: [1, 1.1] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      </motion.div>
    );
  }

  // Pareja
  return (
    <motion.div
      className="relative flex items-center justify-center transform-gpu"
      style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
      animate={{ scale: shellScale }}
      transition={shellTransition}
    >
    <svg viewBox="0 0 120 120" className={pairSizeClass}>
      <motion.circle cx="38" cy="22" r="11" fill={color} animate={optimizeMotion ? undefined : { r: isActive ? 12 : 11 }} />
      <motion.rect x="27" y="38" width="22" height="30" rx="5" fill={color} />
      <rect x="28" y="70" width="9" height="22" rx="4" fill={colorDark} />
      <rect x="41" y="70" width="9" height="22" rx="4" fill={colorDark} />

      <motion.circle cx="82" cy="22" r="11" fill={color} animate={optimizeMotion ? undefined : { r: isActive ? 12 : 11 }} />
      <motion.path
        d="M69 19 Q73 8 82 8 Q91 8 95 19"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <motion.path
        d="M72 38 L70 70 Q70 74 76 74 L88 74 Q94 74 94 70 L92 38 Q90 34 82 34 Q74 34 72 38 Z"
        fill={color}
      />
      <rect x="72" y="74" width="9" height="20" rx="4" fill={colorDark} />
      <rect x="85" y="74" width="9" height="20" rx="4" fill={colorDark} />

      {isActive && !optimizeMotion && (
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <text x="60" y="52" fontSize="14" textAnchor="middle" fill="#C9A84C">
            ♥
          </text>
        </motion.g>
      )}
      {isActive && !optimizeMotion && (
        <motion.ellipse
          cx="60"
          cy="55"
          rx="50"
          ry="45"
          fill="none"
          stroke={color}
          strokeWidth="1"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [1, 1.3], opacity: [0.3, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}
    </svg>
    {isActive && optimizeMotion && (
      <motion.span
        className="pointer-events-none absolute inset-[10px] rounded-full border"
        style={{ borderColor: `${color}55`, willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        initial={{ opacity: 0.16, scale: 0.95 }}
        animate={{ opacity: [0.16, 0], scale: [1, 1.1] }}
        transition={{ duration: 1.35, repeat: Infinity, ease: 'easeOut' }}
      />
    )}
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Profile Card Preview ("Ficha")
// ────────────────────────────────────────────

function FichaPreview({ data, currentStep, roleImages = {}, optimizeMotion = false }) {
  const { role, seeking, interests, name } = data;
  const seekingArr = Array.isArray(seeking) ? seeking : (seeking ? [seeking] : []);
  const locationText = formatLocation(data);
  const previewAge = calculateAgeFromBirthdate(data.birthdate);

  const renderPreviewRole = (roleId) => {
    const customImg = roleImages[roleId];
    if (customImg) {
      return (
        <div className="h-11 w-8 overflow-hidden rounded-lg">
          <img src={customImg} alt="" className="h-full w-full object-cover" />
        </div>
      );
    }
    return <PersonFigure type={roleId} isActive size="sm" optimizeMotion={optimizeMotion} />;
  };

  if (currentStep < 1 && !role) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scaleY: 0.8 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      transition={optimizeMotion ? { duration: 0.22, ease: 'easeOut' } : { type: 'spring', stiffness: 200, damping: 20 }}
      className="mx-auto mb-4 w-full max-w-[390px] sm:max-w-[420px] transform-gpu"
      style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
    >
      <motion.div
        layout={optimizeMotion ? undefined : true}
        className="bg-mansion-card/90 backdrop-blur-sm rounded-2xl border border-mansion-border/40 p-3 relative overflow-hidden"
      >
        {/* Gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-mansion-gold/40 to-transparent" />

        {/* Figures row: Soy ♥ Busco */}
        <AnimatePresence>
          {(role || seekingArr.length > 0) && (
            <motion.div
              layout={optimizeMotion ? undefined : true}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={optimizeMotion ? { duration: 0.2, ease: 'easeOut' } : undefined}
              className="flex items-center justify-center gap-2 sm:gap-3"
            >
              {role && (
                <motion.div
                  initial={{ opacity: 0, x: -20, scale: 0.5 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={optimizeMotion ? { duration: 0.2, ease: 'easeOut' } : { type: 'spring', stiffness: 300 }}
                  className="flex flex-col items-center"
                >
                  {renderPreviewRole(role)}
                  <span className="text-[10px] text-text-dim mt-0.5">Soy</span>
                </motion.div>
              )}

              {role && seekingArr.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={optimizeMotion ? { duration: 0.18, delay: 0.04, ease: 'easeOut' } : { type: 'spring', delay: 0.1 }}
                >
                  <Heart className="w-3.5 h-3.5 text-mansion-crimson fill-mansion-crimson" />
                </motion.div>
              )}

              {seekingArr.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20, scale: 0.5 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={optimizeMotion ? { duration: 0.2, ease: 'easeOut' } : { type: 'spring', stiffness: 300 }}
                  className="flex flex-col items-center"
                >
                  <div className="max-w-[240px] overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-hide [-webkit-overflow-scrolling:touch]">
                    <div className="inline-flex min-w-max items-end justify-start gap-0.5 px-1 pb-1">
                    {seekingArr.map((s, i) => (
                      <motion.div
                        key={s}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={optimizeMotion ? { duration: 0.18, delay: i * 0.04, ease: 'easeOut' } : { delay: i * 0.1 }}
                    >
                        {renderPreviewRole(s)}
                      </motion.div>
                    ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-text-dim mt-0.5">Busco</span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name & location */}
        <AnimatePresence>
          {name && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mt-2"
            >
              <p className="text-text-primary font-display text-sm font-semibold">
                {name}
                {previewAge ? `, ${previewAge}` : ''}
              </p>
              {locationText && (
                <p className="text-text-dim text-[11px] flex items-center justify-center gap-1">
                  <MapPin className="w-2.5 h-2.5" /> {locationText}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interests */}
        <AnimatePresence>
          {interests && interests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-1 justify-center mt-2"
            >
              {interests.slice(0, 4).map((intId, i) => {
                const interest = INTERESTS.find((x) => x.id === intId);
                return interest ? (
                  <motion.span
                    key={intId}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="text-[9px] px-1.5 py-0.5 rounded-full bg-mansion-gold/10 text-mansion-gold border border-mansion-gold/20"
                  >
                    {interest.emoji} {interest.label}
                  </motion.span>
                ) : null;
              })}
              {interests.length > 4 && (
                <span className="text-[9px] px-1.5 py-0.5 text-text-dim">
                  +{interests.length - 4}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Step Components
// ────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]{1,64}@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,24}$/;
const COMMON_TLDS = new Set([
  'com','net','org','edu','gov','mil','int',
  'ar','br','cl','co','mx','pe','uy','ve','ec','py','bo','cr','pa','do','gt','sv','hn','ni','cu','pr',
  'es','uk','fr','de','it','pt','nl','be','at','ch','pl','ru','ua','cz','se','no','dk','fi','ie','gr','ro','hu','bg','hr','sk','si','rs','ba','me','mk','al','lt','lv','ee','is','lu','mt','cy','li','mc','ad','sm','va',
  'us','ca','au','nz','jp','cn','kr','in','id','ph','th','vn','my','sg','tw','hk','il','tr','sa','ae','za',
  'io','ai','app','dev','me','tv','cc','info','biz','name','pro','mobi','tel','jobs','travel','museum','coop','aero','cat',
  'online','site','store','shop','cloud','tech','xyz','club','live','world','blog','design','digital','studio','media','agency','solutions','network','systems','consulting','services','group','global','company','team','zone','space','plus','top','life','work','rocks','fun','icu','website','link','click','center','email','support','today','news','one','page',
  'com.ar','gob.ar','edu.ar','com.br','com.mx','com.co','com.uy','com.pe','com.cl','com.ve','com.ec','com.py',
  'co.uk','org.uk','ac.uk','co.jp','co.kr','co.nz','com.au','co.za','co.in',
]);
function isValidEmailTld(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;
  const parts = domain.toLowerCase().split('.');
  if (parts.length < 2) return false;
  // Check two-part TLD first (com.ar, co.uk), then single TLD
  if (parts.length >= 3) {
    const twoPartTld = parts.slice(-2).join('.');
    if (COMMON_TLDS.has(twoPartTld)) return true;
  }
  return COMMON_TLDS.has(parts[parts.length - 1]);
}
const USERNAME_REGEX = /^[a-zA-Z0-9._]+$/;

function StepEmail({ email, password, onEmailChange, onPasswordChange, hidePasswordDefault, emailStatus, onEmailBlur, onNavigateRecover }) {
  const [showPassword, setShowPassword] = useState(!hidePasswordDefault);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Sync with server setting once it arrives (useState only reads initial value once)
  useEffect(() => {
    setShowPassword(!hidePasswordDefault);
  }, [hidePasswordDefault]);

  const borderColor = emailStatus === 'valid' ? 'border-green-500/60' : emailStatus === 'exists' || emailStatus === 'invalid' ? 'border-mansion-crimson/60' : '';
  const passwordInvalid = passwordTouched && password.length > 0 && password.length < 10;
  const passwordValid = password.length >= 10;

  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="w-16 h-16 mx-auto mb-6 rounded-full bg-mansion-gold/10 border border-mansion-gold/30 flex items-center justify-center"
      >
        <Sparkles className="w-7 h-7 text-mansion-gold" />
      </motion.div>

      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
        Crear acceso
      </h2>
      <p className="text-text-muted text-sm mb-8">Creá tu cuenta para empezar a explorar el sitio</p>

      <div className="space-y-4 max-w-xs mx-auto text-left">
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              onBlur={onEmailBlur}
              placeholder="tu@email.com"
              className={`w-full pl-10 pr-10 ${borderColor}`}
              autoComplete="email"
            />
            {emailStatus === 'checking' && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim animate-spin" />
            )}
            {emailStatus === 'valid' && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
            )}
            {(emailStatus === 'exists' || emailStatus === 'invalid') && (
              <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mansion-crimson" />
            )}
          </div>
          {emailStatus === 'invalid' && (
            <p className="text-mansion-crimson text-[11px] mt-1">Ingresa una dirección de email válida</p>
          )}
          {emailStatus === 'exists' && (
            <div className="mt-1">
              <p className="text-mansion-crimson text-[11px]">Este email ya está registrado.</p>
              <button
                type="button"
                onClick={onNavigateRecover}
                className="text-mansion-gold text-[11px] font-medium hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value.slice(0, 50))}
              onBlur={() => setPasswordTouched(true)}
              placeholder="Mínimo 10 caracteres"
              className={`w-full pl-10 pr-10 ${passwordInvalid ? 'border-mansion-crimson/60' : passwordValid ? 'border-green-500/60' : ''}`}
              autoComplete="new-password"
              maxLength={50}
            />
            {passwordValid && (
              <CheckCircle2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
            )}
            {passwordInvalid && (
              <AlertCircle className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-mansion-crimson" />
            )}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordInvalid && (
            <p className="text-mansion-crimson text-[11px] mt-1">Mínimo 10 caracteres ({password.length}/10)</p>
          )}
          {passwordValid && (
            <p className="text-green-500 text-[11px] mt-1">Contraseña válida ({password.length}/10)</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleGrid({ selected, onSelect, title, subtitle, roleImages = {}, optimizeMotion = false }) {
  const [showOtherRoles, setShowOtherRoles] = useState(() => OTHER_ROLES.some((role) => role.id === selected));

  useEffect(() => {
    if (OTHER_ROLES.some((role) => role.id === selected)) {
      setShowOtherRoles(true);
    }
  }, [selected]);

  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">{title}</h2>
      <p className="text-text-muted text-sm mb-8">{subtitle}</p>

      <div className="grid grid-cols-3 gap-3 justify-center max-w-[420px] mx-auto">
        {ROLES.map((role) => {
          const isActive = selected === role.id;
          const customImg = roleImages[role.id];
          return (
            <motion.button
              key={role.id}
              whileTap={{ scale: 0.93 }}
              whileHover={optimizeMotion ? undefined : { scale: 1.03 }}
              onClick={() => onSelect(role.id)}
              className="flex min-h-[162px] w-full flex-col items-center p-3 rounded-2xl transition-colors duration-300 border-2 relative"
              style={{
                backgroundColor: isActive ? role.bg : 'rgba(17,17,24,0.5)',
                borderColor: isActive ? role.border : 'rgba(42,42,56,0.3)',
              }}
            >
              {customImg ? (
                <div className={`w-20 h-[102px] rounded-xl overflow-hidden transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                  <img src={customImg} alt={role.label} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-[102px] flex items-center justify-center">
                  <PersonFigure type={role.id} isActive={isActive} size="lg" optimizeMotion={optimizeMotion} />
                </div>
              )}
              <span
                className={`mt-2 font-medium text-sm text-center leading-tight ${
                  isActive ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {role.label}
              </span>
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: role.color }}
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowOtherRoles((prev) => !prev)}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-mansion-border/60 bg-mansion-card/70 px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          Otros
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showOtherRoles ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showOtherRoles && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            className="overflow-visible px-1"
          >
            <div className="mt-4 grid grid-cols-3 gap-3 justify-center max-w-[420px] mx-auto">
              {OTHER_ROLES.map((role) => {
                const isActive = selected === role.id;
                const customImg = roleImages[role.id];
                return (
                  <motion.button
                    key={role.id}
                    whileTap={{ scale: 0.93 }}
                    whileHover={optimizeMotion ? undefined : { scale: 1.03 }}
                    onClick={() => onSelect(role.id)}
                    className="flex min-h-[162px] w-full flex-col items-center p-3 rounded-2xl transition-colors duration-300 border-2 relative"
                    style={{
                      backgroundColor: isActive ? role.bg : 'rgba(17,17,24,0.5)',
                      borderColor: isActive ? role.border : 'rgba(42,42,56,0.3)',
                    }}
                  >
                    {customImg ? (
                      <div className={`w-20 h-[102px] rounded-xl overflow-hidden transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                        <img src={customImg} alt={role.label} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-[102px] flex items-center justify-center">
                        <PersonFigure type={role.id} isActive={isActive} size="lg" optimizeMotion={optimizeMotion} />
                      </div>
                    )}
                    <span className={`mt-2 font-medium text-sm leading-tight ${isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                      {role.label}
                    </span>
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: role.color }}
                        >
                          <Check className="w-3.5 h-3.5 text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SeekingGrid({ selected, onToggle, roleImages = {}, optimizeMotion = false }) {
  const [showOtherRoles, setShowOtherRoles] = useState(() => OTHER_ROLES.some((role) => selected.includes(role.id)));

  useEffect(() => {
    if (OTHER_ROLES.some((role) => selected.includes(role.id))) {
      setShowOtherRoles(true);
    }
  }, [selected]);

  // Sort: selected items first (in selection order), then unselected
  const sorted = [...ROLES].sort((a, b) => {
    const aIdx = selected.indexOf(a.id);
    const bIdx = selected.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return 0;
  });

  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Busco...</h2>
      <p className="text-text-muted text-sm mb-8">¿Qué tipo de conexión te interesa? Podés elegir más de uno.</p>

      <LayoutGroup>
        <div className="grid grid-cols-3 gap-3 justify-center max-w-[420px] mx-auto">
          {sorted.map((role) => {
            const isActive = selected.includes(role.id);
            const customImg = roleImages[role.id];
            return (
              <motion.button
                key={role.id}
                layout={optimizeMotion ? undefined : true}
                transition={optimizeMotion ? { duration: 0.2, ease: 'easeOut' } : { type: 'spring', stiffness: 400, damping: 30 }}
                whileTap={{ scale: 0.93 }}
                whileHover={optimizeMotion ? undefined : { scale: 1.03 }}
                onClick={() => onToggle(role.id)}
                className="flex min-h-[162px] w-full flex-col items-center p-3 rounded-2xl transition-colors duration-300 border-2 relative"
                style={{
                  backgroundColor: isActive ? role.bg : 'rgba(17,17,24,0.5)',
                  borderColor: isActive ? role.border : 'rgba(42,42,56,0.3)',
                }}
              >
                {customImg ? (
                  <div className={`w-20 h-[102px] rounded-xl overflow-hidden transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                    <img src={customImg} alt={role.label} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-[102px] flex items-center justify-center">
                    <PersonFigure type={role.id} isActive={isActive} size="lg" optimizeMotion={optimizeMotion} />
                  </div>
                )}
                <span
                  className={`mt-2 font-medium text-sm text-center leading-tight ${
                    isActive ? 'text-text-primary' : 'text-text-muted'
                  }`}
                >
                  {role.label}
                </span>
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: role.color }}
                    >
                      <Check className="w-3.5 h-3.5 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </LayoutGroup>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowOtherRoles((prev) => !prev)}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-mansion-border/60 bg-mansion-card/70 px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          Otros
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showOtherRoles ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showOtherRoles && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            className="overflow-visible px-1"
          >
            <div className="mt-4 grid grid-cols-3 gap-3 justify-center max-w-[420px] mx-auto">
              {OTHER_ROLES.map((role) => {
                const isActive = selected.includes(role.id);
                const customImg = roleImages[role.id];
                return (
                  <motion.button
                    key={role.id}
                    whileTap={{ scale: 0.93 }}
                    whileHover={optimizeMotion ? undefined : { scale: 1.03 }}
                    onClick={() => onToggle(role.id)}
                    className="flex min-h-[162px] w-full flex-col items-center p-3 rounded-2xl transition-colors duration-300 border-2 relative"
                    style={{
                      backgroundColor: isActive ? role.bg : 'rgba(17,17,24,0.5)',
                      borderColor: isActive ? role.border : 'rgba(42,42,56,0.3)',
                    }}
                  >
                    {customImg ? (
                      <div className={`w-20 h-[102px] rounded-xl overflow-hidden transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                        <img src={customImg} alt={role.label} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-[102px] flex items-center justify-center">
                        <PersonFigure type={role.id} isActive={isActive} size="lg" optimizeMotion={optimizeMotion} />
                      </div>
                    )}
                    <span className={`mt-2 font-medium text-sm text-center leading-tight ${isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                      {role.label}
                    </span>
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: role.color }}
                        >
                          <Check className="w-3.5 h-3.5 text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function StepInterests({ selected, onToggle }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Mis intereses</h2>
      <p className="text-text-muted text-sm mb-8">Selecciona al menos 1</p>

      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        {INTERESTS.map((item) => {
          const isActive = selected.includes(item.id);
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onToggle(item.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border relative ${
                isActive
                  ? 'bg-mansion-gold/15 border-mansion-gold/40 text-mansion-gold'
                  : 'bg-mansion-card border-mansion-border/40 text-text-muted hover:border-mansion-border'
              }`}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute top-1 right-1"
                  >
                    <Check className="w-3 h-3 text-mansion-gold" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function StepBasicInfo({ data, onChange, showCountryPicker, allowedCountries, selectedCountry, onCountryChange, usernameStatus, onUsernameBlur }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const latestAdultBirthdate = getLatestAdultBirthdate();
  const enteredAge = calculateAgeFromBirthdate(data.birthdate);

  // Local state for partial date selections (survives incomplete picks)
  const initParts = data.birthdate ? data.birthdate.split('-') : [];
  const [bdYear, setBdYear] = useState(initParts[0] || '');
  const [bdMonth, setBdMonth] = useState(initParts[1] || '');
  const [bdDay, setBdDay] = useState(initParts[2] || '');

  const currentYear = new Date().getUTCFullYear();
  const defaultYear = currentYear - 18;
  const minYear = currentYear - 90;

  const MONTHS = [
    { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' }, { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' }, { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
  ];

  // Days in selected month/year
  const daysInMonth = bdYear && bdMonth
    ? new Date(Number(bdYear), Number(bdMonth), 0).getDate()
    : 31;

  // Sync to parent only when all 3 parts are set
  const syncBirthdate = (y, m, d) => {
    if (y && m && d) {
      onChange({ ...data, birthdate: `${y}-${m}-${d}` });
    } else if (data.birthdate) {
      onChange({ ...data, birthdate: '' });
    }
  };

  const selectClass = "appearance-none bg-mansion-elevated border border-mansion-border/30 text-text-primary rounded-xl px-3 py-3 text-base font-medium focus:outline-none focus:border-mansion-gold/50 focus:ring-1 focus:ring-mansion-gold/20 transition-colors cursor-pointer";

  const ARGENTINA_PROVINCES = [
    'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
    'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
    'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
    'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
    'Tierra del Fuego', 'Tucumán',
  ];

  const filtered = data.province && selectedCountry === 'AR'
    ? ARGENTINA_PROVINCES.filter(province =>
        province.toLowerCase().includes(data.province.toLowerCase()) && province.toLowerCase() !== data.province.toLowerCase()
      ).slice(0, 5)
    : [];

  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Casi listo</h2>
      <p className="text-text-muted text-sm mb-8">Cuéntanos un poco más sobre ti</p>

      <div className="space-y-4 max-w-xs mx-auto text-left">
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">
            Nombre de usuario (o alias)
          </label>
          <div className="relative">
            <input
              type="text"
              value={data.name}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9._]/g, '').slice(0, 20);
                onChange({ ...data, name: val });
              }}
              onBlur={onUsernameBlur}
              placeholder="Evita datos reales como Apellido etc"
              maxLength={20}
              className={`w-full pr-10 ${
                usernameStatus === 'valid' ? 'border-green-500/60' :
                usernameStatus === 'exists' || usernameStatus === 'invalid' ? 'border-mansion-crimson/60' : ''
              }`}
            />
            {usernameStatus === 'checking' && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim animate-spin" />
            )}
            {usernameStatus === 'valid' && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
            )}
            {(usernameStatus === 'exists' || usernameStatus === 'invalid') && (
              <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mansion-crimson" />
            )}
          </div>
          <div className="flex justify-between mt-0.5">
            <p className="text-[10px] text-text-dim">Solo letras, números, puntos y _</p>
            <p className="text-[10px] text-text-dim">{data.name.length}/20</p>
          </div>
          {usernameStatus === 'exists' && (
            <p className="text-mansion-crimson text-[11px] mt-0.5">Este nombre ya está en uso</p>
          )}
          {usernameStatus === 'invalid' && (
            <p className="text-mansion-crimson text-[11px] mt-0.5">Solo letras, números, puntos y guiones bajos</p>
          )}
        </div>
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">Fecha de nacimiento</label>
          <p className="text-[10px] text-text-dim mb-1.5">Solo se mostrara tu edad.</p>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={bdDay}
              onChange={(e) => {
                const d = e.target.value;
                setBdDay(d);
                syncBirthdate(bdYear, bdMonth, d);
              }}
              className={selectClass}
            >
              <option value="" disabled>Día</option>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = String(i + 1).padStart(2, '0');
                return <option key={d} value={d}>{i + 1}</option>;
              })}
            </select>
            <select
              value={bdMonth}
              onChange={(e) => {
                const newMonth = e.target.value;
                const maxDay = bdYear ? new Date(Number(bdYear), Number(newMonth), 0).getDate() : 31;
                const clampedDay = bdDay && Number(bdDay) > maxDay ? String(maxDay).padStart(2, '0') : bdDay;
                setBdMonth(newMonth);
                if (clampedDay !== bdDay) setBdDay(clampedDay);
                syncBirthdate(bdYear, newMonth, clampedDay);
              }}
              className={selectClass}
            >
              <option value="" disabled>Mes</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={bdYear}
              onChange={(e) => {
                const newYear = e.target.value;
                const maxDay = bdMonth ? new Date(Number(newYear), Number(bdMonth), 0).getDate() : 31;
                const clampedDay = bdDay && Number(bdDay) > maxDay ? String(maxDay).padStart(2, '0') : bdDay;
                setBdYear(newYear);
                if (clampedDay !== bdDay) setBdDay(clampedDay);
                syncBirthdate(newYear, bdMonth, clampedDay);
              }}
              className={selectClass}
            >
              <option value="" disabled>Año</option>
              {Array.from({ length: defaultYear - minYear + 1 }, (_, i) => {
                const y = defaultYear - i;
                return <option key={y} value={String(y)}>{y}</option>;
              })}
            </select>
          </div>
          {enteredAge && (
            <p className="text-[10px] text-text-dim mt-1">Edad actual: {enteredAge} años</p>
          )}
          {data.birthdate && !isAdultBirthdate(data.birthdate) && (
            <p className="text-[10px] text-mansion-crimson mt-0.5">Debes ser mayor de 18 años</p>
          )}
        </div>
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">Provincia</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="text"
              value={data.province}
              onChange={(e) => {
                onChange({ ...data, province: e.target.value.slice(0, 40) });
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Buenos Aires"
              maxLength={40}
              className="w-full pl-10"
            />
            {showSuggestions && filtered.length > 0 && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-mansion-card border border-mansion-border/40 rounded-xl overflow-hidden shadow-lg">
                {filtered.map((province) => (
                  <button
                    key={province}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange({ ...data, province });
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-mansion-elevated/50 transition-colors"
                  >
                    {province}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">Localidad / Zona</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="text"
              value={data.locality}
              onChange={(e) => onChange({ ...data, locality: e.target.value.slice(0, 40) })}
              placeholder="Palermo, San Isidro, Zona Norte..."
              maxLength={40}
              className="w-full pl-10"
            />
          </div>
        </div>
        <div>
          <label className="text-text-muted text-xs font-medium mb-1.5 block">Bio corta</label>
          <textarea
            value={data.bio}
            onChange={(e) => onChange({ ...data, bio: e.target.value.slice(0, 200) })}
            placeholder="Cuéntanos qué te trae a la Mansión..."
            rows={3}
            maxLength={200}
            className="w-full resize-none"
          />
          <p className="text-[10px] text-text-dim text-right mt-0.5">{data.bio.length}/200</p>
        </div>

        {showCountryPicker && (
          <div>
            <label className="text-text-muted text-xs font-medium mb-1.5 block">
              <Globe className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
              País
            </label>
            <p className="text-[11px] text-mansion-gold/70 mb-2">
              No pudimos detectar tu país automáticamente. Seleccioná uno:
            </p>
            <div className="flex flex-wrap gap-2">
              {allowedCountries.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onCountryChange(code)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedCountry === code
                      ? 'bg-mansion-gold/20 border-mansion-gold text-mansion-gold border'
                      : 'bg-mansion-elevated border border-mansion-border/30 text-text-muted hover:border-mansion-gold/40'
                  }`}
                >
                  {COUNTRY_NAMES[code] || code}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepPhoto({ photoFile, onPhotoSelect }) {
  const previewUrl = photoFile ? URL.createObjectURL(photoFile) : null;
  const [rawFile, setRawFile] = useState(null);

  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
        Tu foto de perfil
      </h2>
      <p className="text-text-muted text-sm mb-2">
        Subi al menos una foto, preferentemente algo sensual / sugerente.
      </p>
      <p className="text-text-dim text-xs mb-8">
        No te preocupes, podras subir fotos explicitas en tu galeria.
      </p>

      <label htmlFor="photo-upload" className="cursor-pointer block">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-36 h-36 mx-auto rounded-full border-2 border-dashed border-mansion-gold/40
                     bg-mansion-card flex flex-col items-center justify-center
                     hover:border-mansion-gold/60 hover:bg-mansion-gold/5 transition-all overflow-hidden"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <>
              <Camera className="w-8 h-8 text-mansion-gold mb-2" />
              <span className="text-text-muted text-xs">Subir foto</span>
            </>
          )}
        </motion.div>
      </label>
      <input
        id="photo-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setRawFile(file);
          e.target.value = '';
        }}
      />

      {rawFile && (
        <ImageCropper
          file={rawFile}
          onCrop={(cropped) => {
            onPhotoSelect(cropped);
            setRawFile(null);
          }}
          onCancel={() => setRawFile(null)}
        />
      )}

    </div>
  );
}

// ────────────────────────────────────────────
// Email Verification Screen
// ────────────────────────────────────────────

function VerificationScreen({ email, devCode, onVerified, onResend }) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (code.length < 6) return;
    setVerifying(true);
    setError('');
    try {
      const data = await apiVerifyCode(email, code);
      onVerified(data);
    } catch (err) {
      setError(err.message || 'Código inválido');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    try {
      await apiResendCode(email);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch {
      // silently fail
    } finally {
      setResending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleVerify();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center text-center px-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
      >
        <div className="w-20 h-20 rounded-full bg-mansion-gold/10 border border-mansion-gold/30 flex items-center justify-center mb-6">
          <Mail className="w-9 h-9 text-mansion-gold" />
        </div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="font-display text-2xl font-bold text-text-primary mb-2"
      >
        Verifica tu email
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-text-muted text-sm mb-8 max-w-xs"
      >
        Hemos enviado un código de 6 dígitos a <span className="text-mansion-gold font-medium">{email}</span>
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-[280px]"
      >
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={handleKeyDown}
          placeholder="000000"
          className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4"
          autoFocus
        />

        {error && (
          <p className="text-mansion-crimson text-xs mt-3">{error}</p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleVerify}
          disabled={code.length < 6 || verifying}
          className={`w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2 mt-6 transition-all ${
            code.length === 6 && !verifying
              ? 'btn-gold'
              : 'bg-mansion-elevated text-text-dim cursor-not-allowed'
          }`}
        >
          {verifying ? 'Verificando...' : 'Verificar'}
          {!verifying && <ChevronRight className="w-5 h-5" />}
        </motion.button>

        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={handleResend}
            disabled={resending || resent}
            className="text-mansion-gold text-xs font-medium hover:underline disabled:opacity-50"
          >
            {resent ? '✓ Código reenviado' : resending ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
          </button>
          <p className="text-text-dim text-[10px]">
            Revisa tu carpeta de spam
          </p>
          {devCode && (
            <p className="mt-3 px-3 py-2 rounded-lg bg-mansion-gold/10 border border-mansion-gold/20 text-mansion-gold text-xs font-mono">
              DEV: {devCode}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Success Screen
// ────────────────────────────────────────────

function SuccessScreen({ onEnter }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center text-center px-6"
    >
      {/* Sparkle particles */}
      <div className="relative">
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const radius = 70 + (i % 3) * 20;
          return (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 0.8, 0],
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
              }}
              transition={{
                delay: 0.3 + i * 0.06,
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 2.5,
              }}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  i % 3 === 0 ? '#C9A84C' : i % 3 === 1 ? '#D4183D' : '#8B5CF6',
                left: '50%',
                top: '50%',
              }}
            />
          );
        })}

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="relative z-10"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-mansion-gold/20 to-mansion-crimson/20 border border-mansion-gold/30 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-mansion-gold" />
          </div>
        </motion.div>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="font-display text-3xl font-bold text-text-primary mt-8 mb-3"
      >
        Acceso creado
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-text-muted text-sm mb-10 max-w-xs"
      >
        Tu perfil está listo. Ahora podés explorar el sitio y conectar con personas afines.
      </motion.p>

      <button
        onClick={onEnter}
        className="fade-in-up fade-delay-600 btn-gold text-lg font-display flex items-center gap-2 active:scale-[0.97]"
      >
        Entrar al sitio
        <ChevronRight className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Main RegisterPage
// ────────────────────────────────────────────

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setRegistered, setUser } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [iAm, setIAm] = useState(null);
  const [seeking, setSeeking] = useState([]);
  const [interests, setInterests] = useState([]);
  const [info, setInfo] = useState({ name: '', birthdate: '', province: '', locality: '', bio: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [devCode, setDevCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle'); // idle | checking | valid | exists | invalid
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle | checking | valid | exists | invalid

  // Country detection
  const [detectedCountry, setDetectedCountry] = useState('');
  const [allowedCountries, setAllowedCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [hidePasswordDefault, setHidePasswordDefault] = useState(true);
  const [roleImages, setRoleImages] = useState({});
  const [optimizeOnboardingMotion, setOptimizeOnboardingMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const coarseMq = window.matchMedia('(pointer: coarse)');
    const narrowMq = window.matchMedia('(max-width: 768px)');
    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    const applyMotionProfile = () => {
      setOptimizeOnboardingMotion(coarseMq.matches || narrowMq.matches || reducedMq.matches);
    };

    const addListener = (mq, handler) => {
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', handler);
      else mq.addListener(handler);
    };
    const removeListener = (mq, handler) => {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };

    applyMotionProfile();
    addListener(coarseMq, applyMotionProfile);
    addListener(narrowMq, applyMotionProfile);
    addListener(reducedMq, applyMotionProfile);

    return () => {
      removeListener(coarseMq, applyMotionProfile);
      removeListener(narrowMq, applyMotionProfile);
      removeListener(reducedMq, applyMotionProfile);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      apiDetectCountry().catch(() => ({ country: '' })),
      getPublicSettings().catch(() => ({ settings: {} })),
    ]).then(([detectData, settingsData]) => {
      const detected = detectData.country || '';
      const allowed = (settingsData.settings?.allowedCountries || 'AR').split(',').map(c => c.trim()).filter(Boolean);
      setDetectedCountry(detected);
      setAllowedCountries(allowed);
      setHidePasswordDefault(settingsData.settings?.hidePasswordRegister !== false);
      setRoleImages({
        hombre: settingsData.settings?.roleHombreImg || '',
        mujer: settingsData.settings?.roleMujerImg || '',
        pareja: settingsData.settings?.roleParejaImg || '',
        pareja_hombres: settingsData.settings?.roleParejaHombresImg || '',
        pareja_mujeres: settingsData.settings?.roleParejaMujeresImg || '',
        trans: settingsData.settings?.roleTransImg || '',
      });
      if (detected && allowed.includes(detected)) {
        setSelectedCountry(detected);
        setShowCountryPicker(false);
      } else {
        setSelectedCountry(allowed[0] || '');
        setShowCountryPicker(true);
      }
    });
  }, []);

  // Auto-advance after first selection on role/seeking steps
  const handleRoleSelect = useCallback(
    (id) => {
      const wasEmpty = !iAm;
      setIAm(id);
      if (wasEmpty) {
        setTimeout(() => {
          setDirection(1);
          setStep((s) => s + 1);
        }, 600);
      }
    },
    [iAm]
  );

  const handleSeekingToggle = useCallback(
    (id) => {
      setSeeking(prev => {
        if (prev.includes(id)) return prev.filter(s => s !== id);
        return [...prev, id];
      });
    },
    []
  );

  const canNext = () => {
    if (step === 0) return EMAIL_REGEX.test(email) && isValidEmailTld(email) && password.length >= 10 && emailStatus !== 'exists' && emailStatus !== 'invalid';
    if (step === 1) return !!iAm;
    if (step === 2) return seeking.length > 0;
    if (step === 3) return info.name && USERNAME_REGEX.test(info.name) && usernameStatus !== 'exists' && usernameStatus !== 'invalid' && isAdultBirthdate(info.birthdate) && info.province && (!showCountryPicker || selectedCountry);
    if (step === 4) return !!photoFile;
    return true;
  };

  const handleEmailBlur = useCallback(async () => {
    if (!email || !EMAIL_REGEX.test(email) || !isValidEmailTld(email)) {
      if (email) setEmailStatus('invalid');
      return;
    }
    setEmailStatus('checking');
    try {
      const { exists } = await apiCheckEmail(email);
      setEmailStatus(exists ? 'exists' : 'valid');
    } catch {
      setEmailStatus('idle');
    }
  }, [email]);

  // Reset email status when email changes
  useEffect(() => {
    setEmailStatus('idle');
    setApiError('');
  }, [email]);

  // Reset username status when name changes
  useEffect(() => {
    setUsernameStatus('idle');
  }, [info.name]);

  const handleUsernameBlur = useCallback(async () => {
    const name = info.name.trim();
    if (!name) return;
    if (!USERNAME_REGEX.test(name)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    try {
      const { exists } = await apiCheckUsername(name);
      setUsernameStatus(exists ? 'exists' : 'valid');
    } catch {
      setUsernameStatus('idle');
    }
  }, [info.name]);

  const next = async () => {
    // Check email on step 0 if not yet validated
    if (step === 0) {
      if (emailStatus === 'exists') {
        setApiError('EMAIL_EXISTS');
        return;
      }
      if (emailStatus !== 'valid') {
        // Run check now as safety net
        setSubmitting(true);
        try {
          const { exists } = await apiCheckEmail(email);
          if (exists) {
            setEmailStatus('exists');
            setApiError('EMAIL_EXISTS');
            setSubmitting(false);
            return;
          }
          setEmailStatus('valid');
        } catch {
          // Let registration handle it
        }
        setSubmitting(false);
      }
      setDirection(1);
      setStep((s) => s + 1);
      return;
    }

    if (step === TOTAL_STEPS - 1) {
      setSubmitting(true);
      setApiError('');
      try {
        const regResult = await apiRegister({
          email,
          password,
          username: info.name,
          role: iAm,
          seeking,
          interests,
          birthdate: info.birthdate,
          province: info.province,
          locality: info.locality,
          bio: info.bio,
          country: selectedCountry || undefined,
        });

        // Show verification screen
        if (regResult.devCode) setDevCode(regResult.devCode);
        setPendingVerification(true);
      } catch (err) {
        if (err.data?.code === 'EMAIL_EXISTS') {
          setApiError('EMAIL_EXISTS');
        } else {
          setApiError(err.message || 'Error al registrar. Intenta de nuevo.');
        }
      } finally {
        setSubmitting(false);
      }
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const handleVerified = async (data) => {
    setUser(data.user);
    setRegistered(true);

    // Save seeking as feed filter preference
    if (seeking.length > 0) {
      const filterVal = seeking.length === ALL_SEEKING_OPTIONS.length ? 'all' : seeking.join(',');
      localStorage.setItem('mansion_feed_filter', filterVal);
    }

    // Upload photo if selected (now that we have a token)
    if (photoFile) {
      try {
        const uploadResult = await uploadImage(photoFile, { purpose: 'avatar' });
        // Immediately update with upload result
        setUser(prev => prev ? { ...prev, avatar_url: uploadResult.url, avatar_crop: null } : prev);
        // Then fetch canonical user to ensure state is fully in sync
        const fresh = await getMe().catch(() => null);
        if (fresh?.user) setUser(fresh.user);
      } catch {
        // Photo upload failed — user can retry later from profile
      }
    }

    setCompleted(true);
  };

  const prev = () => {
    if (step === 0) {
      navigate('/bienvenida?intent=register');
    } else {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  if (pendingVerification && !completed) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-0 w-72 h-72 bg-mansion-crimson/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 left-0 w-64 h-64 bg-mansion-gold/5 rounded-full blur-3xl" />
        </div>
        <VerificationScreen
          email={email}
          devCode={devCode}
          onVerified={handleVerified}
          onResend={async () => {
            const res = await apiResendCode(email);
            if (res.devCode) setDevCode(res.devCode);
          }}
        />
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-0 w-72 h-72 bg-mansion-crimson/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 left-0 w-64 h-64 bg-mansion-gold/5 rounded-full blur-3xl" />
        </div>
        <SuccessScreen onEnter={() => navigate('/')} />
      </div>
    );
  }

  const fichaData = {
    role: iAm,
    seeking,
    interests,
    name: info.name,
    birthdate: info.birthdate,
    province: info.province,
    locality: info.locality,
  };

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepEmail
            email={email}
            password={password}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            hidePasswordDefault={hidePasswordDefault}
            emailStatus={emailStatus}
            onEmailBlur={handleEmailBlur}
            onNavigateRecover={() => navigate(`/recuperar-contrasena?email=${encodeURIComponent(email)}`)}
          />
        );
      case 1:
        return (
          <RoleGrid
            selected={iAm}
            onSelect={handleRoleSelect}
            title="Soy un..."
            subtitle="Selecciona tu perfil"
            roleImages={roleImages}
            optimizeMotion={optimizeOnboardingMotion}
          />
        );
      case 2:
        return (
          <SeekingGrid
            selected={seeking}
            onToggle={handleSeekingToggle}
            roleImages={roleImages}
            optimizeMotion={optimizeOnboardingMotion}
          />
        );
      case 3:
        return <StepBasicInfo data={info} onChange={setInfo} showCountryPicker={showCountryPicker} allowedCountries={allowedCountries} selectedCountry={selectedCountry} onCountryChange={setSelectedCountry} usernameStatus={usernameStatus} onUsernameBlur={handleUsernameBlur} />;
      case 4:
        return <StepPhoto photoFile={photoFile} onPhotoSelect={setPhotoFile} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-72 h-72 bg-mansion-crimson/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-0 w-64 h-64 bg-mansion-gold/5 rounded-full blur-3xl" />
      </div>

      {/* Progress bar */}
      <div className="relative z-10 px-6 pt-[calc(env(safe-area-inset-top)+12px)] mb-3">
        <div className="h-1 bg-mansion-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-mansion-gold to-mansion-gold-light rounded-full"
            initial={false}
            animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          />
        </div>
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 mb-4">
        <button
          onClick={prev}
          className="text-text-muted hover:text-text-primary transition-colors p-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-text-dim text-xs font-medium">
          {step + 1} / {TOTAL_STEPS}
        </span>
        <div className="w-9" />
      </div>

      {/* Profile Card Preview */}
      <div className="relative z-10 px-6">
      <FichaPreview data={fichaData} currentStep={step} roleImages={roleImages} optimizeMotion={optimizeOnboardingMotion} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={optimizeOnboardingMotion ? { duration: 0.2, ease: 'easeOut' } : { duration: 0.3, ease: 'easeInOut' }}
            className="w-full max-w-md transform-gpu"
            style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div className="relative z-10 px-6 pb-10">
        {apiError && apiError !== 'EMAIL_EXISTS' && (
          <p className="text-mansion-crimson text-xs text-center mb-3">{apiError}</p>
        )}
        {apiError === 'EMAIL_EXISTS' && (
          <div className="text-center mb-3">
            <p className="text-mansion-crimson text-xs mb-1">Este email ya está registrado.</p>
            <button
              onClick={() => navigate(`/recuperar-contrasena?email=${encodeURIComponent(email)}`)}
              className="text-mansion-gold text-xs font-medium hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={next}
          disabled={!canNext() || submitting}
          className={`w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2 transition-all ${
            canNext() && !submitting
              ? 'btn-gold'
              : 'bg-mansion-elevated text-text-dim cursor-not-allowed'
          }`}
        >
          {submitting
            ? 'Registrando...'
            : step === TOTAL_STEPS - 1
            ? 'Completar Registro'
            : 'Continuar'}
          {!submitting && <ChevronRight className="w-5 h-5" />}
        </motion.button>

        {step === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={{ willChange: 'opacity' }}
            className="text-center mt-4"
          >
            <span className="text-text-dim text-xs">¿Ya tienes cuenta? </span>
            <button
              onClick={() => navigate('/login')}
              className="text-mansion-gold text-xs font-medium hover:underline"
            >
              Iniciar sesión
            </button>
          </motion.p>
        )}
      </div>
    </div>
  );
}
