export function isSafariDesktopBrowser() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const vendor = window.navigator.vendor || '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg|OPR/i.test(ua) && /Apple/i.test(vendor);
  const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
  return isSafari && isDesktop;
}
