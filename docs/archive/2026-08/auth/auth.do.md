# auth - Do 기록

> Date: 2026-08-26 | Design: `auth.design.md`

## 구현 범위

- Supabase 이메일·비밀번호 가입, 로그인, 로그아웃과 브라우저 세션 복원
- `get_my_access_context()` 기반 접근 상태 조회 및 React Router 보호 경로
- 본인 소유 최소 `profiles` 테이블, 자동 생성 trigger, 최소 grant와 RLS
- 허용 이메일만 최초 가정을 생성하는 `bootstrap-admin` Edge Function
- active admin의 기존 household 구성원 관리 화면 연결

## 운영 설정 필요

- 웹: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_URL`
- Edge Function: `INITIAL_ADMIN_EMAIL`; Supabase 기본 URL/key secret은 플랫폼 제공값 사용
- Supabase Auth의 Confirm Email 활성화 및 Site/Redirect URL 등록

## 검증

- `pnpm check`
- cloud migration 및 Edge Function 배포 목록 확인
- pgTAP `supabase/tests/auth-profiles-rls.test.sql`

## 후속 Check

`$pdca analyze auth`에서 설계 대비 미구현 항목(실메일 E2E, 초대 토큰 callback 연결, 운영 URL)을 확인한다.
