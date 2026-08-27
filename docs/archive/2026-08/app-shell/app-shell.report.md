# Completion Report: app-shell

> Date: 2026-08-26 | Level: Dynamic | Status: Complete

---

## 1. Summary

### 1.1 Feature Overview

인증된 가족 구성원이 일정, 가계부, 디데이, 목표와 가구 관리 기능을 PC·태블릿·모바일에서 일관되게 탐색할 수 있는 공통 App Shell을 구현했다. 기존 인증·가구 권한 흐름은 유지하고, 후속 업무 기능이 독립적인 자식 route로 추가될 수 있는 구조를 마련했다.

### 1.2 Final Match Rate

**91%** (Target: 90%)

- 최초 분석: 82%
- Iterate 후: 91%
- 평가 결과: 34개 항목 중 31개 일치
- Report 진입 기준 충족

### 1.3 User Validation

사용자가 Supabase 이메일 인증과 관리자 로그인을 완료한 뒤 `/app` 화면에 직접 접속했다. 전체적인 기본 UI 구성에 대해 만족한다는 확인을 받았으며, 최종 시각 분위기는 실제 기능 데이터가 추가된 뒤 별도 검토하기로 했다.

## 2. Related Documents

- Plan: `docs/01-plan/features/app-shell.plan.md`
- Design: `docs/02-design/features/app-shell.design.md`
- Implementation record: `docs/02-design/features/app-shell.do.md`
- Gap analysis: `docs/03-analysis/app-shell.analysis.md`
- Source: `apps/web/src/features/app-shell/`

## 3. Completed Items

### 3.1 Functional

- [x] `/app` 공통 중첩 레이아웃과 Outlet
- [x] 반응형 홈 대시보드
- [x] PC 사이드바와 현재 메뉴 표시
- [x] 모바일 하단 메뉴와 더보기 sheet
- [x] 일정·가계부·디데이·목표 준비 중 화면
- [x] 가구 설정과 구성원 관리 화면 연결
- [x] 관리자 전용 구성원 관리 메뉴
- [x] PC·모바일 로그아웃과 실패 처리
- [x] App Shell 내부 404
- [x] 직접 URL과 새로고침이 가능한 React Router 구조

### 3.2 Responsive & Accessibility

- [x] 320px 이상 모바일 우선 스타일
- [x] 480px, 768px, 1024px breakpoint
- [x] iPhone Safe Area 하단 여백
- [x] 주요 터치 영역 최소 44px
- [x] desktop/mobile navigation 접근성 이름
- [x] 현재 링크의 `aria-current`
- [x] 더보기의 `aria-expanded`, Escape, 외부 클릭 닫기
- [x] 메뉴 종료 후 트리거 포커스 복귀
- [x] `focus-visible`과 `prefers-reduced-motion`
- [x] 중첩 `main` landmark 제거

### 3.3 Maintainability & Security

- [x] 타입 안전한 단일 메뉴 설정
- [x] 역할 필터와 실제 Route Guard 분리
- [x] 기존 `HouseholdRoute`, `MembersRoute`, Supabase RLS 유지
- [x] 동일 viewBox의 자체 SVG 아이콘
- [x] CSS 의미 토큰을 통한 재디자인 기반
- [x] 새 API, DB migration, 인증정보 저장소 추가 없음
- [x] `service_role`과 개인정보 fixture 미포함

## 4. Route Inventory

| Route | Screen | Access |
|---|---|---|
| `/app` | Dashboard | Active household member |
| `/app/calendar` | 일정 준비 중 | Active household member |
| `/app/ledger` | 가계부 준비 중 | Active household member |
| `/app/ddays` | 디데이 준비 중 | Active household member |
| `/app/goals` | 목표 준비 중 | Active household member |
| `/app/settings` | 가구 설정 | Active household member |
| `/app/members` | 구성원 관리 | Admin only |
| unknown `/app/*` | App-local 404 | Active household member |

## 5. Quality Metrics

