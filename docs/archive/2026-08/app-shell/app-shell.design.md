# app-shell - Design Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Design Complete  
> Level: Dynamic | Plan: `docs/01-plan/features/app-shell.plan.md`

---

## 1. Overview

### 1.1 Purpose

`/app` 아래의 모든 가족 업무 화면을 감싸는 반응형 App Shell의 기술 구조를 정의한다. 라우팅·권한·접근성 계약과 시각 스타일을 분리하여 후속 기능과 UI 리디자인이 서로 영향을 최소화하도록 한다.

### 1.2 Design Goals

- 기존 인증·가구 접근 제어 흐름을 유지하면서 공통 Shell을 도입한다.
- PC, 태블릿, iPhone, Android 브라우저에서 일관된 탐색 구조를 제공한다.
- 라우트와 역할별 메뉴 조건을 하나의 타입 안전한 설정으로 관리한다.
- 기능 페이지와 공통 레이아웃을 분리하여 독립적으로 개발한다.
- 온라인 레퍼런스를 선정한 뒤에도 업무 로직 변경 없이 테마와 표현 컴포넌트를 교체할 수 있게 한다.

### 1.3 Design Principles

1. **권한 우선**: 메뉴 숨김은 UX 처리이며 `HouseholdRoute`, 관리자 Route Guard, Supabase RLS가 실제 권한을 통제한다.
2. **모바일 우선**: 320px부터 설계하고 768px과 1024px에서 레이아웃을 확장한다.
3. **구조와 장식 분리**: 라우팅·랜드마크·포커스 순서는 안정 계약, 색상·폰트·모서리·그림자는 교체 가능한 토큰이다.
4. **점진적 확장**: 준비 중 화면을 실제 기능 페이지로 바꿀 때 Shell 코드는 수정하지 않는다.
5. **의존성 절제**: 초기 구현은 CSS와 자체 SVG 아이콘을 사용하고 대형 UI 프레임워크를 추가하지 않는다.

## 2. Architecture

### 2.1 Route Architecture

```text
BrowserRouter
└─ AuthProviders
   └─ AuthenticatedRoute
      └─ HouseholdRoute
         └─ AppShell (/app)
            ├─ DashboardPage (index)
            ├─ ComingSoonPage (/calendar)
            ├─ ComingSoonPage (/ledger)
            ├─ ComingSoonPage (/ddays)
            ├─ ComingSoonPage (/goals)
            ├─ HouseholdSettingsRoute (/settings)
            └─ MembersRoute (/members, admin only)
```

`AppHome`에 섞여 있는 레이아웃과 로그아웃 동작은 `AppShell`로 이동한다. `/app`의 index에는 `DashboardPage`를 배치하고, 자식 페이지는 `<Outlet />`에 렌더링한다.

### 2.2 Component Responsibilities

| Component | Responsibility | Data/Props |
|---|---|---|
| `AppShell` | 전체 grid, 공통 문맥 연결, Outlet 렌더링 | `useAuth`, `useAccess`, route meta |
| `DesktopSidebar` | 1024px 이상 주 메뉴, 활성 상태 | visible nav items |
| `AppHeader` | 현재 화면명, 가구/사용자 문맥, 모바일 더보기 진입 | title, user email, callbacks |
| `MobileBottomNav` | 모바일 핵심 4개 메뉴와 더보기 버튼 | primary nav items, pathname |
| `MoreMenu` | 디데이, 설정, 관리자 메뉴, 로그아웃 | open state, role, callbacks |
| `DashboardPage` | 인사말, 빠른 실행, 후속 위젯 자리 | active access, user |
| `FeatureCard` | 주요 기능 진입 카드 | label, description, path, status |
| `ComingSoonPage` | 미구현 기능의 안전한 안내 | feature label, description |
| `AppIcon` | 외부 라이브러리 없는 일관된 SVG 아이콘 | icon name, decorative flag |

### 2.3 Component Boundaries

