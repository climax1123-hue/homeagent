# app-shell - Implementation Record

> Date: 2026-08-26 | Status: Do Complete  
> Design: `docs/02-design/features/app-shell.design.md`

## 1. Implemented Scope

- `/app` 공통 중첩 레이아웃과 Outlet 기반 라우팅
- 역할 필터를 포함한 타입 안전 메뉴 설정
- 1024px 이상 데스크톱 사이드바
- 모바일·태블릿 하단 내비게이션과 더보기 메뉴
- 공통 헤더, 사용자 이메일 문맥, PC·모바일 로그아웃
- 대시보드 골격과 주요 기능 바로가기
- 일정, 가계부, 디데이, 목표 준비 중 화면
- App Shell 내부 404 화면
- CSS 의미 토큰과 320px 이상 모바일 우선 반응형 스타일
- Safe Area, 44px 터치 영역, focus-visible, reduced-motion 처리
- 관리자 전용 구성원 관리 메뉴와 기존 Route Guard 유지

## 2. Changed Files

- `apps/web/src/features/app-shell/app-navigation.ts`
- `apps/web/src/features/app-shell/AppShell.tsx`
- `apps/web/src/features/app-shell/app-shell.css`
- `apps/web/src/features/app-shell/AppShell.test.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/features/auth/auth.tsx`
- `apps/web/src/styles/global.css`

## 3. Route Results

| Route | Result |
|---|---|
| `/app` | Dashboard |
| `/app/calendar` | 일정 준비 중 |
| `/app/ledger` | 가계부 준비 중 |
| `/app/ddays` | 디데이 준비 중 |
| `/app/goals` | 목표 준비 중 |
| `/app/settings` | 기존 가구 설정 |
| `/app/members` | 기존 관리자 구성원 관리 |
| unknown `/app/*` | Shell 내부 404 |

## 4. Verification

- TypeScript: 통과
- ESLint: 오류 0, 기존 `auth.tsx` Fast Refresh 경고 6개
- 신규 App Shell 테스트: 통과
- 전체 테스트: 최초 실행에서 14개 모두 통과. 이후 전체 재검증에서는 시스템 실행 지연으로 기존 household 테스트 3개가 5초 timeout을 초과했으며 assertion 실패는 없었음
- Production build: 통과, 81 modules transformed
- `git diff --check`: 오류 없음, 기존 파일의 CRLF 변환 경고만 존재
- 브라우저 console error: 없음

## 5. Visual Verification Limitation

로컬 Vite 프로세스가 프로젝트 루트의 Supabase 환경 변수를 읽지 못해 브라우저에서는 `환경 설정 필요` 화면까지만 확인했다. 390×844 및 1440×900 viewport에서 설정 안내 화면의 실행과 console 오류 부재를 확인했으나, 인증 후 App Shell의 실제 시각 검증은 Supabase 환경 변수를 웹 앱 실행 위치에 연결한 뒤 Check 단계에서 다시 수행한다.

## 6. Deferred Items for Check/Iterate

- 인증 세션 상태에서 PC·모바일 실제 App Shell 스크린 확인
- More menu 닫힘 후 트리거로 포커스 복귀 세부 확인
- 기존 household 페이지의 `main` landmark 중첩 여부 정리
- 온라인 UI 레퍼런스 선정 후 시각 토큰 개선
- 시스템이 안정된 상태에서 전체 테스트 timeout 재확인

## 7. Next Phase

설계와 구현의 일치 여부는 `$pdca analyze app-shell`에서 항목별로 검증한다.
