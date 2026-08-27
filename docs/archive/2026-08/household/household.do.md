# household - Do Tracking

> Date: 2026-08-26 | Status: Completed  
> Design: docs/02-design/features/household.design.md

## 1. Implemented

### Database and authorization

- households, household_members, household_invitations, audit_logs
- household 역할·구성원 상태·초대 상태 enum
- 사용자당 하나의 현재 household와 동일 household membership 중복 제약
- 초대 이메일 정규화, 7일 만료와 256-bit token hash 저장
- active member/admin 확인용 private security-definer helper
- 모든 public household 테이블 RLS와 최소 table grant
- 최초 가정 bootstrap, access context, 초대 생성·수락·취소 RPC
- 구성원 정지·재활성화·탈퇴 및 본인 표시 이름 RPC
- mutation transaction 안의 append-only 감사 로그

Migration: supabase/migrations/20260826030000_create_household_domain.sql

### Edge Function

- 인증 사용자를 다시 확인한 뒤 service-only 초대 RPC 호출
- 초대 원문 token을 브라우저에 반환하지 않고 이메일 링크에만 사용
- 허용 origin CORS, 입력 검증과 안전한 domain error 응답
- Resend adapter를 통한 초대 메일 전송
- 전송 성공·실패 기록, 실패 시 초대 자동 취소

Function: supabase/functions/create-household-invitation/index.ts

### Web and shared code

- household, member, invitation과 access context 공유 타입
- 안전한 domain error 메시지와 이메일 마스킹
- Supabase query/RPC/Edge Function API adapter
- 데이터 loading·refresh container
- PC table/card와 모바일 card형 구성원·초대 관리 UI
- 정지·탈퇴 확인 dialog, 중복 제출 방지와 상태 안내
- 표시 이름을 입력하는 초대 수락 UI
- 모든 주요 action의 최소 44px 터치 영역

## 2. Deployment

- 연결된 Supabase project에 household migration 적용 완료
- create-household-invitation Edge Function 배포 완료
- 자동 생성 타입 조회로 원격 테이블, enum과 RPC 노출 확인

다음 운영 secret은 실제 웹 주소와 메일 공급자 계정이 정해진 뒤 설정한다.

- APP_URL
- ALLOWED_ORIGINS
- RESEND_API_KEY
- INVITATION_FROM_EMAIL

secret 미설정 상태에서는 초대 함수가 안전한 서버 오류를 반환하며 token이나 내부
설정을 노출하지 않는다.

## 3. Verification

- shared tests: 4 passed
- web tests: 7 passed
- Supabase Dashboard pgTAP: 22 passed
- pgTAP 후 households row count 0으로 transaction rollback 확인
- Edge Function cloud deployment/bundle validation passed
- remote schema TypeScript generation passed
- pnpm check: passed

pgTAP은 supabase/tests/household-security.test.sql에 저장했다. 현재 PC에서는 Supabase
CLI test runner가 Docker engine을 요구하므로 Dashboard에서 동일 파일을 실행했다.
Docker가 정상화되면 CLI test를 CI에도 연결한다.

## 4. Integration Boundary

household 구현은 auth가 제공할 Supabase session, current user ID와 route guard를
받아 동작하도록 구성했다. 실제 앱 route에 container와 초대 수락 화면을 연결하는
작업은 auth Do에서 수행한다. household DB와 RLS는 auth UI와 독립적으로
배포·검증되어 있다.
