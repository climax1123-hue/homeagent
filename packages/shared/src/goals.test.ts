import { describe, expect, it } from 'vitest';
import { validateDday, validateGoal, type DdayInput, type GoalInput } from './goals';

const goal: GoalInput = {
  householdId: 'home',
  ownerUserId: 'user',
  visibility: 'family',
  title: '가족 여행 준비',
  description: '',
  targetDate: null,
  status: 'active',
  progress: 20,
  priority: 'high',
};

const dday: DdayInput = {
  householdId: 'home',
  ownerUserId: 'user',
  visibility: 'family',
  title: '결혼기념일',
  targetDate: '2026-10-10',
  memo: '',
  repeatYearly: true,
  category: 'anniversary',
  isPinned: true,
};

describe('enhanced goals and D-days', () => {
  it('validates a prioritized goal and completed progress', () => {
    expect(validateGoal(goal)).toBeNull();
    expect(validateGoal({ ...goal, status: 'completed', progress: 90 })).toContain('100%');
  });

  it('rejects impossible calendar dates', () => {
    expect(validateDday(dday)).toBeNull();
    expect(validateDday({ ...dday, targetDate: '2026-02-30' })).toContain('올바른');
  });
});
