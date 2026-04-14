export const BOTTOM_NAV_HEIGHT = 80;
export const BOTTOM_NAV_BOTTOM_PADDING = 8;
export const BOTTOM_NAV_SIDE_PADDING = 8;
export const BOTTOM_NAV_OPACITY = 40;
export const BOTTOM_NAV_BLUR = 24;

export function getStandaloneBottomNavOffset() {
  return `${BOTTOM_NAV_HEIGHT + BOTTOM_NAV_BOTTOM_PADDING}px`;
}

export function getBrowserBottomNavOffset() {
  return `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_NAV_BOTTOM_PADDING}px + ${BOTTOM_NAV_HEIGHT}px)`;
}
