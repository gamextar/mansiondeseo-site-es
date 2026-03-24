import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Sliders, Eye, Image, Crown, MessageCircle, Shield, Globe, Lock, DollarSign, Smartphone, Monitor } from 'lucide-react';
import { getSettings, updateSettings } from '../lib/api';
import { useAuth } from '../App';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Photo & Blur
  const [blurMobile, setBlurMobile] = useState(14);
  const [blurDesktop, setBlurDesktop] = useState(8);
  const [freeVisiblePhotos, setFreeVisiblePhotos] = useState(1);
  const [freeOwnPhotos, setFreeOwnPhotos] = useState(3);

  // VIP
  const [showVipButton, setShowVipButton] = useState(true);
  const [vipPriceMonthly, setVipPriceMonthly] = useState('');
  const [vipPrice3Months, setVipPrice3Months] = useState('');
  const [vipPrice6Months, setVipPrice6Months] = useState('');

  // Messaging
  const [dailyMessageLimit, setDailyMessageLimit] = useState(5);

  // Site
  const [siteCountry, setSiteCountry] = useState('AR');
  const [hidePasswordRegister, setHidePasswordRegister] = useState(true);

  useEffect(() => {
    if (!user?.is_admin) { navigate('/'); return; }
    getSettings()
      .then(data => {
        const s = data.settings;
        setBlurMobile(s.blurMobile);
        setBlurDesktop(s.blurDesktop);
        setFreeVisiblePhotos(s.freeVisiblePhotos);
        setFreeOwnPhotos(s.freeOwnPhotos);
        setShowVipButton(s.showVipButton);
        setDailyMessageLimit(s.dailyMessageLimit);
        setSiteCountry(s.siteCountry);
        setHidePasswordRegister(s.hidePasswordRegister);
        setVipPriceMonthly(s.vipPriceMonthly);
        setVipPrice3Months(s.vipPrice3Months);
        setVipPrice6Months(s.vipPrice6Months);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const data = await updateSettings({
        blur_mobile: blurMobile,
        blur_desktop: blurDesktop,
        free_visible_photos: freeVisiblePhotos,
        free_own_photos: freeOwnPhotos,
        show_vip_button: showVipButton ? '1' : '0',
        daily_message_limit: dailyMessageLimit,
        site_country: siteCountry,
        hide_password_register: hidePasswordRegister ? '1' : '0',
        vip_price_monthly: vipPriceMonthly,
        vip_price_3months: vipPrice3Months,
        vip_price_6months: vipPrice6Months,
      });
      const s = data.settings;
      setBlurMobile(s.blurMobile);
      setBlurDesktop(s.blurDesktop);
      setFreeVisiblePhotos(s.freeVisiblePhotos);
      setFreeOwnPhotos(s.freeOwnPhotos);
      setShowVipButton(s.showVipButton);
      setDailyMessageLimit(s.dailyMessageLimit);
      setSiteCountry(s.siteCountry);
      setHidePasswordRegister(s.hidePasswordRegister);
      setVipPriceMonthly(s.vipPriceMonthly);
      setVipPrice3Months(s.vipPrice3Months);
      setVipPrice6Months(s.vipPrice6Months);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-mansion-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const ToggleSwitch = ({ value, onChange }) => (
    <button
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-mansion-gold' : 'bg-mansion-border'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );

  const Counter = ({ value, onChange, min = 0, max = 99 }) => (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center text-text-secondary hover:text-mansion-gold transition-colors text-lg font-bold">−</button>
      <span className="text-xl font-bold text-mansion-gold w-10 text-center">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center text-text-secondary hover:text-mansion-gold transition-colors text-lg font-bold">+</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-mansion-base/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Panel de Administración</h1>
            <p className="text-[11px] text-text-dim">Solo visible para administradores</p>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-mansion-crimson/20 text-mansion-crimson border border-mansion-crimson/30">Admin</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">

        {/* ── FOTOS & BLUR ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Image className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Fotos & Blur</h2>
          </div>
          <div className="space-y-3">
            {/* Blur Mobile */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Blur Mobile</h3>
                  <p className="text-[11px] text-text-dim">Desenfoque en dispositivos móviles</p>
                </div>
              </div>
              <input type="range" min="0" max="30" value={blurMobile} onChange={e => setBlurMobile(Number(e.target.value))} className="w-full accent-mansion-gold" />
              <div className="flex justify-between text-[11px] text-text-dim mt-1">
                <span>Sin blur</span>
                <span className="text-mansion-gold font-medium">{blurMobile}px</span>
                <span>Máximo</span>
              </div>
            </div>

            {/* Blur Desktop */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Blur Desktop</h3>
                  <p className="text-[11px] text-text-dim">Desenfoque en computadoras</p>
                </div>
              </div>
              <input type="range" min="0" max="30" value={blurDesktop} onChange={e => setBlurDesktop(Number(e.target.value))} className="w-full accent-mansion-gold" />
              <div className="flex justify-between text-[11px] text-text-dim mt-1">
                <span>Sin blur</span>
                <span className="text-mansion-gold font-medium">{blurDesktop}px</span>
                <span>Máximo</span>
              </div>
            </div>

            {/* Free Visible Photos (Others) */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Image className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Fotos visibles (otros)</h3>
                    <p className="text-[11px] text-text-dim">Fotos sin blur por perfil ajeno</p>
                  </div>
                </div>
                <Counter value={freeVisiblePhotos} onChange={setFreeVisiblePhotos} max={20} />
              </div>
            </div>

            {/* Free Own Photos */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Sliders className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Fotos visibles (propio)</h3>
                    <p className="text-[11px] text-text-dim">Fotos sin blur en su propio perfil</p>
                  </div>
                </div>
                <Counter value={freeOwnPhotos} onChange={setFreeOwnPhotos} max={20} />
              </div>
            </div>
          </div>
        </section>

        {/* ── MENSAJERÍA ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Mensajería</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Mensajes diarios (free)</h3>
                    <p className="text-[11px] text-text-dim">Límite para usuarios no VIP</p>
                  </div>
                </div>
                <Counter value={dailyMessageLimit} onChange={setDailyMessageLimit} min={1} max={50} />
              </div>
            </div>
          </div>
        </section>

        {/* ── VIP & MONETIZACIÓN ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">VIP & Monetización</h2>
          </div>
          <div className="space-y-3">
            {/* Show VIP Button */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Crown className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Botón "Hazte VIP"</h3>
                    <p className="text-[11px] text-text-dim">Mostrar opciones de suscripción</p>
                  </div>
                </div>
                <ToggleSwitch value={showVipButton} onChange={setShowVipButton} />
              </div>
            </div>

            {/* VIP Prices */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5 space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Precios VIP</h3>
                  <p className="text-[11px] text-text-dim">Valores de suscripción (moneda local)</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">1 Mes</label>
                  <input type="text" value={vipPriceMonthly} onChange={e => setVipPriceMonthly(e.target.value)} placeholder="$4.990" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">3 Meses</label>
                  <input type="text" value={vipPrice3Months} onChange={e => setVipPrice3Months(e.target.value)} placeholder="$11.990" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">6 Meses</label>
                  <input type="text" value={vipPrice6Months} onChange={e => setVipPrice6Months(e.target.value)} placeholder="$19.990" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SITIO ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Sitio</h2>
          </div>
          <div className="space-y-3">
            {/* Country */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Globe className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">País del sitio</h3>
                    <p className="text-[11px] text-text-dim">Código ISO (AR, CL, MX, CO...)</p>
                  </div>
                </div>
                <input type="text" value={siteCountry} onChange={e => setSiteCountry(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="w-16 text-center text-sm py-2 px-2 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-mansion-gold font-bold uppercase" />
              </div>
            </div>

            {/* Hide Password */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Lock className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Ocultar contraseña</h3>
                    <p className="text-[11px] text-text-dim">Ojito cerrado por defecto en registro</p>
                  </div>
                </div>
                <ToggleSwitch value={hidePasswordRegister} onChange={setHidePasswordRegister} />
              </div>
            </div>
          </div>
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
            bg-gradient-to-r from-mansion-crimson to-mansion-gold text-white
            hover:shadow-lg hover:shadow-mansion-crimson/20 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
