import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PrivacyPage, PublicHomePage } from './PublicPages';

describe('public pages', () => {
  it('describes the family service without authentication', () => {
    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /가족의 일상과 살림/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login');
  });

  it('discloses Google Calendar data usage', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '개인정보처리방침' })).toBeInTheDocument();
    expect(screen.getByText(/Google OAuth 갱신 토큰은 서버에서 암호화/)).toBeInTheDocument();
  });
});
