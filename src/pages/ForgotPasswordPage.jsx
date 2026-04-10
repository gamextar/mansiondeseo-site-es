import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Mail, Lock, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { forgotPassword, resetPassword } from '../lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState('email'); // email | code | done
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [emailStatus, setEmailStatus] = useState('idle'); // idle | checking | valid | invalid
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState(null);

  // Reset email status when email changes
  useEffect(() => {
    setEmailStatus('idle');
  }, [email]);

  const handleEmailBlur = useCallback(() => {
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setEmailStatus('invalid');
      return;
    }
    setEmailStatus('valid');
  }, [email]);

  const isEmailValid = EMAIL_REGEX.test(email);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!isEmailValid) return;
    setLoading(true);
    setError('');
    try {
      const data = await forgotPassword(email);
      if (data.devCode) setDevCode(data.devCode);
      setStep('code');
    } catch (err) {
      setError(err.message || 'Error al enviar el código');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (code.length < 6 || newPassword.length < 12) return;
    setLoading(true);
    setError('');
    try {
      await resetPassword(email, code, newPassword);
      setStep('done');
    } catch (err) {
      setError(err.message || 'Código inválido o expirado');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await forgotPassword(email);
      if (data.devCode) setDevCode(data.devCode);
      setError('');
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const emailBorderColor = emailStatus === 'valid' ? 'border-green-500/60' : emailStatus === 'invalid' ? 'border-mansion-crimson/60' : '';

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col items-center justify-center relative overflow-hidden px-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-mansion-crimson/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-mansion-base to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Back button */}
        <button
          onClick={() => step === 'email' ? navigate(-1) : setStep('email')}
          className="text-text-muted hover:text-text-primary transition-colors p-2 mb-4 -ml-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-mansion-gold/10 border border-mansion-gold/30 flex items-center justify-center mb-4">
            <KeyRound className="w-7 h-7 text-mansion-gold" />
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
            {step === 'done' ? '¡Listo!' : 'Recuperar acceso'}
          </h1>
          <p className="text-text-muted text-sm">
            {step === 'email' && 'Ingresá tu email y te enviaremos un código'}
            {step === 'code' && (
              <>Enviamos un código de 6 dígitos a <span className="text-mansion-gold font-medium">{email}</span></>
            )}
            {step === 'done' && 'Tu acceso fue actualizado correctamente'}
          </p>
        </div>

        {/* Step: Email */}
        {step === 'email' && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label className="text-text-muted text-xs font-medium mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder="tu@email.com"
                  className={`w-full pl-10 pr-10 ${emailBorderColor}`}
                  autoComplete="email"
                  autoFocus
                />
                {emailStatus === 'valid' && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                )}
                {emailStatus === 'invalid' && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mansion-crimson" />
                )}
              </div>
              {emailStatus === 'invalid' && (
                <p className="text-mansion-crimson text-[11px] mt-1">Ingresa una dirección de email válida</p>
              )}
            </div>

            {error && <p className="text-mansion-crimson text-xs text-center">{error}</p>}

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={!isEmailValid || loading}
              className="btn-gold w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
              {!loading && <ChevronRight className="w-5 h-5" />}
            </motion.button>
          </form>
        )}

        {/* Step: Code + New Password */}
        {step === 'code' && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="text-text-muted text-xs font-medium mb-1.5 block">Código</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-[0.4em] font-mono py-3"
                autoFocus
              />
            </div>

            <div>
              <label className="text-text-muted text-xs font-medium mb-1.5 block">Nueva contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value.slice(0, 50))}
                  placeholder="Mínimo 12 caracteres"
                  className="w-full pl-10 pr-10"
                  autoComplete="new-password"
                  maxLength={50}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-mansion-crimson text-xs text-center">{error}</p>}

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={code.length < 6 || newPassword.length < 12 || loading}
              className="btn-gold w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Actualizando...' : 'Cambiar contraseña'}
              {!loading && <ChevronRight className="w-5 h-5" />}
            </motion.button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-mansion-gold text-xs font-medium hover:underline disabled:opacity-50"
              >
                ¿No recibiste el código? Reenviar
              </button>
              {devCode && (
                <p className="mt-2 px-3 py-2 rounded-lg bg-mansion-gold/10 border border-mansion-gold/20 text-mansion-gold text-xs font-mono">
                  DEV: {devCode}
                </p>
              )}
            </div>
          </form>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login')}
            className="btn-gold w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2"
          >
            Volver a ingresar
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        )}

        {/* Back to login link */}
        {step !== 'done' && (
          <p className="text-center mt-6">
            <button
              onClick={() => navigate('/login')}
              className="text-mansion-gold text-xs font-medium hover:underline"
            >
              Volver al inicio de sesión
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
}
