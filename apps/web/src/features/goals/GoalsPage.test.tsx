import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalsPage } from './GoalsPage';

const props = {
  goals: [],
  loading: false,
  currentUserId: 'user-1',
  householdId: 'home-1',
  role: 'member' as const,
  onCreate: vi.fn().mockResolvedValue(undefined),
  onUpdate: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onFeedback: vi.fn(),
};
describe('GoalsPage', () => {
  it('creates a family goal with progress', async () => {
    render(<GoalsPage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '목표 추가' }));
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '가족 여행' } });
    fireEvent.change(screen.getByLabelText(/진행률/), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(props.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '가족 여행',
        visibility: 'family',
        progress: 40,
        priority: 'medium',
      }),
    );
  });
  it('hides controls for another member family goal', () => {
    render(
      <GoalsPage
        {...props}
        goals={[
          {
            id: '1',
            householdId: 'home-1',
            ownerUserId: 'user-2',
            visibility: 'family',
            title: '다른 목표',
            description: '',
            targetDate: null,
            status: 'active',
            progress: 0,
            priority: 'high',
            createdAt: '',
            updatedAt: '',
          },
        ]}
      />,
    );
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
  });
  it('quickly advances and completes an editable goal', () => {
    const goal = {
      id: 'mine',
      householdId: 'home-1',
      ownerUserId: 'user-1',
      visibility: 'family' as const,
      title: '운동',
      description: '',
      targetDate: '2099-12-31',
      status: 'active' as const,
      progress: 90,
      priority: 'high' as const,
      createdAt: '',
      updatedAt: '',
    };
    render(<GoalsPage {...props} goals={[goal]} />);
    fireEvent.click(screen.getByRole('button', { name: '+10%' }));
    expect(props.onUpdate).toHaveBeenCalledWith(
      'mine',
      expect.objectContaining({ progress: 100, status: 'completed' }),
    );
  });
});