- `features/app-shell`은 인증 API를 새로 만들지 않고 공개된 `useAuth`, `useAccess`를 사용한다.
- 디자인 시스템은 범용 `Button`과 향후 범용 토큰만 소유한다. 라우트와 가구 역할을 아는 컴포넌트는 웹 앱 내부에 둔다.
- 기존 `HouseholdSettingsContainer`, `HouseholdManagementContainer`는 변경 없이 Outlet 콘텐츠로 재사용한다.
- `MoreMenu`의 열림 상태만 Shell 로컬 상태로 관리한다. 전역 상태 라이브러리는 도입하지 않는다.

### 2.4 Data Flow

```text
Supabase session ──> AuthProviders/useAuth ──┐
                                             ├─> AppShell ─> visible navigation
Access Context ───> useAccess ───────────────┤             ├> household/user header
React Router ─────> location/matches ────────┘             └> Outlet page

logout click ─> client.auth.signOut(local) ─> /login
navigation click ─> React Router Link/NavLink ─> active state + Outlet update
```

### 2.5 Permission Rules

| Condition | Shell | Members menu | `/app/members` |
|---|---|---|---|
| Anonymous | Hidden | Hidden | Login redirect |
| Invited/Pending/Blocked | Hidden | Hidden | Access-status redirect |
| Active member | Visible | Hidden | `/app` redirect |
| Active admin | Visible | Visible | Allowed |

역할 변경으로 `access`가 갱신되면 메뉴는 즉시 다시 계산한다. 메뉴 설정에는 `roles?: ['admin']` 같은 표시 조건만 저장하며 보안 판단을 위임하지 않는다.

## 3. Navigation & Screen Design

### 3.1 Typed Navigation Model

```ts
type AppIconName = 'home' | 'calendar' | 'ledger' | 'dday' | 'goal' | 'settings' | 'members';
type AppRole = 'admin' | 'member';

type AppNavItem = {
  id: string;
  label: string;
  path: `/app${string}`;
  icon: AppIconName;
  placement: 'primary' | 'more';
  roles?: readonly AppRole[];
  end?: boolean;
};
```

`APP_NAV_ITEMS`를 유일한 메뉴 원본으로 사용한다. 데스크톱은 모든 허용 항목을 표시하고 모바일은 `primary` 항목과 `more` 항목을 분리한다. 타이틀은 현재 경로와 가장 구체적으로 일치하는 항목에서 구한다.

### 3.2 Desktop Layout (≥1024px)

```text
┌──────────────┬───────────────────────────────────────────┐
│ 우리집       │ Header: 페이지명        가구/사용자 메뉴 │
│              ├───────────────────────────────────────────┤
│ 홈           │                                           │
│ 일정         │              Outlet content               │
│ 가계부       │                                           │
│ 디데이       │                                           │
│ 목표         │                                           │
│ ───────────  │                                           │
│ 설정         │                                           │
│ 구성원(관리) │                                           │
└──────────────┴───────────────────────────────────────────┘
```

- 사이드바 너비: 토큰 기본값 248px
- 헤더 높이: 최소 64px
- 본문 최대 너비: 1280px, 페이지별로 좁은 폭 사용 가능
- 이번 버전에서는 사이드바 접기를 구현하지 않는다. 중간 너비는 모바일형 탐색을 사용한다.

### 3.3 Mobile/Tablet Layout (<1024px)

```text
┌──────────────────────────┐
│ Header: 페이지명   사용자│
├──────────────────────────┤
│                          │
│      Outlet content      │
│                          │
├──────────────────────────┤
│ 홈  일정  가계부  목표  더│
└──────────────────────────┘
```

- 하단 탭은 viewport에 고정하고 Safe Area를 포함한다.
- 본문 하단 padding은 탭 높이와 Safe Area의 합보다 커야 한다.
- `더보기`는 하단 sheet 또는 popover로 열리며 디데이·설정·관리자 메뉴·로그아웃을 제공한다.
- 열릴 때 `aria-expanded`, 연결된 메뉴 ID, Escape 닫기, 바깥 클릭 닫기를 지원한다.
- 768~1023px 태블릿도 같은 탐색을 사용하되 콘텐츠 grid 열 수만 늘린다.

