# calendar-occurrence-exceptions - Design Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Approved | Level: Dynamic

## 1. Data Model

`calendar_event_exceptions`는 `event_id + original_starts_at`을 회차 식별자로 사용한다.

- `action`: `cancelled | override`
- override: title, description, location, starts_at, ends_at, all_day, color
- `household_id`와 `owner_user_id`는 원본 event에서 복사하며 변경 불가
- 원본 event 삭제 시 cascade
- override 시각은 원본 회차 기준 ±7일로 제한

`calendar_reminders`의 event형 행은 event당 사용자별 하나로 제한하는 partial unique index를 추가한다.

## 2. Security

- SELECT: 원본 event의 기존 공개범위 규칙과 동일
- INSERT/UPDATE/DELETE: 원본 작성자 또는 가족 공유 일정의 가구 관리자
- private event 관리자는 예외 접근 불가
- trigger가 event/household/owner 불일치를 거부

## 3. Domain Expansion

`expandOccurrences(events, exceptions, start, end)`:

1. 반복 원본을 range ±7일로 확장
2. `eventId/originalStart`로 exception lookup
3. cancelled 회차 제거
4. override 회차의 표시 필드를 적용
5. override 결과 시각으로 최종 range filter 및 정렬

Occurrence에 `originalStart`, `exceptionId`, `overridden`을 포함한다.

## 4. API

- `listExceptions(eventIds, rangeStart, rangeEnd)`
- `cancelOccurrence(event, originalStart)` upsert
- `overrideOccurrence(event, occurrence, input)` upsert
- `deleteException(id)`로 원본 회차 복구
- `upsertEventReminder(eventId, minutes | null)`

## 5. UI

- 반복 회차 상세: `이번만 수정`, `이번만 삭제`, `전체 수정`, `전체 삭제`
- 예외 회차: `원래대로 복구`
- 회차 수정 form은 반복 설정을 숨기고 제목·공개범위·시간·장소·설명·색상을 편집
- 일반/전체 일정 form에 시작 전 알림 select 추가
- 알림 없음 선택 시 기존 event reminder 삭제

## 6. Test Plan

- daily/weekly 회차 cancel, override, moved range, restore
- exception RLS: owner/admin/member/other household/private
- event reminder unique/RLS/upsert
- UI callback 구분 및 전체 regression
