import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAccess, useAuth } from '../auth/auth';
import {
  APP_NAV_ITEMS,
  pageTitleFor,
  type AppIconName,
  type AppNavItem,
  visibleNavigation,
} from './app-navigation';
import './app-shell.css';

const ICON_PATHS: Record<AppIconName, readonly string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5.5 9.5V21h13V9.5', 'M9 21v-7h6v7'],
  calendar: [
    'M5 3v3M19 3v3M3 9h18',
    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    'M7 13h3M14 13h3M7 17h3M14 17h3',
  ],
  ledger: ['M5 3h14v18H5z', 'M9 3v18M12 8h4M12 12h4M12 16h4'],
  dday: ['M5 4h5a7 7 0 0 1 0 14H5Z', 'M9 8v6h1a3 3 0 0 0 0-6Z'],
  goal: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
    'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  ],
  settings: [
    'M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12',
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  ],
  members: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  ],
};

function AppIcon({ name }: { name: AppIconName }) {
  return (
    <svg aria-hidden="true" className="app-icon" fill="none" viewBox="0 0 24 24">
      {ICON_PATHS[name].map((path) => (
        <path
          d={path}
          key={path}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ))}
    </svg>
  );
}

function NavigationLink({ item, onNavigate }: { item: AppNavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
      end={item.end}
      onClick={onNavigate}
      to={item.path}
    >
      <AppIcon name={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function DesktopSidebar({
  items,
  logoutError,
  onLogout,
}: {
  items: readonly AppNavItem[];
  logoutError: string;
  onLogout: () => void;
}) {
  return (
    <aside className="app-sidebar">
      <Link className="app-brand" to="/app" aria-label="우리집 홈">
        <span className="app-brand-mark" aria-hidden="true">
          우
        </span>
        <span>
          <strong>우리집</strong>
          <small>HOME OS</small>
        </span>
      </Link>
      <nav aria-label="데스크톱 주 메뉴" className="app-sidebar-nav">
        {items.map((item) => (
          <NavigationLink item={item} key={item.id} />
        ))}
      </nav>
      <div className="app-sidebar-footer">
        <button className="app-logout-button" onClick={onLogout}>
          로그아웃
        </button>
        {logoutError && (
          <p className="app-shell-error" role="alert">
            {logoutError}
          </p>
        )}
      </div>
    </aside>
  );
}

function MoreMenu({
  items,
  onClose,
  onLogout,
  logoutError,
}: {
  items: readonly AppNavItem[];
  onClose: () => void;
  onLogout: () => void;
  logoutError: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="app-more-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        aria-label="더보기 메뉴"
        className="app-more-menu"
        id="app-more-menu"
        ref={panelRef}
        role="dialog"
      >
        <div className="app-more-heading">
          <strong>더보기</strong>
          <button aria-label="더보기 닫기" onClick={onClose}>
            ×
          </button>
        </div>
        <nav aria-label="모바일 추가 메뉴">
          {items.map((item) => (
            <NavigationLink item={item} key={item.id} onNavigate={onClose} />
          ))}
        </nav>
        <button className="app-logout-button" onClick={onLogout}>
          로그아웃
        </button>
        {logoutError && (
          <p className="app-shell-error" role="alert">
            {logoutError}
          </p>
        )}
      </div>
    </div>
  );
}

function MobileBottomNav({
  buttonRef,
  items,
  moreOpen,
  onMore,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  items: readonly AppNavItem[];
  moreOpen: boolean;
  onMore: () => void;
}) {
  return (
    <nav aria-label="모바일 주 메뉴" className="app-bottom-nav">
      {items.map((item) => (
        <NavigationLink item={item} key={item.id} />
      ))}
      <button
        aria-controls="app-more-menu"
        aria-expanded={moreOpen}
        className="app-nav-link"
        onClick={onMore}
        ref={buttonRef}
      >
        <span aria-hidden="true" className="app-more-icon">
          •••
        </span>
        <span>더보기</span>
      </button>
    </nav>
  );
}

export function AppShell() {
  const { client, user } = useAuth();
  const { access } = useAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const active = access?.kind === 'active' ? access : null;
  const role = active?.role ?? 'member';
  const items = visibleNavigation(role);
  const primary = items.filter((item) => item.placement === 'primary');
  const more = items.filter((item) => item.placement === 'more');

  useEffect(() => setMoreOpen(false), [location.pathname]);

  const closeMore = () => {
    setMoreOpen(false);
    window.setTimeout(() => moreButtonRef.current?.focus(), 0);
  };

  const logout = async () => {
    setLogoutError('');
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) {
      setLogoutError('로그아웃하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-layout">
      <DesktopSidebar items={items} logoutError={logoutError} onLogout={() => void logout()} />
      <div className="app-main-column">
        <header className="app-header">
          <div>
            <p>우리집</p>
            <h1>{pageTitleFor(location.pathname)}</h1>
          </div>
          <div className="app-user-summary">
            <span aria-hidden="true">{user?.email?.slice(0, 1).toUpperCase() || '가'}</span>
            <small>{user?.email}</small>
          </div>
        </header>
        <main className="app-content" id="main-content">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav
        buttonRef={moreButtonRef}
        items={primary}
        moreOpen={moreOpen}
        onMore={() => setMoreOpen(true)}
      />
      {moreOpen && (
        <MoreMenu
          items={more}
          logoutError={logoutError}
          onClose={closeMore}
          onLogout={() => void logout()}
        />
      )}
    </div>
  );
}

const FEATURES = APP_NAV_ITEMS.filter((item) =>
  ['calendar', 'ledger', 'ddays', 'goals'].includes(item.id),
);

export function DashboardPage() {
  return (
    <section className="app-dashboard" aria-labelledby="dashboard-title">
      <div className="app-hero">
        <p className="app-eyebrow">FAMILY DASHBOARD</p>
        <h2 id="dashboard-title">가족의 오늘을 한곳에서</h2>
        <p>일정과 생활 기록을 함께 관리해 보세요.</p>
      </div>
      <div className="app-feature-grid">
        {FEATURES.map((item) => (
          <Link className="app-feature-card" key={item.id} to={item.path}>
            <AppIcon name={item.icon} />
            <span>
              <strong>{item.label}</strong>
              <small>기능 준비 중 · 화면 미리보기</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
      <section className="app-widget-placeholder">
        <div>
          <p className="app-eyebrow">COMING NEXT</p>
          <h3>우리집 요약</h3>
        </div>
        <p>기능별 데이터가 준비되면 다가오는 일정과 월간 가계 현황이 여기에 표시됩니다.</p>
      </section>
    </section>
  );
}

export function ComingSoonPage({ feature, description }: { feature: string; description: string }) {
  return (
    <section className="app-state-page">
      <span className="app-state-badge">준비 중</span>
      <h2>{feature}</h2>
      <p>{description}</p>
      <Link to="/app">홈으로 돌아가기</Link>
    </section>
  );
}

export function AppNotFoundPage() {
  return (
    <section className="app-state-page">
      <span className="app-state-badge">404</span>
      <h2>페이지를 찾을 수 없습니다</h2>
      <p>주소를 확인하거나 홈에서 다시 시작해 주세요.</p>
      <Link to="/app">홈으로 돌아가기</Link>
    </section>
  );
}
