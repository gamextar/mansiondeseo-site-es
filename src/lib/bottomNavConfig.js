export const BOTTOM_NAV_HEIGHT = 72;
export const BOTTOM_NAV_VISUAL_OFFSET = 6;
export const BOTTOM_NAV_PAGE_EXTRA_PADDING = 0;
export const STANDALONE_BOTTOM_NAV_HEIGHT = 78;
export const STANDALONE_BOTTOM_NAV_VISUAL_OFFSET = 8;
export const STANDALONE_BOTTOM_NAV_PAGE_EXTRA_PADDING = 0;
export const BOTTOM_NAV_SIDE_PADDING = 8;
export const BOTTOM_NAV_OPACITY = 40;
export const BOTTOM_NAV_BLUR = 24;

function readRuntimeNumberOverride(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = new URLSearchParams(window.location.search).get(name);
    if (raw === null || raw === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function getBottomNavHeight(isStandalone = false) {
  const fallback = isStandalone ? STANDALONE_BOTTOM_NAV_HEIGHT : BOTTOM_NAV_HEIGHT;
  return readRuntimeNumberOverride('nav_height', fallback);
}

export function getBottomNavVisualOffset(isStandalone = false) {
  const fallback = isStandalone ? STANDALONE_BOTTOM_NAV_VISUAL_OFFSET : BOTTOM_NAV_VISUAL_OFFSET;
  return readRuntimeNumberOverride('nav_visual', fallback);
}

export function getBottomNavPageExtraPadding(isStandalone = false) {
  const fallback = isStandalone ? STANDALONE_BOTTOM_NAV_PAGE_EXTRA_PADDING : BOTTOM_NAV_PAGE_EXTRA_PADDING;
  return readRuntimeNumberOverride('nav_extra', fallback);
}

export function getStandaloneBottomNavOffset() {
  return `${getBottomNavHeight(true) + getBottomNavVisualOffset(true) + getBottomNavPageExtraPadding(true)}px`;
}

export function getBrowserBottomNavOffset() {
  return `calc(env(safe-area-inset-bottom, 0px) + ${getBottomNavVisualOffset(false)}px + ${getBottomNavHeight(false)}px + ${getBottomNavPageExtraPadding(false)}px)`;
}

export function getBottomNavPagePadding(isStandalone = false) {
  return isStandalone ? getStandaloneBottomNavOffset() : getBrowserBottomNavOffset();
}

export function applyBottomNavCssVariables(root) {
  if (!root) return;
  root.style.setProperty('--bottom-nav-height', `${getBottomNavHeight(false)}px`);
  root.style.setProperty('--bottom-nav-visual-offset', `${getBottomNavVisualOffset(false)}px`);
  root.style.setProperty('--bottom-nav-page-extra-padding', `${getBottomNavPageExtraPadding(false)}px`);
  root.style.setProperty('--standalone-bottom-nav-height', `${getBottomNavHeight(true)}px`);
  root.style.setProperty('--standalone-bottom-nav-visual-offset', `${getBottomNavVisualOffset(true)}px`);
  root.style.setProperty('--standalone-bottom-nav-page-extra-padding', `${getBottomNavPageExtraPadding(true)}px`);
}
