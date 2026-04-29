import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Crown, Eye, EyeOff, Filter, Heart, Loader2, Mail, Shield, Trash2, X } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import {
  confirmAccountDeletion,
  invalidateProfilesCache,
  requestAccountDeletion,
  updateProfile,
} from '../lib/api';

const SEEKING_OPTIONS = [
  { id: 'hombre', label: 'Hombres', emoji: '👨', color: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
  { id: 'mujer', label: 'Mujeres', emoji: '👩', color: 'bg-pink-500/15 text-pink-300 border-pink-500/40' },
  { id: 'pareja', label: 'Parejas', emoji: '💑', color: 'bg-purple-500/15 text-purple-300 border-purple-500/40' },
  { id: 'pareja_hombres', label: 'Pareja de Hombres', emoji: '👬', color: 'bg-sky-500/15 text-sky-300 border-sky-500/40' },
  { id: 'pareja_mujeres', label: 'Pareja de Mujeres', emoji: '👭', color: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40' },
  { id: 'trans', label: 'Trans', emoji: '⚧', color: 'bg-teal-500/15 text-teal-300 border-teal-500/40' },
];

const INTEREST_OPTIONS = [
  { id: 'swinger', label: 'Swinger', emoji: '🔄' },
  { id: 'trios', label: 'Tríos', emoji: '🔥' },
  { id: 'cuckold', label: 'Cuckold', emoji: '👀' },
  { id: 'fetiche', label: 'Fetiches', emoji: '⛓️' },
  { id: 'voyeur', label: 'Voyeur', emoji: '🕶️' },
  { id: 'bdsm', label: 'BDSM', emoji: '🖤' },
  { id: 'exhib', label: 'Exhibicionismo', emoji: '✨' },
  { id: 'roleplay', label: 'Roleplay', emoji: '🎭' },
];

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [.25, .46, .45, .94] } },
};

function markFeedDirty() {
  invalidateProfilesCache();
  try {
    sessionStorage.setItem('mansion_feed_dirty', '1');
    localStorage.removeItem('mansion_feed');
  } catch {}
}

