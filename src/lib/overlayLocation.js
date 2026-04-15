export function stripOverlayLocationState(state) {
  if (!state || typeof state !== 'object') return null;

  const next = { ...state };
  delete next.backgroundLocation;
  delete next.backgroundScrollY;
  delete next.modal;

  return Object.keys(next).length > 0 ? next : null;
}

export function snapshotBackgroundLocation(location) {
  if (!location || typeof location !== 'object') return null;

  return {
    pathname: location.pathname || '/',
    search: location.search || '',
    hash: location.hash || '',
    state: stripOverlayLocationState(location.state),
  };
}
