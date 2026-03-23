import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

const DISMISSED_KEY = 'mansion_install_dismissed';

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isMobile() {
  return isIOS() || isAndroid();
}

export default function InstallAppBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [step, setStep] = useState('idle'); // 'idle' | 'ios-guide' | 'installing'
  const ios = isIOS();

  useEffect(() => {
    // Never show if already installed or previously dismissed
    if (isStandalone()) return;
    if (!isMobile()) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    // Android: capture the native install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: show the manual guide after a small delay
    if (ios) {
      const timer = setTimeout(() => setShow(true), 2500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [ios]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
    setStep('idle');
  };

  const handleInstall = async () => {
    if (ios) {
      setStep('ios-guide');
      return;
    }
    if (deferredPrompt) {
      setStep('installing');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      } else {
        setStep('idle');
      }
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-[72px] lg:bottom-6 left-3 right-3 lg:left-auto lg:right-6 lg:max-w-sm z-[200] animate-fade-in">
      <div className="bg-mansion-card border border-mansion-gold/25 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-4">
          <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-mansion-base">
            <img src="/icon-192.png" alt="Mansión Deseo" className="w-full h-full object-cover" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary leading-snug">
              Instala la App de la Mansión
            </p>
            <p className="text-xs text-text-dim mt-0.5 leading-relaxed">
              Mayor privacidad, acceso inmediato y notificaciones.
            </p>
          </div>

          <button
            onClick={dismiss}
            className="flex-shrink-0 w-7 h-7 rounded-full hover:bg-mansion-elevated flex items-center justify-center text-text-dim hover:text-text-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* iOS guide */}
        {step === 'ios-guide' && (
          <div className="px-4 pb-4 border-t border-mansion-border/20 pt-3 space-y-2.5">
            <p className="text-xs font-semibold text-mansion-gold">Cómo instalar en iPhone / iPad:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-mansion-gold/20 text-mansion-gold text-[10px] font-bold flex items-center justify-center">1</span>
                <p className="text-xs text-text-muted leading-relaxed">
                  Toca el ícono <span className="inline-flex items-center gap-0.5 text-mansion-gold font-medium">
                    <Share className="w-3 h-3" /> Compartir
                  </span> en la barra inferior de Safari.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-mansion-gold/20 text-mansion-gold text-[10px] font-bold flex items-center justify-center">2</span>
                <p className="text-xs text-text-muted leading-relaxed">
                  Desplazate hacia abajo y seleccioná <strong className="text-text-primary">"Añadir a pantalla de inicio"</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-mansion-gold/20 text-mansion-gold text-[10px] font-bold flex items-center justify-center">3</span>
                <p className="text-xs text-text-muted leading-relaxed">
                  Confirmá tocando <strong className="text-text-primary">"Añadir"</strong>.
                </p>
              </div>
            </div>
            <button onClick={dismiss} className="w-full mt-1 text-xs text-text-dim text-center py-1 hover:text-text-muted transition-colors">
              Entendido
            </button>
          </div>
        )}

        {/* Default action button */}
        {step === 'idle' && (
          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={dismiss}
              className="flex-1 py-2 rounded-xl border border-mansion-border/40 text-xs text-text-dim hover:text-text-muted transition-colors"
            >
              Ahora no
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-mansion-crimson to-mansion-gold text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              Instalar
            </button>
          </div>
        )}

        {step === 'installing' && (
          <div className="px-4 pb-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Arrow pointing to bottom nav area on iOS guide */}
      {step === 'ios-guide' && ios && (
        <div className="flex justify-center mt-1">
          <div className="w-4 h-4 border-b-2 border-r-2 border-mansion-gold/30 rotate-45 -translate-y-1" />
        </div>
      )}
    </div>
  );
}
