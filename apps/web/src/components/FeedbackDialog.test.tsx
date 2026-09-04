import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackDialog } from './FeedbackDialog';

describe('FeedbackDialog', () => {
  it('shows a success message and closes with confirmation', () => {
    const onClose = vi.fn();
    render(
      <FeedbackDialog
        feedback={{ type: 'success', message: '거래를 정상적으로 추가했습니다.' }}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('거래를 정상적으로 추가했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('announces an error as an alert dialog', () => {
    render(
      <FeedbackDialog
        feedback={{ type: 'error', message: '일정을 저장하지 못했습니다.' }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('alertdialog')).toHaveTextContent('일정을 저장하지 못했습니다.');
  });
});