| Metric | Result |
|---|---|
| Design match rate | 91% |
| PDCA iterate cycles | 1 implementation iteration, 2 analysis runs |
| App Shell automated tests | 7/7 passed |
| Related household tests | 5/5 passed with adjusted timeout |
| Initial full web test run | 14/14 passed |
| TypeScript | Passed |
| ESLint | 0 errors, existing Fast Refresh warnings 6 |
| Production build | Passed, 81 modules transformed |
| Browser console | No errors observed |
| Security boundary | Existing Route Guard and RLS preserved |
| User acceptance | Authenticated UI directly reviewed and accepted |

## 6. Deviations from Design

### 6.1 Component File Granularity

`AppShell`, 표시 컴포넌트와 임시 페이지가 현재 `AppShell.tsx`에 함께 있다. 기능 규모가 아직 작아 불필요한 파일 이동을 피했으며, 변경 빈도나 재사용성이 높아질 때 `components/`와 `pages/`로 분리한다.

### 6.2 Visual Tokens

핵심 색상과 레이아웃 값은 의미 토큰으로 분리했지만 일부 일회성 색상·간격 값은 CSS에 직접 남아 있다. 최종 UI 레퍼런스를 선정할 때 `app-shell-visual-refresh` 범위에서 토큰을 완성한다.

### 6.3 Automated Viewport Evidence

인증된 화면에 viewport override를 시도했지만 Codex 브라우저 패널 폭 제한 때문에 1024px 이상 실제 viewport 검증 결과를 신뢰할 수 없었다. CSS breakpoint 구현과 사용자 직접 화면 확인은 완료했으며, 외부 브라우저 또는 인증된 Playwright fixture가 준비되면 자동 회귀 검사로 보완한다.

## 7. Risks Closed

| Risk | Resolution |
|---|---|
| 기존 인증·가구 화면 회귀 | 기존 Guard·컨테이너 재사용, 관련 테스트 통과 |
| 모바일 메뉴 복잡도 | 핵심 목적지 4개와 더보기로 제한 |
| 미구현 메뉴 오해 | 카드와 도착 화면에 준비 중 상태 표시 |
| 역할 UI를 권한으로 오용 | 관리자 Route Guard와 RLS 유지 |
| iPhone 하단 메뉴 겹침 | Safe Area inset 및 본문 padding 적용 |
| OS별 아이콘 불일치 | 문자열 아이콘을 자체 SVG로 교체 |

## 8. Lessons Learned

### Keep

- 기능 단위 Plan → Design → Do → Analyze → Iterate 흐름
- 라우트·역할·표시 정보를 하나의 타입 설정에서 관리
- 실제 로그인과 사용자 직접 확인을 자동 테스트와 함께 사용
- 시각 디자인과 권한·라우팅 구조를 분리

### Problem

- 프로젝트 루트가 아닌 Vite 앱 위치에 `.env.local`이 필요해 초기 화면 검증이 지연됐다.
- 제한된 브라우저 패널에서는 데스크톱 viewport override 결과를 신뢰하기 어려웠다.
- 느린 로컬 실행 환경에서 기존 테스트의 기본 5초 timeout이 간헐적으로 부족했다.

### Try

- 다음 기능부터 구현 초기에 실행 환경과 인증 fixture를 함께 준비한다.
- 기능 페이지가 실제 데이터를 갖추면 Playwright 기반 모바일·PC 회귀 검사를 추가한다.
- 최종 UI 레퍼런스 선정 시 CSS 토큰만으로 변경 가능한 범위부터 적용한다.

## 9. Follow-up Items

- [ ] 외부 브라우저 기준 320, 390, 412, 768, 1024, 1440 viewport 회귀 검사
- [ ] 최종 UI 레퍼런스 선정 후 `app-shell-visual-refresh` 수행
- [ ] 변경 빈도가 높아지면 `AppShell.tsx`를 components/pages로 분리
- [ ] 기존 `auth.tsx` Fast Refresh 경고 정리
- [ ] 대시보드에 실제 일정·가계부 데이터 위젯 연결

위 항목은 App Shell의 현재 완료 조건을 막지 않으며 후속 기능 또는 별도 개선 PDCA에서 처리한다.

## 10. Next Steps

1. `$pdca archive app-shell`
2. 첫 번째 본 업무 기능으로 `$pdca plan calendar`
3. Calendar 완료 후 Ledger → D-day → Goals 순서로 기능 PDCA 진행
