export function getProvince(value) {
  return String(value?.province ?? value?.city ?? '').trim();
}

export function getLocality(value) {
  return String(value?.locality ?? '').trim();
}

export function formatLocation(value) {
  const province = getProvince(value);
  const locality = getLocality(value);

  if (locality && province) return `${locality}, ${province}`;
  return locality || province || '';
}
