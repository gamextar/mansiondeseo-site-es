import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { login as apiLogin } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setRegistered, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiLogin({ email, password });
      setUser(data.user);
      setRegistered(true);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Background ambiance */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-mansion-crimson/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-mansion-base to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark mx-auto flex items-center justify-center mb-4">
            <span className="font-display text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-gradient-gold mb-1">
            Mansión Deseo
          </h1>
          <p className="text-text-muted text-sm">Accedé a tu espacio privado</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-text-muted text-xs font-medium mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-text-muted text-xs font-medium mb-1.5 block">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-12"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => navigate('/recuperar-contrasena')} className="text-mansion-gold text-xs hover:underline">
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {error && (
            <p className="text-mansion-crimson text-xs text-center">{error}</p>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="btn-gold w-full py-4 rounded-2xl text-lg font-display font-semibold flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </motion.button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-8">
          <div className="flex-1 h-px bg-mansion-border" />
          <span className="text-text-dim text-xs">o</span>
          <div className="flex-1 h-px bg-mansion-border" />
        </div>

        {/* Register link */}
        <p className="text-center text-text-muted text-lg">
          ¿Aún no tenés cuenta?{' '}
          <Link to="/bienvenida?intent=register" className="text-mansion-gold font-medium hover:underline text-lg">
            Registrarme
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
