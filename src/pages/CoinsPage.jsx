import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Plus } from 'lucide-react';
import { createPayment, getPublicSettings } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { formatCurrencyAmount, formatNumber } from '../lib/siteConfig';

// Inline coin SVG matching the Navbar style
function CoinIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" fill="rgba(201,168,76,0.18)" stroke="currentColor" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="serif">M</text>
    </svg>
  );
}

const DEFAULT_PACKS = [
  { id: 'coins_1000', coins: 1000, amount: 0, label: '1.000', popular: false },
  { id: 'coins_2000', coins: 2000, amount: 0, label: '2.000', popular: true },
  { id: 'coins_3000', coins: 3000, amount: 0, label: '3.000', popular: false },
];

export default function CoinsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [packs, setPacks] = useState(DEFAULT_PACKS);
  const [selected, setSelected] = useState('coins_2000');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getPublicSettings().then(data => {
      const s = data.settings;
      const updated = [...DEFAULT_PACKS];
      if (s.coinPack1Coins) updated[0] = { ...updated[0], coins: Number(s.coinPack1Coins), label: formatNumber(s.coinPack1Coins), id: `coins_${s.coinPack1Coins}` };
      if (s.coinPack1Price) updated[0] = { ...updated[0], amount: Number(s.coinPack1Price) };
      if (s.coinPack2Coins) updated[1] = { ...updated[1], coins: Number(s.coinPack2Coins), label: formatNumber(s.coinPack2Coins), id: `coins_${s.coinPack2Coins}` };
      if (s.coinPack2Price) updated[1] = { ...updated[1], amount: Number(s.coinPack2Price) };
      if (s.coinPack3Coins) updated[2] = { ...updated[2], coins: Number(s.coinPack3Coins), label: formatNumber(s.coinPack3Coins), id: `coins_${s.coinPack3Coins}` };
      if (s.coinPack3Price) updated[2] = { ...updated[2], amount: Number(s.coinPack3Price) };
      setPacks(updated);
      setSelected(updated[1].id);
    }).catch(() => {});
  }, []);

  const pack = packs.find(p => p.id === selected) || packs[1];

  async function handleComprar() {
    if (!user) { navigate('/login'); return; }
    if (!pack.amount) { setErr('Precio no configurado. Contactá al administrador.'); return; }
    setLoading(true);
    setErr('');
    try {
      const data = await createPayment({ plan_id: pack.id, amount: pack.amount });
      const url = data?.init_point || data?.redirect_url;
      if (url) {
        window.location.href = url;
      } else {
        setErr('No se pudo iniciar el pago. Intentá de nuevo.');
      }
    } catch (e) {
      setErr(e?.message || 'Error al conectar con el servicio de pagos.');
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
        <h1 className="font-bold text-lg">Comprar Monedas</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-mansion-gold/20 rounded-full flex items-center justify-center mx-auto">
            <CoinIcon className="w-9 h-9 text-mansion-gold" />
          </div>
          <h2 className="text-2xl font-bold">Comprá Monedas</h2>
          <p className="text-gray-400">
            Tenés <span className="text-mansion-gold font-semibold">{formatNumber(user?.coins ?? 0)}</span> monedas.
            Usálas para enviar regalos y destacarte.
          </p>
        </div>

        {/* Packs */}
        <div>
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Elegí un paquete</p>
          <div className="grid grid-cols-3 gap-3">
            {packs.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                  selected === p.id
                    ? 'border-mansion-gold bg-mansion-gold/10'
                    : 'border-white/10 bg-mansion-card hover:border-white/30'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-mansion-gold text-black text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    MÁS POPULAR
                  </span>
                )}
                <CoinIcon className="w-7 h-7 text-mansion-gold mb-1" />
                <span className="font-bold text-white text-lg">{p.label}</span>
                <span className="text-gray-500 text-[11px]">monedas</span>
                {p.amount > 0 && (
                  <span className="text-mansion-gold font-semibold text-sm mt-1">
                    {formatCurrencyAmount(p.amount)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm">
            {err}
          </div>
        )}

        {/* Buy button */}
        <button
          onClick={handleComprar}
          disabled={loading || !pack.amount}
          className="w-full py-4 bg-mansion-gold text-black font-bold text-lg rounded-xl hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Iniciando pago...
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Comprar {pack.label} monedas {pack.amount > 0 ? `- ${formatCurrencyAmount(pack.amount)}` : ''}
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-600">
          Pago procesado de forma segura
        </p>
      </div>
    </div>
  );
}
