export type AppRole = 'admin' | 'member';
export type AppIconName = 'home' | 'calendar' | 'ledger' | 'dday' | 'goal' | 'settings' | 'members';

export type AppNavItem = {
  id: string;
  label: string;
  path: `/app${string}`;
  icon: AppIconName;
  placement: 'primary' | 'more';
  roles?: readonly AppRole[];
  end?: boolean;
};

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  { id: 'home', label: '홈', path: '/app', icon: 'home', placement: 'primary', end: true },
  { id: 'calendar', label: '일정', path: '/app/calendar', icon: 'calendar', placement: 'primary' },
  { id: 'ledger', label: '가계부', path: '/app/ledger', icon: 'ledger', placement: 'primary' },
  { id: 'goals', label: '목표', path: '/app/goals', icon: 'goal', placement: 'primary' },
  { id: 'ddays', label: '디데이', path: '/app/ddays', icon: 'dday', placement: 'more' },
  {
    id: 'settings',
    label: '가구 설정',
    path: '/app/settings',
    icon: 'settings',
    placement: 'more',
  },
  {
    id: 'members',
    label: '구성원 관리',
    path: '/app/members',
    icon: 'members',
    placement: 'more',
    roles: ['admin'],
  },
];

export function visibleNavigation(role: AppRole) {
  return APP_NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

export function pageTitleFor(pathname: string) {
  return (
    [...APP_NAV_ITEMS]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => (item.end ? pathname === item.path : pathname.startsWith(item.path)))
      ?.label ?? '페이지를 찾을 수 없음'
  );
}
