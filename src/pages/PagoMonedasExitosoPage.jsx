import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { getMe, confirmPayment } from '../lib/api';
import { useAuth } from '../lib/authContext';

function CoinIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" fill="rgba(201,168,76,0.18)" stroke="currentColor" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="serif">M</text>
    </svg>
  );
}

export default function PagoMonedasExitosoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();

  const gateway = params.get('gateway') || 'mercadopago';
  const paymentId = params.get('payment_id') || params.get('uuid') || '';
  const externalRef = params.get('external_reference') || '';

  useEffect(() => {
    async function confirm() {
      if (!paymentId) return;
      try {
        const confirmOpts = gateway === 'uala'
          ? { gateway: 'uala', external_reference: externalRef }
          : {};
        await confirmPayment(paymentId, confirmOpts);
        const data = await getMe();
        if (data?.user) setUser(data.user);
      } catch (err) {
        console.error('Error confirmando pago de monedas:', err);
      }
    }
    confirm();
  }, [paymentId, setUser]);

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="flex items-center justify-center gap-3">
          <CheckCircle className="w-16 h-16 text-green-400" />
        </div>

        <div>
          <h1 className="text-3xl font-bold text-white mb-2">¡Pago aprobado!</h1>
          <p className="text-gray-400 text-lg">
            Tus <span className="text-mansion-gold font-semibold">monedas</span> fueron acreditadas
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

        <button
          onClick={() => navigate('/')}
          className="w-full py-4 bg-mansion-gold text-black font-bold text-lg rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
        >
          Volver a la Mansión
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
