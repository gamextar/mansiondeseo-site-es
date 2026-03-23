import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Sliders, Eye, Image } from 'lucide-react';
import { getSettings, updateSettings } from '../lib/api';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [blurLevel, setBlurLevel] = useState(14);
  const [freeVisiblePhotos, setFreeVisiblePhotos] = useState(1);
  const [freeOwnPhotos, setFreeOwnPhotos] = useState(3);

  useEffect(() => {
    getSettings()
      .then(data => {
        setBlurLevel(data.settings.blurLevel);
        setFreeVisiblePhotos(data.settings.freeVisiblePhotos);
        setFreeOwnPhotos(data.settings.freeOwnPhotos);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const data = await updateSettings({
        blur_level: blurLevel,
        free_visible_photos: freeVisiblePhotos,
        free_own_photos: freeOwnPhotos,
      });
      setBlurLevel(data.settings.blurLevel);
      setFreeVisiblePhotos(data.settings.freeVisiblePhotos);
      setFreeOwnPhotos(data.settings.freeOwnPhotos);
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

  return (
    <div className="min-h-screen bg-mansion-base">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-mansion-base/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <h1 className="text-lg font-semibold text-text-primary">Configuración</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Blur Level */}
        <div className="bg-mansion-card rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-mansion-elevated flex items-center justify-center">
              <Eye className="w-5 h-5 text-mansion-gold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Nivel de Blur</h2>
              <p className="text-xs text-text-dim">Intensidad del desenfoque en fotos restringidas</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="range"
              min="0"
              max="30"
              value={blurLevel}
              onChange={e => setBlurLevel(Number(e.target.value))}
              className="w-full accent-mansion-gold"
            />
            <div className="flex justify-between text-xs text-text-dim">
              <span>Sin blur</span>
              <span className="text-mansion-gold font-medium">{blurLevel}px</span>
              <span>Máximo</span>
            </div>
            {/* Preview */}
            <div className="relative w-full h-24 rounded-xl overflow-hidden bg-mansion-elevated mt-2">
              <div
                className="absolute inset-0 bg-gradient-to-br from-mansion-crimson/30 to-mansion-gold/30"
                style={{ filter: `blur(${blurLevel}px)` }}
              />
              <p className="absolute inset-0 flex items-center justify-center text-xs text-text-dim">
                Vista previa
              </p>
            </div>
          </div>
        </div>

        {/* Free Visible Photos */}
        <div className="bg-mansion-card rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-mansion-elevated flex items-center justify-center">
              <Image className="w-5 h-5 text-mansion-gold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Fotos Visibles (Otros)</h2>
              <p className="text-xs text-text-dim">Fotos sin blur que un usuario free ve de cada perfil</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFreeVisiblePhotos(Math.max(0, freeVisiblePhotos - 1))}
              className="w-10 h-10 rounded-xl bg-mansion-elevated flex items-center justify-center text-text-secondary hover:text-mansion-gold transition-colors text-lg font-bold"
            >−</button>
            <span className="text-2xl font-bold text-mansion-gold w-12 text-center">{freeVisiblePhotos}</span>
            <button
              onClick={() => setFreeVisiblePhotos(Math.min(20, freeVisiblePhotos + 1))}
              className="w-10 h-10 rounded-xl bg-mansion-elevated flex items-center justify-center text-text-secondary hover:text-mansion-gold transition-colors text-lg font-bold"
            >+</button>
          </div>
          <p className="text-xs text-text-dim mt-2">
            Foto 1 de cada perfil siempre visible. Las fotos desde la #{freeVisiblePhotos + 1} se blurean.
          </p>
        </div>

        {/* Free Own Profile Photos */}
        <div className="bg-mansion-card rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-mansion-elevated flex items-center justify-center">
              <Sliders className="w-5 h-5 text-mansion-gold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Fotos Visibles (Propio)</h2>
              <p className="text-xs text-text-dim">Fotos sin blur que un usuario free ve de su propio perfil</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFreeOwnPhotos(Math.max(0, freeOwnPhotos - 1))}
              className="w-10 h-10 rounded-xl bg-mansion-elevated flex items-center justify-center text-text-secondary hover:text-mansion-gold transition-colors text-lg font-bold"
            >−</button>
            <span className="text-2xl font-bold text-mansion-gold w-12 text-center">{freeOwnPhotos}</span>
            <button
              onClick={() => setFreeOwnPhotos(Math.min(20, freeOwnPhotos + 1))}
              className="w-10 h-10 rounded-xl bg-mansion-elevated flex items-center justify-center text-text-secondary hover:text-mansion-gold transition-colors text-lg font-bold"
            >+</button>
          </div>
          <p className="text-xs text-text-dim mt-2">
            Incluye foto de perfil + fotos 2 y 3 de la galería = {freeOwnPhotos} fotos sin blur en su propio perfil.
          </p>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
            bg-gradient-to-r from-mansion-crimson to-mansion-gold text-white
            hover:shadow-lg hover:shadow-mansion-crimson/20 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
