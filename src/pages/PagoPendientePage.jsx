import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';

export default function PagoPendientePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const externalRef = params.get('external_reference') || '';
  const planId = externalRef.split('--')[1] || '';
  const isCoinPurchase = planId.startsWith('coins_');

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">

        <Clock className="w-16 h-16 text-yellow-400 mx-auto" />

        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Pago pendiente</h1>
          <p className="text-gray-400 text-lg">
            Tu pago está siendo procesado. Te notificaremos cuando se confirme.
          </p>
        </div>

        <div className="bg-mansion-card border border-yellow-500/20 rounded-2xl p-5 text-gray-400 text-sm">
          <p>
            Algunos medios de pago (transferencia bancaria, efectivo en cobranza) pueden demorar
            hasta <span className="text-yellow-400 font-semibold">72 horas</span> en acreditarse.
            {isCoinPurchase
              ? ' Tus monedas se acreditarán automáticamente una vez confirmado el pago.'
              : ' Tu suscripción VIP se activará automáticamente una vez confirmado el pago.'}
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
