import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle, RefreshCw } from 'lucide-react';

export default function PagoFallidoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const externalRef = params.get('external_reference') || '';
  const planId = externalRef.split('--')[1] || '';
  const isCoinPurchase = planId.startsWith('coins_');

  return (
    <div className="min-h-screen bg-mansion-base flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">

        <XCircle className="w-16 h-16 text-mansion-crimson mx-auto" />

        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Pago no procesado</h1>
          <p className="text-gray-400 text-lg">
            Hubo un problema con tu pago. No se realizó ningún cargo.
          </p>
        </div>

        <div className="bg-mansion-card border border-white/10 rounded-2xl p-5 text-left space-y-2 text-gray-400 text-sm">
          <p className="font-semibold text-gray-300 mb-2">Causas frecuentes:</p>
          <p>· Tarjeta sin fondos suficientes</p>
          <p>· Datos de la tarjeta incorrectos</p>
          <p>· Pago rechazado por el banco</p>
          <p>· Se canceló el proceso</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate(isCoinPurchase ? '/monedas' : '/vip')}
            className="w-full py-4 bg-mansion-gold text-black font-bold rounded-xl text-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Intentar nuevamente
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 text-gray-400 hover:text-white transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
