const dayNumber = (value: string) => Math.floor(Date.parse(`${value}T00:00:00Z`) / 86400000);
const validDate = (year: number, month: number, day: number) => {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
};
export const seoulToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function getDday(targetDate: string, repeatYearly: boolean, today = seoulToday()) {
  let effectiveDate = targetDate;
  if (repeatYearly) {
    const [, m, d] = targetDate.split('-').map(Number);
    const year = Number(today.slice(0, 4));
    effectiveDate = validDate(year, m, d);
    if (effectiveDate < today) effectiveDate = validDate(year + 1, m, d);
  }
  const days = dayNumber(effectiveDate) - dayNumber(today);
  return {
    effectiveDate,
    days,
    label: days === 0 ? 'D-DAY' : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`,
  };
}

export function getDdayOccurrence(
  targetDate: string,
  effectiveDate: string,
  repeatYearly: boolean,
) {
  if (!repeatYearly) return null;
  const firstYear = Number(targetDate.slice(0, 4));
  const effectiveYear = Number(effectiveDate.slice(0, 4));
  return Math.max(1, effectiveYear - firstYear + 1);
}
