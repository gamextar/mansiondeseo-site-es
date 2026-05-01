import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, CheckCircle, ChevronRight } from 'lucide-react';
import { getMe, confirmPayment } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { formatNumber } from '../lib/siteConfig';

function CoinIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" fill="rgba(201,168,76,0.18)" stroke="currentColor" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="serif">M</text>
    </svg>
  );
}

export default function PagoExitosoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();

  // Soporte para MercadoPago y Ualá Bis
  const gateway = params.get('gateway') || 'mercadopago';
  const paymentId = params.get('payment_id') || params.get('uuid') || '';
  const status = params.get('status') || (gateway === 'uala' ? 'approved' : '');
  const externalRef = params.get('external_reference') || '';

  // Detectar si es compra de monedas desde el external_reference (formato: userId--planId)
  const planId = externalRef.split('--')[1] || '';
  const isCoinPurchase = planId.startsWith('coins_');
  const coinsAmount = isCoinPurchase ? planId.replace('coins_', '') : '';

  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    async function confirm() {
      if (!paymentId) return;
      try {
        const confirmOpts = gateway === 'uala'
          ? { gateway: 'uala', external_reference: externalRef }
          : {};
        const result = await confirmPayment(paymentId, confirmOpts);
        if (result.premium || result.coins) {
          const data = await getMe({ force: true });
          if (data?.user) setUser(data.user);
        }
        setConfirmed(true);
      } catch (err) {
        console.error('Error confirmando pago:', err);
        setConfirmed(true);
      }
    }
    confirm();
  }, [externalRef, gateway, paymentId, setUser]);

  // ── Coin purchase success ──
  if (isCoinPurchase) {
    return (
      <div className="min-h-screen bg-mansion-base flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-6">
          <div className="flex items-center justify-center gap-3">
            <CheckCircle className="w-16 h-16 text-green-400" />
          </div>

          <div>
            <h1 className="text-3xl font-bold text-white mb-2">¡Pago aprobado!</h1>
            <p className="text-gray-400 text-lg">
              Tus <span className="text-mansion-gold font-semibold">{formatNumber(coinsAmount)} monedas</span> fueron acreditadas
            </p>
          </div>

          <div className="bg-mansion-card border border-mansion-gold/30 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-mansion-gold font-semibold text-lg mb-4">
              <CoinIcon className="w-5 h-5 text-mansion-gold" />
              Monedas acreditadas
            </div>
            {[
              'Enviá regalos a otros perfiles',
              'Destacá tu perfil',
              'Mostrá interés con estilo',
            ].map(benefit => (
              <div key={benefit} className="flex items-center gap-3 text-gray-300 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                {benefit}
              </div>
            ))}
          </div>

          {paymentId && (
            <p className="text-xs text-gray-600">
              Pago #{paymentId} · Estado: {status}
            </p>
          )}

          <button
            onClick={() => navigate('/inicio')}
            className="w-full py-4 bg-mansion-gold text-black font-bold rounded-xl text-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            Volver a la Mansión
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ── VIP subscription success ──

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">

        {/* Ícono */}
        <div className="flex items-center justify-center gap-3">
          <CheckCircle className="w-16 h-16 text-green-400" />
        </div>

        {/* Título */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">¡Pago aprobado!</h1>
          <p className="text-gray-400 text-lg">
            Tu suscripción <span className="text-mansion-gold font-semibold">VIP</span> está activa
          </p>
        </div>

        {/* Card de beneficios */}
        <div className="bg-mansion-card border border-mansion-gold/30 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-mansion-gold font-semibold text-lg mb-4">
            <Crown className="w-5 h-5" />
            Beneficios desbloqueados
          </div>
          {[
            'Mensajes ilimitados',
            'Ver todas las fotos',
            'Modo incógnito disponible',
            'Perfil destacado en explorar',
          ].map(b => (
            <div key={b} className="flex items-center gap-3 text-gray-300">
              <div className="w-2 h-2 bg-mansion-gold rounded-full flex-shrink-0" />
              {b}
            </div>
          ))}
        </div>

        {/* Debug info (solo si hay payment_id) */}
        {paymentId && (
          <p className="text-xs text-gray-600">
            Pago #{paymentId} · Estado: {status}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={() => navigate('/inicio')}
          className="w-full py-4 bg-mansion-gold text-black font-bold rounded-xl text-lg hover:brightness-110 transition-all"
        >
          Comenzar a explorar
        </button>
      </div>
    </div>
  );
}
