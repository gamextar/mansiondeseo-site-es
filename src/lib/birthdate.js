export function normalizeBirthdate(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const [yearStr, monthStr, dayStr] = raw.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return '';
  }
  return raw;
}

export function calculateAgeFromBirthdate(value) {
  const birthdate = normalizeBirthdate(value);
  if (!birthdate) return null;
  const [yearStr, monthStr, dayStr] = birthdate.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age -= 1;
  }
  return age;
}

export function isAdultBirthdate(value, minimumAge = 18) {
  const age = calculateAgeFromBirthdate(value);
  return Number.isFinite(age) && age >= minimumAge;
}

export function getLatestAdultBirthdate(minimumAge = 18) {
  const now = new Date();
  const year = now.getUTCFullYear() - minimumAge;
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
