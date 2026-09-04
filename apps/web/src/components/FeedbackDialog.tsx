import { useEffect } from 'react';
import './feedback-dialog.css';

export type Feedback = { type: 'success' | 'error'; message: string };

export function FeedbackDialog({
  feedback,
  onClose,
}: {
  feedback: Feedback | null;
  onClose(): void;
}) {
  useEffect(() => {
    if (!feedback) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [feedback, onClose]);

  if (!feedback) return null;
  const isError = feedback.type === 'error';
  return (
    <div className="feedback-backdrop" role="presentation">
      <section
        aria-labelledby="feedback-title"
        aria-describedby="feedback-message"
        className={`feedback-dialog feedback-dialog--${feedback.type}`}
        role={isError ? 'alertdialog' : 'dialog'}
      >
        <span className="feedback-icon" aria-hidden="true">
          {isError ? '!' : '✓'}
        </span>
        <h2 id="feedback-title">{isError ? '처리하지 못했습니다' : '처리 완료'}</h2>
        <p id="feedback-message">{feedback.message}</p>
        <button autoFocus onClick={onClose}>
          확인
        </button>
      </section>
    </div>
  );
}
