export default function ProfileShellProbePage() {
  return (
    <div
      className="min-h-screen bg-mansion-base pb-mobile-legacy-nav lg:pb-8"
      style={{
        backgroundImage: 'url(/feed-shell-probe.svg?v=2)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="pt-navbar lg:pt-0">
        <div className="px-4 pt-4 text-white lg:px-8 lg:pt-8">
          <div className="inline-flex rounded-full border border-white/35 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] backdrop-blur-sm">
            User CP Shell Test
          </div>
        </div>
        <div className="h-[120svh]" />
      </div>
    </div>
  );
}
