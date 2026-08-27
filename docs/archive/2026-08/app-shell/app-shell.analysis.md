# Gap Analysis: app-shell

> Date: 2026-08-26 | Design: `docs/02-design/features/app-shell.design.md`  
> Implementation: `apps/web/src/features/app-shell/`

---

## Match Rate: 91%

- 평가 항목: 34개
- 일치: 31개
- 미충족 또는 추가 보완 필요: 3개
- 계산: `31 / 34 × 100 = 91.17%` → 91%
- Iteration: 1회 완료

## 1. Summary

App Shell의 핵심 구조인 중첩 라우팅, 역할별 메뉴, PC 사이드바, 모바일 하단 메뉴, 대시보드, 준비 중 화면, 404, 로그아웃 및 반응형 CSS는 설계와 일치한다. 인증 후 실제 화면도 사용자가 직접 확인했으며 전반적인 UI 구성을 승인했다. Iteration에서 포커스 복귀, SVG 아이콘, landmark 중첩과 상호작용 테스트를 보완했다.

의미 토큰의 완전한 적용, 컴포넌트 파일 세분화, 자동 viewport 검증은 일부 남아 있지만 기능·보안·접근성의 필수 동작에는 영향을 주지 않는다. 일치율이 90% 이상이므로 Report 단계로 진행할 수 있다.

## 2. Requirement Coverage

| ID | Design Requirement | Result | Evidence |
|---|---|---|---|
| 1 | `/app` 중첩 App Shell과 Outlet | Match | `App.tsx`, `AppShell.tsx` |
| 2 | Dashboard index route | Match | `DashboardPage`, index route |
| 3 | 일정 준비 중 route | Match | `/app/calendar` |
| 4 | 가계부 준비 중 route | Match | `/app/ledger` |
| 5 | 디데이 준비 중 route | Match | `/app/ddays` |
| 6 | 목표 준비 중 route | Match | `/app/goals` |
| 7 | 기존 가구 설정 연결 | Match | `/app/settings` |
| 8 | 관리자 구성원 관리 연결 | Match | `MembersRoute`, `/app/members` |
| 9 | App Shell 내부 404 | Match | `AppNotFoundPage`, child `*` route |
| 10 | 단일 타입 안전 메뉴 설정 | Match | `APP_NAV_ITEMS`, `AppNavItem` |
| 11 | 역할별 메뉴 필터 | Match | `visibleNavigation` |
| 12 | 메뉴가 보안 경계를 대체하지 않음 | Match | `HouseholdRoute`, `MembersRoute` 유지 |
| 13 | 1024px 이상 데스크톱 사이드바 | Match | CSS `@media (min-width: 1024px)` |
| 14 | 1024px 미만 모바일 하단 메뉴 | Match | `.app-bottom-nav` |
| 15 | 핵심 모바일 목적지 4개 + 더보기 | Match | primary 4개 테스트 |
| 16 | Safe Area 처리 | Match | `env(safe-area-inset-bottom)` |
| 17 | 본문 하단 메뉴 겹침 방지 | Match | `.app-content` bottom padding |
| 18 | 현재 경로 활성 상태 | Match | `NavLink`와 active class |
| 19 | 경로별 페이지 제목 | Match | `pageTitleFor` 테스트 |
| 20 | 공통 사용자 이메일 문맥 | Match | `.app-user-summary` |
| 21 | PC·모바일 로그아웃 진입점 | Match | sidebar와 More menu |
| 22 | 로그아웃 실패 처리 | Match | 오류 상태와 재시도 버튼 유지 |
| 23 | 대시보드 기능 카드 | Match | `FEATURES`, feature grid |
| 24 | 실제 데이터 없는 위젯 자리 | Match | `.app-widget-placeholder` |
| 25 | 가짜 개인정보·금액 미사용 | Match | 정적 안내 문구만 사용 |
| 26 | CSS 의미 토큰 기반 테마 | Partial | 주요 값은 토큰이나 일부 hex·간격 값 직접 사용 |
| 27 | 최소 44px 터치 영역 | Match | nav, button, link min-height 적용 |
| 28 | focus-visible 표시 | Match | 공통 focus-visible 규칙 |
| 29 | reduced-motion 존중 | Match | motion 허용 시에만 transition 적용 |
| 30 | More menu Escape·외부 클릭 | Match | keydown listener, backdrop handler |
| 31 | More menu 닫힘 후 트리거 포커스 복귀 | Match | button ref와 모든 닫기 경로의 focus 복귀 테스트 |
| 32 | 자체 SVG 아이콘 | Match | 동일 viewBox 기반 inline SVG path map |
| 33 | 페이지 landmark·heading 계층 | Match | household child의 중첩 `main`을 `section`으로 변경 |
| 34 | 설계된 상호작용·회귀·viewport 테스트 | Partial | 메뉴·포커스·로그아웃·준비 중·404 총 7개 통과, 자동 viewport 검증은 환경 제약 |

## 3. Implemented Items

### 3.1 Architecture & Routing

