export function getGalleryPhotos(profile) {
  const avatarUrl = profile?.avatar_url || '';
  const rawPhotos = Array.isArray(profile?.photos) ? profile.photos : [];
  const seen = new Set();
  const gallery = [];

  for (const url of rawPhotos) {
    if (typeof url !== 'string' || !url || url === avatarUrl || seen.has(url)) continue;
    seen.add(url);
    gallery.push(url);
  }

  return gallery;
}

export function getDisplayPhotos(profile) {
  const avatarUrl = profile?.avatar_url || '';
  const gallery = getGalleryPhotos(profile);
  return avatarUrl ? [avatarUrl, ...gallery] : gallery;
}

export function getPrimaryProfilePhoto(profile) {
  return profile?.avatar_url || getGalleryPhotos(profile)[0] || '';
}

export function getPrimaryProfileCrop(profile) {
  return profile?.avatar_url ? profile?.avatar_crop || null : null;
}
