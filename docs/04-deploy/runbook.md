# 운영 Runbook

## 장애 확인 순서

1. Vercel 배포 상태와 브라우저 콘솔 오류 확인
2. Supabase 프로젝트 상태, Edge Function 로그, DB migration 상태 확인
3. 로그인 문제는 Auth URL Configuration과 이메일 확인 상태 점검
4. Google 연동 문제는 callback query code와 Edge Function 로그 확인
5. 권한 문제는 `household_members` 상태와 RLS 정책 확인

## 가족 사용자 지원

- 사용자는 반드시 본인 이메일 계정으로 로그인한다.
- 초대 이메일과 가입 이메일이 같아야 한다.
- 접근이 막히면 현재 로그인 이메일과 구성원 상태를 확인한다.
- 금융 명세서 원본은 앱 저장소나 지원 채널로 전달하지 않는다.

## 운영 원칙

- 배포 전 `pnpm check` 통과
- migration은 추가만 하고 기존 파일을 수정하지 않음
- 실제 가족 데이터로 테스트 fixture를 만들지 않음
- 장애 수정 후 주요 PC/모바일 경로 smoke test
