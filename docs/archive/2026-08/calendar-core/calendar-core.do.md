# calendar-core 구현 기록

## 구현 결과

- 월간·주간·목록 보기와 기간 이동, 오늘 이동을 구현했다.
- 일반 일정과 종일 일정의 등록·조회·수정·삭제를 구현했다.
- 가족 공유/개인 공개 범위와 소유자·관리자 권한을 RLS로 강제했다.
- 매일·매주·매월·매년 반복, 반복 간격, 종료일/횟수를 지원한다.
- DB에는 UTC로 저장하고 화면과 입력은 `Asia/Seoul` 기준으로 처리한다.
- PC와 모바일에서 사용할 수 있는 반응형 일정 화면과 44px 이상 터치 영역을 적용했다.

## 주요 산출물

- DB: `supabase/migrations/20260826060000_create_calendar_core.sql`
- RLS 테스트: `supabase/tests/calendar-security.test.sql`
- 공용 타입/검증: `packages/shared/src/calendar.ts`
- 화면/API/날짜 처리: `apps/web/src/features/calendar/`
- 앱 연결: `apps/web/src/App.tsx`

## 검증

- `pnpm check`: 통과
- 웹 및 패키지 테스트: 모두 통과
- 프로덕션 빌드: 통과
- Supabase 원격 마이그레이션: 적용 완료

## 후속 범위

Google Calendar 동기화와 웹 푸시 알림은 자격 증명·토큰 보관 및 별도 실패 복구 정책이 필요하므로 후속 기능으로 분리한다.
