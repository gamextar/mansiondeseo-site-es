import { getBottomNavPagePadding } from '../lib/bottomNavConfig';

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

const PROBE_IMAGE_URL = '/feed-shell-probe.svg?v=2';

export default function FeedShellProbePage() {
  const isStandaloneMobileApp = detectStandaloneMobile();
  const navBottomOffset = getBottomNavPagePadding(isStandaloneMobileApp);

  return (
    <div
      className="min-h-mobile-browser-screen bg-mansion-base lg:pb-[84px]"
      style={{
        paddingBottom: navBottomOffset,
        backgroundImage: `url(${PROBE_IMAGE_URL})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="pt-navbar lg:pt-0">
        <div className="px-4 pt-4 text-white lg:px-8 lg:pt-8">
          <div className="inline-flex rounded-full border border-white/35 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] backdrop-blur-sm">
            Feed Shell Test
          </div>
        </div>
      </div>
    </div>
  );
}