### 3.4 Dashboard Initial State

대시보드는 실제 집계 API 없이 다음 요소만 제공한다.

1. 가족 공간 환영 문구
2. 일정·가계부·디데이·목표 바로가기 카드
3. 후속 데이터 위젯을 위한 영역 표시
4. 준비 중 기능은 카드와 도착 화면 양쪽에서 상태를 명확히 표시

가짜 금액·일정·개인정보는 표시하거나 fixture로 만들지 않는다.

### 3.5 Responsive Breakpoints

| Range | Navigation | Content grid | Notes |
|---|---|---|---|
| 320–479px | Bottom nav | 1 column | 최소 여백 16px |
| 480–767px | Bottom nav | 1–2 columns | 카드 최소 폭 유지 |
| 768–1023px | Bottom nav | 2 columns | 태블릿 콘텐츠 여백 확대 |
| ≥1024px | Sidebar | 2–4 columns | 최대 콘텐츠 폭 적용 |

브레이크포인트는 CSS custom property가 media query에서 직접 동작하지 않는 점을 고려해 CSS에 상수로 기록하고 문서와 테스트에서 동일 값을 사용한다.

## 4. Visual System & Future Redesign

### 4.1 Token Layers

`app-shell.css`의 `:root`에 의미 기반 CSS 변수를 둔다.

```css
:root {
  --app-color-bg: ...;
  --app-color-surface: ...;
  --app-color-text: ...;
  --app-color-muted: ...;
  --app-color-primary: ...;
  --app-color-border: ...;
  --app-space-page: ...;
  --app-radius-card: ...;
  --app-shadow-card: ...;
  --app-sidebar-width: 248px;
  --app-header-height: 64px;
  --app-bottom-nav-height: 64px;
}
```

컴포넌트는 hex 색상이나 임의의 그림자 값을 직접 사용하지 않고 의미 토큰을 참조한다. 따라서 레퍼런스 확정 후 토큰과 표현 CSS를 바꾸어 전체 분위기를 변경할 수 있다.

### 4.2 Stable vs Changeable Contract

| 개발 후 유지할 항목 | 자유롭게 변경 가능한 항목 |
|---|---|
| URL과 Route Guard | 색상 팔레트와 배경 |
| 메뉴의 정보 구조 | 폰트와 크기 비율 |
| 역할별 접근 규칙 | 카드 모서리·그림자·간격 |
| landmark와 포커스 순서 | 아이콘 스타일 |
| 44px 터치 영역 | 대시보드 카드 배치와 장식 |
| 모바일 핵심 기능 접근성 | 사이드바/헤더의 시각 표현 |

시각 레퍼런스 적용이 정보 구조까지 바꾸는 경우에는 `app-shell-visual-refresh`처럼 별도 PDCA로 영향 범위를 관리한다. 단순 토큰 변경은 동일 기능의 작은 개선으로 처리할 수 있다.

### 4.3 Reference Review Criteria

추후 온라인 레퍼런스를 고를 때 아래 기준으로 평가한다.

- 가족 공동 사용 서비스에 맞는 친근함과 정보 가독성
- PC와 모바일 양쪽의 실제 화면 사례 존재
- 한글 길이와 큰 글자에서도 깨지지 않는 구조
- iOS/Android 웹에서 44px 터치 영역 확보 가능 여부
- 색상 대비와 키보드 포커스 구현 가능 여부
- 특정 유료 UI 키트나 저작권 있는 자산에 종속되지 않는지

레퍼런스는 구조와 분위기를 참고하되 로고·아이콘·일러스트를 그대로 복제하지 않는다.

## 5. Data Model

### 5.1 Persistent Data

App Shell 자체의 새 DB 테이블, migration, Edge Function은 없다. 기존 `AccessContext`에서 다음 정보만 소비한다.

- `kind === 'active'`
- `householdId`
- `role: 'admin' | 'member'`
- 기존 사용자 세션의 email/id

