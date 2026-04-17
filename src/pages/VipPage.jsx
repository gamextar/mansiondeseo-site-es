import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Zap, MessageCircle, Image, EyeOff, Star, ArrowLeft, Loader } from 'lucide-react';
import { createPayment, getPublicSettings } from '../lib/api';
import { useAuth } from '../lib/authContext';

const DEFAULT_PLANES = [
  { id: 'premium_mensual', label: '1 mes', amount: 2999, popular: false, desc: 'Ideal para probar' },
  { id: 'premium_3meses', label: '3 meses', amount: 7499, popular: true, desc: 'Ahorrás $1.500' },
  { id: 'premium_6meses', label: '6 meses', amount: 12999, popular: false, desc: 'El mejor precio' },
];

const BENEFICIOS = [
  { icon: <MessageCircle className="w-5 h-5" />, text: 'Mensajes ilimitados (sin límite diario)' },
  { icon: <Image className="w-5 h-5" />, text: 'Ver todas las fotos de cada perfil' },
  { icon: <EyeOff className="w-5 h-5" />, text: 'Modo incógnito — visitá perfiles sin ser visto' },
  { icon: <Star className="w-5 h-5" />, text: 'Perfil destacado en la sección Explorar' },
  { icon: <Zap className="w-5 h-5" />, text: 'Prioridad en resultados de búsqueda' },
];

export default function VipPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [planes, setPlanes] = useState(DEFAULT_PLANES);
  const [planSeleccionado, setPlanSeleccionado] = useState('premium_3meses');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If already VIP, redirect to home
    if (user?.premium) { navigate('/feed', { replace: true }); return; }
    getPublicSettings().then(data => {
      const s = data.settings;
      const updated = [...DEFAULT_PLANES];
      if (s.vipPriceMonthly) updated[0] = { ...updated[0], amount: Number(s.vipPriceMonthly) };
      if (s.vipPrice3Months) updated[1] = { ...updated[1], amount: Number(s.vipPrice3Months) };
      if (s.vipPrice6Months) updated[2] = { ...updated[2], amount: Number(s.vipPrice6Months) };
      setPlanes(updated);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.premium, navigate]);

  const plan = planes.find(p => p.id === planSeleccionado);

  async function handlePagar() {
    if (!user) { navigate('/login'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await createPayment({ plan_id: plan.id, amount: plan.amount });
      const url = data?.init_point || data?.redirect_url;
      if (url) {
        window.location.href = url;
      } else {
        setError('No se pudo iniciar el pago. Intentá de nuevo.');
      }
    } catch (err) {
      setError(err?.message || 'Error al conectar con el servicio de pagos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-mansion-base text-white pb-24">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-mansion-base/80 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">Suscripción VIP</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-8 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-mansion-gold/20 rounded-full flex items-center justify-center mx-auto">
            <Crown className="w-9 h-9 text-mansion-gold" />
          </div>
          <h2 className="text-2xl font-bold">
            {user?.premium ? 'Ya sos VIP' : 'Hacete VIP'}
          </h2>
          <p className="text-gray-400">
            {user?.premium && user.premium_until
              ? <>Tu suscripción vence el <span className="text-mansion-gold font-semibold">{new Date(user.premium_until + 'Z').toLocaleDateString('es-AR')}</span>. Podés extenderla.</>
              : 'Desbloqueá la experiencia completa de Mansión Deseo'
            }
          </p>
        </div>

        {/* Beneficios */}
        <div className="bg-mansion-card border border-white/10 rounded-2xl p-5 space-y-3">
          {BENEFICIOS.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-gray-300">
              <span className="text-mansion-gold flex-shrink-0">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Selector de plan */}
        <div>
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Elegí tu plan</p>
          <div className="grid grid-cols-3 gap-3">
            {planes.map(p => (
              <button
                key={p.id}
                onClick={() => setPlanSeleccionado(p.id)}
                className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                  planSeleccionado === p.id
                    ? 'border-mansion-gold bg-mansion-gold/10'
                    : 'border-white/10 bg-mansion-card hover:border-white/30'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-mansion-gold text-black text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    MÁS POPULAR
                  </span>
                )}
                <span className="font-bold text-white">{p.label}</span>
                <span className="text-mansion-gold font-semibold text-sm mt-1">
                  ${p.amount.toLocaleString('es-AR')}
                </span>
                <span className="text-gray-500 text-xs mt-0.5">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Botón pagar */}
        <button
          onClick={handlePagar}
          disabled={loading}
          className="w-full py-4 bg-mansion-gold text-black font-bold text-lg rounded-xl hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Iniciando pago...
            </>
          ) : (
            <>
              <Crown className="w-5 h-5" />
              {user?.premium ? 'Extender' : 'Pagar'} ${plan.amount.toLocaleString('es-AR')} ARS
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-600">
          Pago procesado de forma segura · Podés cancelar cuando quieras
        </p>
      </div>
    </div>
  );
}
