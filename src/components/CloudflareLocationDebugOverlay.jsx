import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, RefreshCw, X } from 'lucide-react';
import { getCloudflareLocationDebug } from '../lib/api';

const LOCATION_FIELDS = [
  ['country', 'Pais'],
  ['region', 'Region'],
  ['regionCode', 'Region code'],
  ['city', 'Ciudad'],
  ['postalCode', 'Postal'],
  ['latitude', 'Latitud'],
  ['longitude', 'Longitud'],
  ['timezone', 'Timezone'],
  ['continent', 'Continente'],
  ['colo', 'Colo'],
  ['asn', 'ASN'],
  ['asOrganization', 'ASN org'],
  ['tlsVersion', 'TLS'],
];

function FieldRow({ label, value }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 border-b border-white/5 py-1.5 last:border-b-0">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-text-dim">{label}</dt>
      <dd className="break-words text-xs font-medium text-text-primary">{value || '-'}</dd>
    </div>
  );
}

export default function CloudflareLocationDebugOverlay() {
  const location = useLocation();
  const enabled = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('geo_debug') === '1';
  }, [location.search]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true);

  const load = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    getCloudflareLocationDebug()
      .then((nextData) => {
        setData(nextData);
        setVisible(true);
      })
      .catch((err) => {
        setError(err?.message || 'No se pudo leer la geolocalizacion de Cloudflare');
      })
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  if (!enabled || !visible) return null;

  const cf = data?.cf || {};
  const headers = data?.headers || {};
  const headerEntries = Object.entries(headers);

  return (
    <div className="fixed bottom-4 left-4 z-[10000] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-300/20 bg-black/85 text-white shadow-2xl shadow-black/45 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">Cloudflare location</p>
            <p className="truncate text-[10px] text-text-dim">{data?.generatedAt || (loading ? 'Cargando...' : 'geo_debug=1')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-text-muted transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Refrescar geolocalizacion"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-text-muted transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar overlay"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
        {error ? (
          <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</p>
        ) : null}

        <dl>
          {LOCATION_FIELDS.map(([key, label]) => (
            <FieldRow key={key} label={label} value={cf[key]} />
          ))}
        </dl>

        {headerEntries.length > 0 ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">Headers</p>
            <dl>
              {headerEntries.map(([key, value]) => (
                <FieldRow key={key} label={key} value={value} />
              ))}
            </dl>
          </div>
        ) : null}

        <p className="mt-3 text-[10px] leading-4 text-text-dim">
          {data?.note || 'Estos datos pueden venir vacios en local o si Cloudflare no los adjunta al request.'}
        </p>
      </div>
    </div>
  );
}