### 5.2 Client-only State

| State | Owner | Persistence |
|---|---|---|
| More menu open | `AppShell` | None |
| Current route | React Router | URL |
| Active nav item | Derived from route | None |
| User/role | Auth/Access context | Existing session/API |

사용자별 테마나 사이드바 접힘 설정은 이번 범위에 포함하지 않는다.

## 6. API Specification

### 6.1 New APIs

새 REST/RPC/API는 추가하지 않는다.

### 6.2 Existing Contracts Used

- Supabase Auth session: 현재 사용자 식별과 로그아웃
- `createHouseholdApi(...).getAccessContext()`: 활성 가구와 역할 문맥
- 기존 가구 설정·구성원 관리 API: 해당 자식 페이지에서 그대로 사용

### 6.3 Error Handling

- 인증 또는 접근 문맥 로딩/실패는 기존 `AuthenticatedRoute`, `HouseholdRoute`, 접근 상태 UI가 처리한다.
- 로그아웃 실패 시 사용자를 즉시 로그인 화면으로 속이지 않고 오류 메시지와 재시도 수단을 제공한다.
- 알 수 없는 `/app/*` 경로는 앱 홈으로 숨기지 말고 App Shell 내부의 찾을 수 없음 화면으로 처리하는 것을 기본으로 한다.

## 7. File Structure

```text
apps/web/src/
├─ App.tsx
├─ features/
│  └─ app-shell/
│     ├─ app-navigation.ts
│     ├─ app-shell.css
│     ├─ AppShell.tsx
│     ├─ AppShell.test.tsx
│     ├─ components/
│     │  ├─ AppHeader.tsx
│     │  ├─ AppIcon.tsx
│     │  ├─ DesktopSidebar.tsx
│     │  ├─ FeatureCard.tsx
│     │  ├─ MobileBottomNav.tsx
│     │  └─ MoreMenu.tsx
│     └─ pages/
│        ├─ ComingSoonPage.tsx
│        ├─ DashboardPage.tsx
│        └─ NotFoundPage.tsx
└─ styles/
   └─ global.css
```

공통성이 실제로 확인되기 전에는 Shell 전용 컴포넌트를 `packages/design-system`으로 성급하게 이동하지 않는다. 기존 `Button`의 인라인 스타일은 시각 토큰 적용을 어렵게 하므로 필요한 범위에서 className/variant 확장 가능성을 검토한다.

## 8. Implementation Plan

1. `app-navigation.ts`에 타입과 단일 메뉴 설정을 만든다.
2. `AppIcon`, `DesktopSidebar`, `MobileBottomNav`, `MoreMenu`, `AppHeader`를 구현한다.
3. `AppShell`에서 접근 문맥, 활성 경로, 로그아웃, Outlet을 연결한다.
4. `DashboardPage`, `FeatureCard`, `ComingSoonPage`, `NotFoundPage`를 구현한다.
5. `App.tsx`의 `/app` 중첩 라우트를 새 Shell 구조로 변경한다.
6. `app-shell.css`에 토큰, 모바일 우선 스타일, 1024px 데스크톱 전환을 구현한다.
7. 기존 설정·구성원 페이지가 Shell 콘텐츠 영역에서 정상 동작하도록 CSS 충돌을 정리한다.
8. 단위·통합 테스트와 PC·모바일 시각 검증을 수행한다.
9. `pnpm check`를 실행하고 결과를 기록한다.

## 9. Test Plan

### 9.1 Unit/Component Tests

| ID | Scenario | Expected |
|---|---|---|
| SHELL-T-001 | admin role로 렌더링 | 구성원 관리 메뉴 표시 |
| SHELL-T-002 | member role로 렌더링 | 구성원 관리 메뉴 미표시 |
| SHELL-T-003 | 각 경로 진입 | 올바른 메뉴에 현재 상태 표시 |
| SHELL-T-004 | 더보기 열기/닫기 | aria 상태, Escape, 메뉴 동작 정상 |
| SHELL-T-005 | 로그아웃 성공 | local sign-out 후 `/login` 이동 |
| SHELL-T-006 | 로그아웃 실패 | 오류 표시 및 현재 화면 유지 |
| SHELL-T-007 | 미구현 기능 경로 | 해당 준비 중 화면 표시 |
| SHELL-T-008 | 알 수 없는 app 경로 | Shell 내부 404 표시 |

