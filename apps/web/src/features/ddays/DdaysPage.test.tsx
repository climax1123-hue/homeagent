import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DdaysPage } from './DdaysPage';
const props = {
  ddays: [],
  loading: false,
  currentUserId: 'user-1',
  householdId: 'home-1',
  role: 'member' as const,
  onCreate: vi.fn().mockResolvedValue(undefined),
  onUpdate: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onFeedback: vi.fn(),
};
describe('DdaysPage', () => {
  it('creates a private yearly dday', async () => {
    render(<DdaysPage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '디데이 추가' }));
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '결혼기념일' } });
    fireEvent.change(screen.getByLabelText('공개 범위'), { target: { value: 'private' } });
    fireEvent.click(screen.getByLabelText('매년 같은 날 반복'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(props.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '결혼기념일', visibility: 'private', repeatYearly: true }),
    );
  });
});
