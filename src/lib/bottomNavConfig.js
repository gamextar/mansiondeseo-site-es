export const BOTTOM_NAV_HEIGHT = 76;
export const BOTTOM_NAV_BOTTOM_PADDING = 0;
export const STANDALONE_BOTTOM_NAV_HEIGHT = 80;
export const STANDALONE_BOTTOM_NAV_BOTTOM_PADDING = 8;
export const BOTTOM_NAV_SIDE_PADDING = 8;
export const BOTTOM_NAV_OPACITY = 40;
export const BOTTOM_NAV_BLUR = 24;

export function getBottomNavHeight(isStandalone = false) {
  return isStandalone ? STANDALONE_BOTTOM_NAV_HEIGHT : BOTTOM_NAV_HEIGHT;
}

export function getBottomNavBottomPadding(isStandalone = false) {
  return isStandalone ? STANDALONE_BOTTOM_NAV_BOTTOM_PADDING : BOTTOM_NAV_BOTTOM_PADDING;
}

export function getStandaloneBottomNavOffset() {
  return `${STANDALONE_BOTTOM_NAV_HEIGHT + STANDALONE_BOTTOM_NAV_BOTTOM_PADDING}px`;
}

export function getBrowserBottomNavOffset() {
  return `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_NAV_BOTTOM_PADDING}px + ${BOTTOM_NAV_HEIGHT}px)`;
}

export function getBottomNavPagePadding(isStandalone = false) {
  return isStandalone ? getStandaloneBottomNavOffset() : getBrowserBottomNavOffset();
}

export function applyBottomNavCssVariables(root) {
  if (!root) return;
  root.style.setProperty('--bottom-nav-height', `${BOTTOM_NAV_HEIGHT}px`);
  root.style.setProperty('--bottom-nav-bottom-padding', `${BOTTOM_NAV_BOTTOM_PADDING}px`);
  root.style.setProperty('--standalone-bottom-nav-height', `${STANDALONE_BOTTOM_NAV_HEIGHT}px`);
  root.style.setProperty('--standalone-bottom-nav-bottom-padding', `${STANDALONE_BOTTOM_NAV_BOTTOM_PADDING}px`);
}
