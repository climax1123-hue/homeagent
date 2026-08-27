import { describe, expect, it } from 'vitest';
import { householdErrorMessage, maskEmail } from './household';

describe('household helpers', () => {
  it('maps a known domain error to a safe Korean message', () => {
    expect(householdErrorMessage('ADMIN_REQUIRED')).toBe('가족 관리자만 이 작업을 할 수 있습니다.');
  });

  it('does not expose unknown backend errors', () => {
    expect(householdErrorMessage('relation household_members does not exist')).toBe(
      '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  });

  it('masks the local part of an email address', () => {
    expect(maskEmail('family.member@example.com')).toBe('fa***********@example.com');
  });

  it('handles malformed email values safely', () => {
    expect(maskEmail('not-an-email')).toBe('***');
  });
});
