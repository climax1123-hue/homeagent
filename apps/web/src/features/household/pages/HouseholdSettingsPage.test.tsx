import type { Household, HouseholdMember } from '@home/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HouseholdSettingsPage } from './HouseholdSettingsPage';

const household: Household = {
  id: 'household',
  name: '우리 가족',
  createdAt: '2026-08-26T00:00:00Z',
};
const member: HouseholdMember = {
  id: 'member',
  householdId: 'household',
  userId: 'user',
  displayName: '엄마',
  role: 'member',
  status: 'active',
  joinedAt: '2026-08-26T00:00:00Z',
  statusChangedAt: '2026-08-26T00:00:00Z',
};

describe('HouseholdSettingsPage', () => {
  it('updates only a trimmed display name', async () => {
    const onUpdateDisplayName = vi.fn().mockResolvedValue(undefined);
    render(
      <HouseholdSettingsPage
        household={household}
        member={member}
        onUpdateDisplayName={onUpdateDisplayName}
      />,
    );
    fireEvent.change(screen.getByLabelText('표시 이름'), { target: { value: '  새로운 이름  ' } });
    fireEvent.click(screen.getByRole('button', { name: '변경 저장' }));
    await waitFor(() => expect(onUpdateDisplayName).toHaveBeenCalledWith('새로운 이름'));
    expect(screen.getByRole('status')).toHaveTextContent('표시 이름을 변경했습니다.');
  });
});
