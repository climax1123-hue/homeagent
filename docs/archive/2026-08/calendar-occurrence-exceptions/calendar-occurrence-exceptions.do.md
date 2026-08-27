# calendar-occurrence-exceptions Implementation Guide

> **Summary**: 반복 일정 회차별 예외와 일정 시작 전 알림을 구현했다.
>
> **Project**: HomeWebSite
> **Author**: Codex
> **Date**: 2026-08-26
> **Status**: Complete
> **Design Doc**: [calendar-occurrence-exceptions.design.md](calendar-occurrence-exceptions.design.md)

## 1. Implementation Result

| Area | Result | Status |
|---|---|:---:|
| Data | `calendar_event_exceptions`, event reminder uniqueness and scope validation | 완료 |
| Security | 원본 일정 공개범위와 동일한 RLS, 식별자 보호 trigger | 완료 |
| Domain | 취소·수정 예외를 반영하는 occurrence 확장 | 완료 |
| UI | 이번만 수정·삭제·복구, 전체 수정·삭제, 시작 전 알림 선택 | 완료 |
| Worker | 반복 회차와 예외를 반영한 Web Push 발송 | 완료 |

## 2. Key Files

- `supabase/migrations/20260826130000_create_calendar_occurrence_exceptions.sql`
- `supabase/migrations/20260826140000_validate_event_reminder_scope.sql`
- `apps/web/src/features/calendar/calendar-dates.ts`
- `apps/web/src/features/calendar/api/calendar-api.ts`
- `apps/web/src/features/calendar/api/notification-api.ts`
- `apps/web/src/features/calendar/CalendarContainer.tsx`
- `apps/web/src/features/calendar/CalendarPage.tsx`
- `supabase/functions/dispatch-calendar-notifications/index.ts`

## 3. Verification

- `pnpm check`: 통과(웹 27, 공용 4, 명세 파서 1 테스트)
- calendar occurrence RLS pgTAP: 12/12 통과
- calendar notification RLS pgTAP: 13/13 통과
- Supabase cloud migration: `20260826140000`까지 적용
- notification cron latest status: `succeeded`

## 4. Operational Note

인앱 브라우저 자동 점검은 로컬 URL 보안 정책에 막혀 실행하지 못했다. 대신 반응형 CSS breakpoint, 44px 터치 영역, 컴포넌트 빌드 및 데이터·권한 회귀검사로 확인했다.