export default function UserSettingsPage() {
  const navigate = useNavigate();
  const { user, setRegistered, setUser } = useAuth();
  const [togglingGhost, setTogglingGhost] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountStep, setDeleteAccountStep] = useState('intro');
  const [deleteAccountCode, setDeleteAccountCode] = useState('');
  const [deleteAccountMessage, setDeleteAccountMessage] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteAccountDevCode, setDeleteAccountDevCode] = useState('');
  const [deleteAccountSending, setDeleteAccountSending] = useState(false);
  const [deleteAccountConfirming, setDeleteAccountConfirming] = useState(false);

  const seeking = Array.isArray(user?.seeking) ? user.seeking : (user?.seeking ? [user.seeking] : []);
  const blockedRoles = Array.isArray(user?.message_block_roles) ? user.message_block_roles : [];
  const interests = Array.isArray(user?.interests) ? user.interests : [];

  const toggleSeeking = async (optionId) => {
    const isActive = seeking.includes(optionId);
    const nextSeeking = isActive ? seeking.filter((value) => value !== optionId) : [...seeking, optionId];
    if (nextSeeking.length === 0) return;
    setUser(prev => prev ? { ...prev, seeking: nextSeeking } : prev);
    markFeedDirty();
    try {
      await updateProfile({ seeking: nextSeeking });
    } catch {
      setUser(prev => prev ? { ...prev, seeking } : prev);
    }
  };

  const toggleBlockedRole = async (optionId) => {
    const isActive = blockedRoles.includes(optionId);
    const nextBlocked = isActive
      ? blockedRoles.filter((value) => value !== optionId)
      : [...blockedRoles, optionId];
    setUser(prev => prev ? { ...prev, message_block_roles: nextBlocked } : prev);
    try {
      await updateProfile({ message_block_roles: nextBlocked });
    } catch {
      setUser(prev => prev ? { ...prev, message_block_roles: blockedRoles } : prev);
    }
  };

  const toggleInterest = async (interestId) => {
    const isActive = interests.includes(interestId);
    const nextInterests = isActive
      ? interests.filter((value) => value !== interestId)
      : [...interests, interestId];
    setUser(prev => prev ? { ...prev, interests: nextInterests } : prev);
    markFeedDirty();
    try {
      await updateProfile({ interests: nextInterests });
    } catch {
      setUser(prev => prev ? { ...prev, interests } : prev);
    }
  };

  const handleToggleGhostMode = async () => {
    if (togglingGhost || !user?.premium) return;
    setTogglingGhost(true);
    try {
      const data = await updateProfile({ ghost_mode: !user.ghost_mode });
      if (data?.user) {
        setUser({ ...user, ...data.user });
      }
    } catch (err) {
      console.error('Ghost mode toggle error:', err);
    } finally {
      setTogglingGhost(false);
    }
  };

  const openDeleteAccountDialog = () => {
    setDeleteAccountStep('intro');
    setDeleteAccountCode('');
    setDeleteAccountMessage('');
    setDeleteAccountError('');
    setDeleteAccountDevCode('');
    setDeleteAccountOpen(true);
  };

  const closeDeleteAccountDialog = () => {
    if (deleteAccountSending || deleteAccountConfirming) return;
    setDeleteAccountOpen(false);
  };

  const handleSendDeleteAccountCode = async () => {
    setDeleteAccountSending(true);
    setDeleteAccountError('');
    setDeleteAccountMessage('');
    setDeleteAccountDevCode('');
    try {
      const data = await requestAccountDeletion();
      setDeleteAccountStep('code');
      setDeleteAccountMessage(data?.message || 'Te enviamos el código de confirmación.');
      if (data?.devCode) {
        setDeleteAccountDevCode(String(data.devCode));
        setDeleteAccountCode(String(data.devCode));
      } else {
        setDeleteAccountCode('');
      }
    } catch (err) {
      setDeleteAccountError(err?.message || 'No pudimos enviar el código. Intentá nuevamente.');
    } finally {
      setDeleteAccountSending(false);
    }
  };

  const handleConfirmDeleteAccount = async (e) => {
    e.preventDefault();
    if (deleteAccountCode.length !== 6) {
      setDeleteAccountError('Ingresá el código de 6 dígitos.');
      return;
    }

    setDeleteAccountConfirming(true);
    setDeleteAccountError('');
    try {
      await confirmAccountDeletion(deleteAccountCode);
      setUser(null);
      setRegistered(false);
      window.location.href = '/';
    } catch (err) {
      setDeleteAccountError(err?.message || 'No pudimos eliminar la cuenta. Revisá el código e intentá nuevamente.');
    } finally {
      setDeleteAccountConfirming(false);
    }
  };

  return (
    <div className="min-h-mobile-browser-screen bg-mansion-base pb-mobile-legacy-nav pt-navbar lg:pb-10 lg:pt-0">
      <motion.div
        initial="initial"
        animate="animate"
        variants={stagger}
        className="mx-auto w-full max-w-[58rem] px-[5vw] py-6 lg:px-10 lg:py-10"
      >
        <motion.div variants={fadeUp} className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-mansion-gold/80">Cuenta</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-text-primary">Configuración</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-dim">
            Ajustá tus preferencias privadas, filtros de contacto y membresía.
          </p>
        </motion.div>

        <div className="grid gap-4">
          <motion.section variants={fadeUp} className="glass-elevated rounded-3xl p-4 lg:p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
              <Heart className="h-3 w-3 text-mansion-crimson/70" />
              Busco
            </h2>
            <div className="flex flex-wrap gap-2">
              {SEEKING_OPTIONS.map((option) => {
                const isActive = seeking.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleSeeking(option.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? option.color
                        : 'border border-mansion-border/30 bg-mansion-card/60 text-text-muted hover:border-mansion-border/50 hover:text-text-primary'
                    } ${isActive ? 'border' : ''}`}
                  >
                    <span>{option.emoji}</span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.section>

          <motion.section variants={fadeUp} className="glass-elevated rounded-3xl p-4 lg:p-5">
            <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
              <Shield className="h-3 w-3 text-mansion-gold/70" />
              Bloquear mensajes
            </h2>
            <p className="mb-3 text-[10px] text-text-dim">Si seleccionás opciones, esos roles no podrán iniciarte chat.</p>
            <div className="flex flex-wrap gap-2">
              {SEEKING_OPTIONS.map((option) => {
                const isActive = blockedRoles.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleBlockedRole(option.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? 'border border-mansion-gold/40 bg-mansion-gold/15 text-mansion-gold'
                        : 'border border-mansion-border/30 bg-mansion-card/60 text-text-muted hover:border-mansion-border/50 hover:text-text-primary'
                    }`}
                  >
                    <span>{option.emoji}</span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.section>

          <motion.section variants={fadeUp} className="glass-elevated rounded-3xl p-4 lg:p-5">
            <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
              <Filter className="h-3 w-3 text-mansion-gold/70" />
              Mis intereses
            </h2>
            <p className="mb-3 text-[10px] text-text-dim">Seleccioná tus intereses para ver primero perfiles afines.</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => {
                const isActive = interests.includes(interest.id);
                return (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => toggleInterest(interest.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? 'border border-mansion-gold/40 bg-mansion-gold/15 text-mansion-gold'
                        : 'border border-mansion-border/30 bg-mansion-card/60 text-text-muted hover:border-mansion-border/50 hover:text-text-primary'
                    }`}
                  >
                    <span>{interest.emoji}</span>
                    <span>{interest.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.section>

          <motion.section variants={fadeUp} className="glass-elevated rounded-3xl p-4 lg:p-5">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-dim">Membresía</h2>
            {user?.premium ? (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => navigate('/vip')}
                  className="flex w-full items-center gap-3 rounded-2xl border border-mansion-gold/20 bg-mansion-gold/8 p-3 transition-all hover:bg-mansion-gold/12"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mansion-gold/15 text-mansion-gold">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-mansion-gold">VIP activo</p>
                    <p className="text-xs text-text-dim">Disfrutás de todos los beneficios</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleToggleGhostMode}
                  disabled={togglingGhost}
                  className="flex w-full items-center gap-3 rounded-2xl p-3 transition-all hover:bg-white/[0.03] disabled:opacity-60"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${user.ghost_mode ? 'bg-purple-500/15 text-purple-400' : 'bg-mansion-elevated/60 text-text-muted'}`}>
                    {user.ghost_mode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-medium ${user.ghost_mode ? 'text-purple-400' : 'text-text-primary'}`}>Modo Incógnito</p>
                    <p className="text-xs text-text-dim">{user.ghost_mode ? 'Tu perfil está oculto' : 'Visitá perfiles sin ser visto'}</p>
                  </div>
                  <div className={`h-6 w-11 rounded-full p-0.5 transition-colors ${user.ghost_mode ? 'bg-purple-500' : 'bg-mansion-border/40'}`}>
                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${user.ghost_mode ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/vip')}
                className="group flex w-full items-center gap-3 rounded-2xl border border-mansion-gold/25 bg-gradient-to-r from-mansion-gold/15 to-mansion-gold/5 p-3 transition-all hover:from-mansion-gold/25 hover:to-mansion-gold/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mansion-gold/15 text-mansion-gold transition-transform group-hover:scale-110">
                  <Crown className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-mansion-gold">Hacete VIP</p>
                  <p className="text-xs text-text-dim">Mensajes ilimitados, fotos y más</p>
                </div>
                <ChevronRight className="h-4 w-4 text-mansion-gold" />
              </button>
            )}
          </motion.section>

          <motion.section variants={fadeUp} className="pb-2">
            <button
              type="button"
              onClick={openDeleteAccountDialog}
              className="flex w-full items-center gap-3 rounded-2xl border border-mansion-crimson/20 bg-mansion-crimson/5 p-3 text-mansion-crimson/80 transition-all hover:bg-mansion-crimson/10 hover:text-mansion-crimson"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mansion-crimson/12">
                <Trash2 className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Eliminar cuenta</p>
                <p className="text-xs text-mansion-crimson/55">Requiere confirmación por email</p>
              </div>
            </button>
          </motion.section>
        </div>
      </motion.div>

      {deleteAccountOpen && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center px-4 pb-6 pt-20 lg:items-center lg:pb-0" onClick={closeDeleteAccountDialog}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative w-full max-w-md rounded-3xl border border-mansion-border/30 bg-mansion-card/95 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDeleteAccountDialog}
              disabled={deleteAccountSending || deleteAccountConfirming}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-dim hover:bg-white/10 hover:text-text-primary disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-mansion-crimson/12 text-mansion-crimson">
              {deleteAccountStep === 'code' ? <Mail className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>

            <h3 className="font-display text-xl font-bold text-text-primary">Eliminar cuenta</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {deleteAccountStep === 'code'
                ? `Ingresá el código que enviamos a ${user?.email || 'tu email'} para confirmar la solicitud de baja.`
                : 'Te enviaremos un código a tu email antes de poner tu cuenta en revisión para completar la baja.'}
            </p>

            {deleteAccountMessage && (
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {deleteAccountMessage}
              </div>
            )}
            {deleteAccountDevCode && (
              <div className="mt-3 rounded-2xl border border-mansion-gold/20 bg-mansion-gold/10 px-4 py-3 text-xs text-mansion-gold">
                Código dev: {deleteAccountDevCode}
              </div>
            )}
            {deleteAccountError && (
              <div className="mt-4 rounded-2xl border border-mansion-crimson/25 bg-mansion-crimson/10 px-4 py-3 text-sm text-mansion-crimson">
                {deleteAccountError}
              </div>
            )}

            {deleteAccountStep === 'code' ? (
              <form onSubmit={handleConfirmDeleteAccount} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-text-muted">Código de confirmación</span>
                  <input
                    value={deleteAccountCode}
                    onChange={(e) => {
                      setDeleteAccountCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setDeleteAccountError('');
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-center text-2xl font-bold tracking-[0.45em] text-text-primary placeholder:text-text-dim focus:border-mansion-crimson/50 focus:ring-mansion-crimson/20"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSendDeleteAccountCode}
                    disabled={deleteAccountSending || deleteAccountConfirming}
                    className="flex-1 rounded-2xl border border-mansion-border/30 px-4 py-3 text-sm font-medium text-text-muted hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    Reenviar
                  </button>
                  <button
                    type="submit"
                    disabled={deleteAccountConfirming || deleteAccountCode.length !== 6}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-mansion-crimson px-4 py-3 text-sm font-semibold text-white hover:bg-mansion-crimson/90 disabled:opacity-50"
                  >
                    {deleteAccountConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeDeleteAccountDialog}
                  disabled={deleteAccountSending}
                  className="flex-1 rounded-2xl border border-mansion-border/30 px-4 py-3 text-sm font-medium text-text-muted hover:bg-white/[0.04] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendDeleteAccountCode}
                  disabled={deleteAccountSending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-mansion-crimson px-4 py-3 text-sm font-semibold text-white hover:bg-mansion-crimson/90 disabled:opacity-50"
                >
                  {deleteAccountSending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Eliminar Cuenta
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