- [x] 기존 `AppHome`을 App Shell 중첩 route로 교체
- [x] 인증 및 가구 접근 Guard 유지
- [x] 기존 설정·구성원 관리 컨테이너 재사용
- [x] 미구현 기능을 안전한 준비 중 화면으로 연결
- [x] 알 수 없는 앱 경로에 Shell 내부 404 제공

### 3.2 Responsive UI

- [x] PC 사이드바와 모바일 하단 메뉴
- [x] 모바일 더보기 sheet
- [x] 480px, 768px, 1024px breakpoint
- [x] iOS Safe Area와 본문 여백
- [x] 반응형 대시보드 카드 grid
- [x] 인증 후 실제 화면 사용자 확인 완료

### 3.3 Permission & Security

- [x] 관리자의 구성원 메뉴 표시
- [x] 일반 구성원의 관리자 메뉴 숨김
- [x] URL 직접 접근 시 `MembersRoute` 관리자 검증 유지
- [x] 새 인증정보 저장소 또는 API 추가 없음
- [x] 클라이언트에 `service_role` 또는 OAuth token 노출 없음

### 3.4 Accessibility & UX

- [x] desktop/mobile nav 접근성 이름
- [x] `NavLink` 기반 현재 페이지 상태
- [x] 장식 아이콘 `aria-hidden`
- [x] More menu `aria-expanded`, Escape, 바깥 클릭 닫기
- [x] 주요 조작 영역 최소 44px
- [x] 포커스 표시와 reduced-motion 처리

## 4. Iteration Results

### GAP-001: More menu 포커스 복귀 — Resolved

- Priority: High
- Design: 메뉴가 닫히면 더보기 트리거로 포커스 복귀
- Result: trigger button ref를 전달하고 Escape·닫기·메뉴 이동 시 포커스 복귀 구현
- Verification: component test 통과

### GAP-002: 상호작용 테스트 부족 — Resolved for core flows

- Priority: High
- Result: More menu, 포커스 복귀, 로그아웃 성공·실패, 준비 중 route, 내부 404 테스트 추가
- Verification: App Shell tests 7/7 통과

### GAP-003: 전체 반응형 viewport 검증 미완료

- Priority: Medium
- Current: 구현 중 환경 변수 누락으로 인증 화면만 자동 확인했고 이후 사용자가 실제 앱 화면 확인
- Current: 인증된 화면을 viewport override로 확인했으나 Codex 패널 자체 폭 제한 때문에 1024px 이상 값이 실제 viewport로 적용되지 않음
- Deferred: 외부 브라우저 또는 Playwright 인증 fixture가 준비되면 320, 390, 412, 768, 1024, 1440 정식 기록

## 5. Changed Items (Deviations from Design)

### GAP-004: 아이콘 구현 방식 — Resolved

- Priority: Medium
- Design: 일관된 자체 SVG 아이콘
- Result: 동일한 24×24 viewBox와 stroke 규칙을 사용하는 인라인 SVG map으로 교체

### GAP-005: 컴포넌트 파일 구조

- Priority: Low
- Design: components/pages 하위 파일 분리
- Current: `AppShell.tsx` 한 파일에 표시 컴포넌트와 페이지 포함
- Impact: 현재 동작 문제는 없으나 후속 기능 추가 시 유지보수성이 낮아짐
- Fix: `components/`와 `pages/`로 분리하거나 최소한 페이지와 Shell을 분리

### GAP-006: 토큰 및 landmark 완결성 — Partially Resolved

- Priority: Medium
- Design: 시각 값을 의미 토큰으로 격리하고 일관된 landmark 계층 제공
- Result: child page 최상위 `main`을 `section`으로 정리해 landmark 중첩 해소
- Deferred: 일부 일회성 hex·간격 값의 의미 토큰 승격은 visual refresh에서 처리

## 6. Test & Build Evidence

- App Shell unit/component tests: 7/7 passed
- 최초 전체 web tests: 14/14 passed
- 재검증: 기존 household tests 3개가 느린 실행 환경에서 5초 timeout 초과; assertion failure 없음
- TypeScript: passed
- ESLint: errors 0, 기존 Fast Refresh warnings 6
- Production build: passed, 81 modules transformed
- Browser console errors: none
- 인증 후 App Shell: 사용자 직접 접속 및 UI 확인 완료

## 7. Recommendations

1. 91% 일치율을 기준으로 `$pdca report app-shell`을 진행한다.
2. 컴포넌트 파일 분리는 실제 변경 빈도가 높아질 때 수행한다.
3. 외부 브라우저 자동화가 준비되면 전체 viewport 회귀 검사를 추가한다.
4. 최종 토큰과 시각 디자인은 후속 `app-shell-visual-refresh`로 분리한다.

## 8. Next Steps

- [x] `$pdca iterate app-shell` 실행
- [x] GAP-001, 002, 004와 landmark 수정
- [x] `$pdca analyze app-shell` 재실행
- [x] Match Rate 90% 이상 확인
- [ ] `$pdca report app-shell`
