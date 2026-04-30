import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, AtSign, ChevronRight, Crown, Eye, EyeOff, FileText, Filter, Heart, KeyRound, Loader2, Mail, MapPin, Save, Shield, Trash2, UserRound, X } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import {
  confirmAccountDeletion,
  confirmEmailChange,
  getMe,
  invalidateProfilesCache,
  requestAccountDeletion,
  requestEmailChange,
  updateAccountPassword,
  updateProfile,
} from '../lib/api';
import { formatDate } from '../lib/siteConfig';
import PhotoOtpVerificationCard from '../components/PhotoOtpVerificationCard';

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

const EMAIL_REGEX = /^[^\s@]{1,64}@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,24}$/;
const BIO_MAX_LENGTH = 300;

function markFeedDirty() {
  invalidateProfilesCache();
  try {
    sessionStorage.setItem('mansion_feed_dirty', '1');
    localStorage.removeItem('mansion_feed');
  } catch {}
}

function formatPremiumUntil(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return formatDate(raw.endsWith('Z') ? raw : `${raw}Z`);
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
  const [provinceDraft, setProvinceDraft] = useState(() => user?.province || user?.city || '');
  const [localityDraft, setLocalityDraft] = useState(() => user?.locality || '');
  const [bioDraft, setBioDraft] = useState(() => user?.bio || '');
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalMessage, setPersonalMessage] = useState('');
  const [personalError, setPersonalError] = useState('');
  const [emailDraft, setEmailDraft] = useState(() => user?.email || '');
  const [emailPending, setEmailPending] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailDevCode, setEmailDevCode] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailConfirming, setEmailConfirming] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const seeking = Array.isArray(user?.seeking) ? user.seeking : (user?.seeking ? [user.seeking] : []);
  const blockedRoles = Array.isArray(user?.message_block_roles) ? user.message_block_roles : [];
  const interests = Array.isArray(user?.interests) ? user.interests : [];
  const premiumUntilLabel = formatPremiumUntil(user?.premium_until);
  const currentEmail = String(user?.email || '').trim().toLowerCase();
  const normalizedEmailDraft = String(emailDraft || '').trim().toLowerCase();
  const emailChanged = normalizedEmailDraft && normalizedEmailDraft !== currentEmail;
  const personalChanged = (
    String(provinceDraft || '').trim() !== String(user?.province || user?.city || '').trim() ||
    String(localityDraft || '').trim() !== String(user?.locality || '').trim() ||
    String(bioDraft || '').trim() !== String(user?.bio || '').trim()
  );

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    getMe({ force: true }).then((data) => {
      if (!cancelled && data?.user) {
        setUser(prev => prev ? { ...prev, ...data.user } : data.user);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setUser, user?.id]);

  useEffect(() => {
    setProvinceDraft(user?.province || user?.city || '');
    setLocalityDraft(user?.locality || '');
    setBioDraft(user?.bio || '');
    setEmailDraft(user?.email || '');
    setEmailPending('');
    setEmailCode('');
    setEmailDevCode('');
    setEmailMessage('');
    setEmailError('');
  }, [user?.id]);

  const handleSavePersonalData = async (e) => {
    e.preventDefault();
    if (personalSaving || !personalChanged) return;
    setPersonalSaving(true);
    setPersonalMessage('');
    setPersonalError('');
    try {
      const data = await updateProfile({
        province: String(provinceDraft || '').trim(),
        locality: String(localityDraft || '').trim(),
        bio: String(bioDraft || '').trim().slice(0, BIO_MAX_LENGTH),
      });
      if (data?.user) setUser(prev => prev ? { ...prev, ...data.user } : data.user);
      setPersonalMessage('Datos actualizados.');
    } catch (err) {
      setPersonalError(err?.message || 'No pudimos actualizar tus datos.');
    } finally {
      setPersonalSaving(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (emailSending || !emailChanged) return;
    setEmailSending(true);
    setEmailMessage('');
    setEmailError('');
    setEmailDevCode('');
    try {
      if (!EMAIL_REGEX.test(normalizedEmailDraft)) {
        throw new Error('Ingresá un email válido.');
      }
      const data = await requestEmailChange(normalizedEmailDraft);
      const pending = data?.email || normalizedEmailDraft;
      setEmailPending(pending);
      setEmailCode(data?.devCode ? String(data.devCode) : '');
      setEmailDevCode(data?.devCode ? String(data.devCode) : '');
      setEmailMessage(data?.message || `Te enviamos un código a ${pending}.`);
    } catch (err) {
      setEmailError(err?.message || 'No pudimos enviar el código.');
    } finally {
      setEmailSending(false);
    }
  };

  const handleConfirmEmailChange = async (e) => {
    e.preventDefault();
    const targetEmail = emailPending || normalizedEmailDraft;
    const cleanCode = emailCode.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setEmailError('Ingresá el código de 6 dígitos.');
      return;
    }

    setEmailConfirming(true);
    setEmailError('');
    try {
      const data = await confirmEmailChange(targetEmail, cleanCode);
      if (data?.user) setUser(prev => prev ? { ...prev, ...data.user } : data.user);
      setEmailDraft(data?.user?.email || targetEmail);
      setEmailPending('');
      setEmailCode('');
      setEmailDevCode('');
      setEmailMessage(data?.message || 'Email actualizado correctamente.');
    } catch (err) {
      setEmailError(err?.message || 'No pudimos confirmar el email.');
    } finally {
      setEmailConfirming(false);
    }
  };

  const cancelEmailChange = () => {
    setEmailPending('');
    setEmailCode('');
    setEmailDevCode('');
    setEmailMessage('');
    setEmailError('');
    setEmailDraft(user?.email || '');
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');
    if (newPassword.length < 10) {
      setPasswordError('La nueva contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setPasswordSaving(true);
    try {
      const data = await updateAccountPassword({ currentPassword, newPassword });
      setPasswordMessage(data?.message || 'Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err?.message || 'No pudimos actualizar la contraseña.');
    } finally {
      setPasswordSaving(false);
    }
  };

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
            <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
              <UserRound className="h-3 w-3 text-mansion-gold/70" />
              Datos personales
            </h2>

            <form onSubmit={handleSavePersonalData} className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                    <MapPin className="h-3.5 w-3.5" />
                    Provincia
                  </span>
                  <input
                    value={provinceDraft}
                    onChange={(e) => {
                      setProvinceDraft(e.target.value);
                      setPersonalMessage('');
                      setPersonalError('');
                    }}
                    maxLength={80}
                    autoComplete="address-level1"
                    className="w-full rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-sm text-text-primary placeholder:text-text-dim focus:border-mansion-gold/50 focus:ring-mansion-gold/20"
                    placeholder="Provincia"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                    <MapPin className="h-3.5 w-3.5" />
                    Localidad
                  </span>
                  <input
                    value={localityDraft}
                    onChange={(e) => {
                      setLocalityDraft(e.target.value);
                      setPersonalMessage('');
                      setPersonalError('');
                    }}
                    maxLength={80}
                    autoComplete="address-level2"
                    className="w-full rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-sm text-text-primary placeholder:text-text-dim focus:border-mansion-gold/50 focus:ring-mansion-gold/20"
                    placeholder="Localidad"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                  <FileText className="h-3.5 w-3.5" />
                  Bio
                </span>
                <textarea
                  value={bioDraft}
                  onChange={(e) => {
                    setBioDraft(e.target.value.slice(0, BIO_MAX_LENGTH));
                    setPersonalMessage('');
                    setPersonalError('');
                  }}
                  rows={4}
                  maxLength={BIO_MAX_LENGTH}
                  className="w-full resize-none rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-sm leading-6 text-text-primary placeholder:text-text-dim focus:border-mansion-gold/50 focus:ring-mansion-gold/20"
                  placeholder="Contá algo breve sobre vos"
                />
                <span className="mt-1 block text-right text-[10px] text-text-dim">{bioDraft.length}/{BIO_MAX_LENGTH}</span>
              </label>

              {(personalMessage || personalError) && (
                <p className={`rounded-2xl border px-4 py-3 text-xs ${
                  personalError
                    ? 'border-mansion-crimson/25 bg-mansion-crimson/10 text-mansion-crimson'
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                }`}>
                  {personalError || personalMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={personalSaving || !personalChanged}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-mansion-gold px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-mansion-gold/90 disabled:opacity-45"
              >
                {personalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar datos
              </button>
            </form>

            <div className="my-5 h-px bg-mansion-border/20" />

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                  <AtSign className="h-3.5 w-3.5" />
                  Email
                </span>
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => {
                    setEmailDraft(e.target.value);
                    setEmailPending('');
                    setEmailCode('');
                    setEmailDevCode('');
                    setEmailMessage('');
                    setEmailError('');
                  }}
                  autoComplete="email"
                  inputMode="email"
                  className="w-full rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-sm text-text-primary placeholder:text-text-dim focus:border-mansion-gold/50 focus:ring-mansion-gold/20"
                  placeholder="tu@email.com"
                />
              </label>

              {emailPending ? (
                <form onSubmit={handleConfirmEmailChange} className="space-y-3 rounded-2xl border border-mansion-gold/20 bg-mansion-gold/8 p-3">
                  <p className="text-xs leading-5 text-text-muted">
                    Ingresá el código que enviamos a <span className="font-medium text-mansion-gold">{emailPending}</span>.
                  </p>
                  <input
                    value={emailCode}
                    onChange={(e) => {
                      setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setEmailError('');
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-center text-xl font-bold tracking-[0.45em] text-text-primary placeholder:text-text-dim focus:border-mansion-gold/50 focus:ring-mansion-gold/20"
                  />
                  {emailDevCode && (
                    <p className="rounded-2xl border border-mansion-gold/20 bg-mansion-gold/10 px-4 py-3 text-xs text-mansion-gold">Código dev: {emailDevCode}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelEmailChange}
                      disabled={emailConfirming}
                      className="flex-1 rounded-2xl border border-mansion-border/30 px-4 py-3 text-sm font-medium text-text-muted hover:bg-white/[0.04] disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={emailConfirming || emailCode.length !== 6}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-mansion-gold px-4 py-3 text-sm font-semibold text-black hover:bg-mansion-gold/90 disabled:opacity-50"
                    >
                      {emailConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                      Confirmar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestEmailChange}
                  disabled={emailSending || !emailChanged || !EMAIL_REGEX.test(normalizedEmailDraft)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-mansion-gold/25 bg-mansion-gold/10 px-4 py-3 text-sm font-semibold text-mansion-gold transition-all hover:bg-mansion-gold/15 disabled:opacity-45"
                >
                  {emailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Enviar código
                </button>
              )}

              {(emailMessage || emailError) && (
                <p className={`rounded-2xl border px-4 py-3 text-xs ${
                  emailError
                    ? 'border-mansion-crimson/25 bg-mansion-crimson/10 text-mansion-crimson'
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                }`}>
                  {emailError || emailMessage}
                </p>
              )}
            </div>

            <div className="my-5 h-px bg-mansion-border/20" />

            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                  <KeyRound className="h-3.5 w-3.5" />
                  Contraseña
                </p>
                <button
                  type="button"
                  onClick={() => setShowPasswords(value => !value)}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-text-dim hover:bg-white/5 hover:text-text-primary"
                >
                  {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPasswords ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordMessage('');
                  setPasswordError('');
                }}
                autoComplete="current-password"
                className="w-full rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-sm text-text-primary placeholder:text-text-dim focus:border-mansion-gold/50 focus:ring-mansion-gold/20"
                placeholder="Contraseña actual"
              />
              <div className="grid gap-3 lg:grid-cols-2">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordMessage('');
                    setPasswordError('');
                  }}
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-sm text-text-primary placeholder:text-text-dim focus:border-mansion-gold/50 focus:ring-mansion-gold/20"
                  placeholder="Nueva contraseña"
                />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordMessage('');
                    setPasswordError('');
                  }}
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-sm text-text-primary placeholder:text-text-dim focus:border-mansion-gold/50 focus:ring-mansion-gold/20"
                  placeholder="Repetir nueva"
                />
              </div>

              {(passwordMessage || passwordError) && (
                <p className={`rounded-2xl border px-4 py-3 text-xs ${
                  passwordError
                    ? 'border-mansion-crimson/25 bg-mansion-crimson/10 text-mansion-crimson'
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                }`}>
                  {passwordError || passwordMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-mansion-border/30 px-4 py-3 text-sm font-semibold text-text-primary transition-all hover:bg-white/[0.04] disabled:opacity-45"
              >
                {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Actualizar contraseña
              </button>
            </form>
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

          <motion.div variants={fadeUp}>
            <PhotoOtpVerificationCard />
          </motion.div>

          <motion.section variants={fadeUp} className="glass-elevated rounded-3xl p-4 lg:p-5">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-dim">Membresía</h2>
            {user?.premium ? (
              <div className="space-y-1.5">
                <div className="flex w-full flex-col gap-3 rounded-2xl border border-mansion-gold/20 bg-mansion-gold/8 p-3 sm:flex-row sm:items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mansion-gold/15 text-mansion-gold">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-mansion-gold">VIP activo</p>
                    <p className="text-xs text-text-dim">
                      {premiumUntilLabel ? `Vence el ${premiumUntilLabel}` : 'Disfrutás de todos los beneficios'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/vip')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-mansion-gold/30 bg-mansion-gold/12 px-3 py-2 text-xs font-semibold text-mansion-gold transition-all hover:bg-mansion-gold/20"
                  >
                    <span className="sm:hidden">Extender</span>
                    <span className="hidden sm:inline">Extender suscripción</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

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
