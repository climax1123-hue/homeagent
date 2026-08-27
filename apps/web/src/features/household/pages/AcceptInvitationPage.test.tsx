import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcceptInvitationPage } from './AcceptInvitationPage';

describe('AcceptInvitationPage', () => {
  it('submits the token and trimmed display name', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(<AcceptInvitationPage onAccept={onAccept} rawToken="one-time-token" />);

    fireEvent.change(screen.getByLabelText('가족에게 표시할 이름'), {
      target: { value: '  엄마  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '가족 공간 참여하기' }));

    await waitFor(() => expect(onAccept).toHaveBeenCalledWith('one-time-token', '엄마'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('shows a safe message when the invitation has expired', async () => {
    const onAccept = vi
      .fn()
      .mockRejectedValue({ code: 'INVITATION_EXPIRED', details: 'sensitive backend detail' });
    render(<AcceptInvitationPage onAccept={onAccept} rawToken="expired-token" />);

    fireEvent.change(screen.getByLabelText('가족에게 표시할 이름'), {
      target: { value: '아빠' },
    });
    fireEvent.click(screen.getByRole('button', { name: '가족 공간 참여하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '초대가 만료되었습니다. 관리자에게 새 초대를 요청해 주세요.',
    );
    expect(screen.queryByText('sensitive backend detail')).not.toBeInTheDocument();
  });
});