### 9.2 Regression Tests

- 비로그인 사용자의 `/app` 접근은 `/login`으로 이동한다.
- invited, pending, blocked 사용자는 기존 접근 상태 화면으로 이동한다.
- `/app/settings`는 활성 구성원에게 표시된다.
- `/app/members`는 관리자만 접근 가능하다.
- 기존 auth 및 household 테스트가 모두 통과한다.

### 9.3 Responsive & Visual Verification

| Viewport | Focus |
|---|---|
| 320×568 | 최소 폭, 하단 탭, 가로 넘침 |
| 390×844 | iPhone 계열 Safe Area와 더보기 |
| 412×915 | Android 계열 터치 영역 |
| 768×1024 | 태블릿 콘텐츠 grid |
| 1024×768 | 사이드바 전환 경계 |
| 1440×900 | 최대 콘텐츠 폭과 여백 |

Playwright 또는 브라우저 검사로 스크린샷을 확인하고, 모든 대화형 요소의 최소 44px, 키보드 탭 순서, 포커스 표시를 점검한다.

## 10. Accessibility Details

- 데스크톱과 모바일 내비게이션에 구분되는 `aria-label`을 제공한다.
- 현재 링크는 `NavLink`의 `aria-current="page"`를 사용한다.
- 장식용 SVG는 `aria-hidden="true"`, 텍스트 없는 버튼은 접근성 이름을 갖는다.
- More menu가 열리면 최초 항목으로 포커스를 보내고 닫을 때 트리거로 복귀한다.
- 애니메이션은 `prefers-reduced-motion`을 존중한다.
- heading level은 페이지마다 `h1` 하나를 기준으로 계층화한다.

## 11. Security Considerations

- `roles` 메뉴 필터는 서버 권한 검사의 대체가 아니다.
- `MembersRoute`의 관리자 검사와 공개 테이블 RLS를 유지한다.
- 사용자 이메일은 필요한 헤더/메뉴 문맥에만 표시하며 DOM이나 로그에 불필요하게 복제하지 않는다.
- 새 브라우저 저장소에 세션, 역할, OAuth 토큰을 저장하지 않는다.
- 외부 레퍼런스 적용 과정에서 원격 스크립트, 추적 코드, 불명확한 CDN 자산을 추가하지 않는다.

## 12. Acceptance Mapping

| Plan Requirement | Design Coverage |
|---|---|
| SHELL-FR-001–002 | Route architecture, permission rules |
| SHELL-FR-003–004 | Desktop/mobile layout |
| SHELL-FR-005 | Typed navigation, React Router URL state |
| SHELL-FR-006 | `AppHeader` responsibility |
| SHELL-FR-007–008 | Permission table, security considerations |
| SHELL-FR-009–010 | Dashboard and ComingSoon page |
| SHELL-FR-011 | AppShell logout flow and tests |
| SHELL-FR-012 | Persistent parent route with Outlet |

## 13. Deferred Decisions

다음 항목은 구조적 구현을 막지 않으므로 온라인 UI 레퍼런스를 검토한 후 결정할 수 있다.

- 최종 색상 팔레트, 폰트, 로고와 아이콘 스타일
- 카드의 그림자·테두리·모서리와 대시보드 장식
- 사이드바의 밝은/어두운 표현
- 더보기의 sheet 또는 popover 시각 표현
- 기능별 실제 데이터가 생긴 후 대시보드 위젯 우선순위

정보 구조나 메뉴 순서까지 변경하는 레퍼런스를 선택하면 구현 후 별도 개선 PDCA에서 라우팅·테스트 영향까지 함께 검토한다.
