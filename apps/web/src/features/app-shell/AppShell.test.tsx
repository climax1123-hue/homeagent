import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppNotFoundPage, AppShell, ComingSoonPage, DashboardPage } from './AppShell';
import { pageTitleFor, visibleNavigation } from './app-navigation';

const authMocks = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock('../auth/auth', () => ({
  useAuth: () => ({
    client: { auth: { signOut: authMocks.signOut } },
    user: { email: 'admin@example.test' },
  }),
  useAccess: () => ({
    access: { kind: 'active', householdId: 'household-test', role: 'admin' },
  }),
}));

function renderShell(initialEntry = '/app') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<p>로그인 화면</p>} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route
            path="calendar"
            element={<ComingSoonPage description="일정 준비 안내" feature="일정" />}
          />
          <Route path="*" element={<AppNotFoundPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authMocks.signOut.mockReset();
  authMocks.signOut.mockResolvedValue({ error: null });
});

describe('app navigation', () => {
  it('shows member management only to admins', () => {
    expect(visibleNavigation('admin').map((item) => item.id)).toContain('members');
    expect(visibleNavigation('member').map((item) => item.id)).not.toContain('members');
  });

  it('resolves exact home and nested page titles', () => {
    expect(pageTitleFor('/app')).toBe('홈');
    expect(pageTitleFor('/app/calendar')).toBe('일정');
    expect(pageTitleFor('/app/settings/profile')).toBe('가구 설정');
    expect(pageTitleFor('/app/unknown')).toBe('페이지를 찾을 수 없음');
  });

  it('keeps four primary mobile destinations', () => {
    expect(visibleNavigation('member').filter((item) => item.placement === 'primary')).toHaveLength(
      4,
    );
  });

  it('opens more, closes with Escape, and restores trigger focus', async () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: '더보기' });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: '더보기 메뉴' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /디데이/ })).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog', { name: '더보기 메뉴' })).not.toBeInTheDocument();
  });

  it('logs out locally and navigates to login', async () => {
    renderShell();
    fireEvent.click(screen.getAllByRole('button', { name: '로그아웃' })[0]);

    await waitFor(() => expect(screen.getByText('로그인 화면')).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the current page and shows a safe error when logout fails', async () => {
    authMocks.signOut.mockResolvedValue({ error: new Error('provider details') });
    renderShell();
    fireEvent.click(screen.getAllByRole('button', { name: '로그아웃' })[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('로그아웃하지 못했습니다');
    expect(screen.getByText('가족의 오늘을 한곳에서')).toBeInTheDocument();
  });

  it('renders coming-soon and app-local not-found routes', () => {
    const { unmount } = renderShell('/app/calendar');
    expect(screen.getByRole('heading', { name: '일정', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('일정 준비 안내')).toBeInTheDocument();
    unmount();

    renderShell('/app/does-not-exist');
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument();
  });
});
