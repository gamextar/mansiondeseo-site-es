import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Camera, Loader2, Shield, X } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import {
  cancelPhotoOtpVerification,
  getPhotoOtpVerification,
  getPhotoOtpVerificationPhotoBlob,
  startPhotoOtpVerification,
  uploadPhotoOtpVerificationPhoto,
} from '../lib/api';
import { optimizePhotoFile } from '../lib/imageOptimize';

const PHOTO_OTP_STATUS = {
  code_issued: { label: 'Código generado', tone: 'text-mansion-gold border-mansion-gold/25 bg-mansion-gold/10' },
  pending: { label: 'En revisión', tone: 'text-sky-300 border-sky-400/20 bg-sky-500/10' },
  approved: { label: 'Aprobada', tone: 'text-emerald-300 border-emerald-400/20 bg-emerald-500/10' },
  rejected: { label: 'Rechazada', tone: 'text-mansion-crimson border-mansion-crimson/25 bg-mansion-crimson/10' },
  expired: { label: 'Expirada', tone: 'text-text-muted border-mansion-border/25 bg-mansion-elevated/60' },
};

export default function PhotoOtpVerificationCard({ className = '' }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const previewUrlRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const refreshVerification = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getPhotoOtpVerification();
      setVerification(data?.verification || null);
    } catch (err) {
      setError(err?.message || 'No pudimos cargar la verificación.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshVerification();
  }, [refreshVerification]);

  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl('');
    }

    const requestId = verification?.id;
    if (!requestId || !verification?.has_photo) return undefined;

    let cancelled = false;
    getPhotoOtpVerificationPhotoBlob(requestId)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [verification?.has_photo, verification?.id]);

  const handleStart = async () => {
    if (loading || uploading || cancelling || user?.verified) return;
    setLoading(true);
    setError('');
    try {
      const data = await startPhotoOtpVerification();
      setVerification(data?.verification || null);
    } catch (err) {
      setError(err?.message || 'No pudimos iniciar la verificación.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (loading || uploading || cancelling || user?.verified) return;
    if (!verification || !['code_issued', 'pending'].includes(verification.status)) return;

    setCancelling(true);
    setError('');
    try {
      const data = await cancelPhotoOtpVerification();
      setVerification(data?.verification || null);
    } catch (err) {
      setError(err?.message || 'No pudimos cancelar la verificación.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSelect = async (e) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file || uploading || cancelling) return;

    setUploading(true);
    setError('');
    try {
      const optimizedFile = await optimizePhotoFile(file, {
        maxSize: 1400,
        quality: 0.86,
        suffix: '-verificacion',
      });
      const data = await uploadPhotoOtpVerificationPhoto(optimizedFile);
      setVerification(data?.verification || null);
    } catch (err) {
      setError(err?.message || 'No pudimos subir la foto de verificación.');
    } finally {
      setUploading(false);
    }
  };

  const status = user?.verified ? 'approved' : (verification?.status || '');
  const meta = PHOTO_OTP_STATUS[status] || null;
  const pendingReview = !user?.verified && status === 'pending';
  const rejected = !user?.verified && status === 'rejected';
  const showCode = !user?.verified && verification?.code && status === 'code_issued';
  const canStart = !user?.verified && (!verification || ['rejected', 'expired'].includes(verification.status));
  const hasActiveRequest = !user?.verified && verification && verification.status === 'code_issued';

  return (
    <section className={`rounded-3xl border border-mansion-gold/15 bg-mansion-card/35 ${pendingReview ? 'p-3' : 'p-4'} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${
          user?.verified
            ? 'bg-emerald-500/10 text-emerald-300'
            : pendingReview
              ? 'bg-sky-500/10 text-sky-300'
              : 'bg-mansion-gold/10 text-mansion-gold'
        }`}>
          {user?.verified ? <BadgeCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">
              {user?.verified
                ? 'Cuenta verificada'
                : pendingReview
                  ? 'Verificación en proceso'
                  : 'Recordatorio de verificación'}
            </h2>
            {meta && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>
                {meta.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-text-dim">
            {user?.verified
              ? 'Tu cuenta ya está verificada y tiene acceso a las funciones de confianza.'
              : pendingReview
                ? 'Tu foto fue enviada. Estamos revisando la verificación para habilitar todas las funciones.'
                : rejected
                  ? 'No pudimos aprobar la verificación. Revisá el motivo y volvé a intentarlo.'
                : showCode
                  ? 'Escribí el código en un papel y subí una foto mostrándolo con claridad.'
                  : 'Recordá verificar tu cuenta para acceder a todas las funciones de la Mansión.'}
          </p>

          {showCode && (
            <div className="mt-3 rounded-2xl border border-mansion-gold/20 bg-black/25 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-text-dim">Código de verificación</p>
              <p className="mt-1 font-display text-2xl font-bold tracking-[0.12em] text-mansion-gold">{verification.code}</p>
              <div className="mt-3 rounded-xl border border-mansion-gold/15 bg-mansion-gold/8 px-3 py-2 text-left">
                <p className="text-xs font-semibold text-text-primary">Cómo hacer la foto</p>
                <p className="mt-1 text-[11px] leading-5 text-text-dim">
                  Escribí este código en un papel, y toma la foto manteniendolo visible junto a vos.
                </p>
              </div>
            </div>
          )}

          {previewUrl && !user?.verified && !pendingReview && (
            <div className="mt-3 w-28 overflow-hidden rounded-2xl border border-mansion-border/20 bg-mansion-elevated">
              <img src={previewUrl} alt="Foto de verificación enviada" className="h-28 w-28 object-cover" />
            </div>
          )}

          {verification?.status === 'rejected' && verification?.admin_note && (
            <p className="mt-3 rounded-2xl border border-mansion-crimson/20 bg-mansion-crimson/10 px-3 py-2 text-xs leading-5 text-mansion-crimson">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-mansion-crimson/80">Motivo del rechazo</span>
              <span className="mt-1 block">{verification.admin_note}</span>
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-2xl border border-mansion-crimson/20 bg-mansion-crimson/10 px-3 py-2 text-xs leading-5 text-mansion-crimson">
              {error}
            </p>
          )}

          {!user?.verified && !pendingReview && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canStart && (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={loading || uploading || cancelling}
                  className="inline-flex items-center gap-2 rounded-full border border-mansion-gold/25 bg-mansion-gold/10 px-3 py-2 text-xs font-semibold text-mansion-gold transition-colors hover:bg-mansion-gold/15 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                  {rejected ? 'Volver a verificar' : 'Verificar Cuenta'}
                </button>
              )}
              {hasActiveRequest && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading || loading || cancelling}
                  className="inline-flex items-center gap-2 rounded-full bg-mansion-gold px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-mansion-gold-light disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {verification.status === 'pending' ? 'Reemplazar foto' : 'Subir foto'}
                </button>
              )}
              {hasActiveRequest && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading || uploading || cancelling}
                  className="inline-flex items-center gap-2 rounded-full border border-mansion-border/30 bg-transparent px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:border-mansion-crimson/35 hover:text-mansion-crimson disabled:opacity-50"
                >
                  {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Cancelar
                </button>
              )}
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleSelect} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
