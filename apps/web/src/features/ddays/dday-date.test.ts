import { describe, expect, it } from 'vitest';
import { getDday } from './dday-date';

describe('getDday', () => {
  it('shows future, today, and past labels', () => {
    expect(getDday('2026-09-15', false, '2026-09-12').label).toBe('D-3');
    expect(getDday('2026-09-12', false, '2026-09-12').label).toBe('D-DAY');
    expect(getDday('2026-09-10', false, '2026-09-12').label).toBe('D+2');
  });
  it('moves a passed yearly date to next year', () => {
    expect(getDday('2020-03-01', true, '2026-09-12')).toEqual({
      effectiveDate: '2027-03-01',
      days: 170,
      label: 'D-170',
    });
  });
  it('uses February 28 for a leap-day anniversary in a non-leap year', () => {
    expect(getDday('2024-02-29', true, '2026-02-27').effectiveDate).toBe('2026-02-28');
  });
});
