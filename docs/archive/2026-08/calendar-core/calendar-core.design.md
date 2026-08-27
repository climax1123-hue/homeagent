# calendar-core - Design Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Design Complete  
> Level: Dynamic | Plan: `docs/01-plan/features/calendar-core.plan.md`

## 1. Overview

Supabase RLS로 격리된 일정 원장과 React 기반 월간·주간·목록 UI를 구현한다. 반복 규칙은 이번 범위에 필요한 명시적 필드로 저장하고 클라이언트 순수 함수가 선택 기간의 occurrence를 확장한다.

## 2. Architecture

```text
CalendarPage
├─ CalendarToolbar (view, previous, today, next, add)
├─ MonthView / WeekView / AgendaView
├─ EventDetailDialog
└─ EventFormDialog
       ↓
CalendarContainer (loading/error/mutation state)
       ↓
calendar-api.ts (Supabase query/mutation mapping)
       ↓
calendar_events + RLS
```

### 2.1 Responsibilities

| Module | Responsibility |
|---|---|
| `calendar.ts` shared | Event/input/recurrence types and validation constants |
| `calendar-dates.ts` | Seoul formatting, visible ranges, month grid, recurrence expansion |
| `calendar-api.ts` | DB row mapping, list/create/update/delete |
| `CalendarContainer` | data lifecycle and selected/form state |
| `CalendarPage` | accessible responsive presentation |

App Shell은 role과 household ID만 제공하고 일정 권한은 DB RLS가 최종 통제한다.

## 3. Data Model

### 3.1 `calendar_events`

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | PK, generated |
| `household_id` | uuid | FK households, required |
| `owner_user_id` | uuid | FK auth.users, defaults auth.uid through client input |
| `visibility` | enum | `family`, `private` |
| `title` | text | trimmed, 1–120 |
| `description` | text | trimmed, max 2000, default empty |
| `location` | text | trimmed, max 200, default empty |
| `starts_at` | timestamptz | UTC storage |
| `ends_at` | timestamptz | must be greater than starts_at |
| `all_day` | boolean | default false |
| `timezone` | text | MVP `Asia/Seoul` |
| `color` | text | fixed palette key |
| `recurrence_frequency` | enum nullable | daily/weekly/monthly/yearly |
| `recurrence_interval` | smallint | 1–30 |
| `recurrence_until` | date nullable | Seoul local occurrence date |
| `recurrence_count` | integer nullable | 1–999 |
| `created_at`, `updated_at` | timestamptz | audit timestamps |

Constraints prohibit setting both `recurrence_until` and `recurrence_count`; non-repeating events cannot carry recurrence end values. Indexes cover household/range, owner/range, and recurring rows.

### 3.2 Domain Types

```ts
type CalendarVisibility = 'family' | 'private';
type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CalendarView = 'month' | 'week' | 'agenda';

type CalendarEvent = {
  id: string;
  householdId: string;
  ownerUserId: string;
  visibility: CalendarVisibility;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: 'Asia/Seoul';
  color: CalendarColor;
  recurrence: Recurrence | null;
  createdAt: string;
  updatedAt: string;
};
```

Occurrence는 event 원본 ID, occurrence 시작·종료, 반복 여부를 가진 계산 결과이며 DB row를 추가하지 않는다.

## 4. Security & RLS

### 4.1 SELECT

```text
active member of row.household_id
AND (visibility = family OR owner_user_id = auth.uid())
```

### 4.2 INSERT

```text
owner_user_id = auth.uid()
AND active member of household_id
```

### 4.3 UPDATE / DELETE

```text
owner_user_id = auth.uid()
OR (visibility = family AND active admin of household_id)
```

UPDATE의 `WITH CHECK`는 owner와 household를 다른 값으로 바꾸지 못하도록 기존 row 기반 RPC 없이 RLS 조건과 owner 고정 trigger로 보호한다. 일정 mutation 권한은 authenticated에만 부여하며 anon은 모든 권한이 없다.

## 5. API Specification

### 5.1 Client API

```ts
listEvents(householdId, rangeStart, rangeEnd): Promise<CalendarEvent[]>
createEvent(input): Promise<CalendarEvent>
updateEvent(eventId, input): Promise<CalendarEvent>
deleteEvent(eventId): Promise<void>
```

`listEvents`는 range 종료 이전에 시작하고, 단일 일정은 range 시작 이후에 끝나며 반복 일정은 종료 규칙상 range와 겹칠 수 있는 row를 가져온다. RLS가 private row를 사전에 제거한다.

### 5.2 Validation

- UI와 shared utility가 필수/길이/날짜를 먼저 검증한다.
- DB constraint가 동일 규칙을 최종 강제한다.
- API 오류는 상세 DB 문구를 노출하지 않고 안전한 한국어 메시지로 매핑한다.

## 6. Recurrence Algorithm

1. 원본 시작/종료 duration을 보존한다.
2. 선택 range 이전 occurrence는 건너뛰되 무한 반복에는 최대 iteration guard를 둔다.
3. daily는 N일, weekly는 N주 같은 요일, monthly는 N개월 같은 일자, yearly는 N년 같은 월/일로 이동한다.
4. 존재하지 않는 월말 날짜는 해당 월의 마지막 날짜로 clamp한다.
5. `recurrence_count` 또는 `recurrence_until`을 넘으면 종료한다.
6. 표시 range와 겹치는 occurrence만 반환한다.
7. 결과는 시작 시각, 제목 순으로 정렬한다.

이번 범위에서는 복수 요일과 특정 occurrence 예외를 지원하지 않는다.

## 7. UI Design

### 7.1 Toolbar

- 이전, 오늘, 다음
- 현재 기간 label
- 월간, 주간, 목록 segmented control
- `일정 추가` primary action

### 7.2 Month View

- 일요일 시작 6주 grid
- 오늘, 다른 달 날짜, 선택 날짜 구분
- cell에 최대 3개 일정 표시 후 `+N개` 제공
- 모바일은 cell을 선택하면 아래 선택 날짜 목록을 표시

### 7.3 Week / Agenda

- Week: 7개 날짜 column/card와 해당 날짜 일정
- Agenda: 선택 기간 occurrence를 날짜별 그룹화
- 종일, 개인, 반복 상태를 text/badge로 함께 표시

### 7.4 Form

- 제목, 공개 범위, 종일, 시작/종료, 설명, 장소, 색상
- 반복 frequency, interval, 종료 방식/값
- create와 edit에서 동일 form 재사용
- native `dialog` 대신 접근 가능한 overlay `role=dialog`, title 연결, Escape 닫기

## 8. File Structure

```text
packages/shared/src/calendar.ts
apps/web/src/features/calendar/
├─ api/calendar-api.ts
├─ calendar-dates.ts
├─ calendar-dates.test.ts
├─ calendar.css
├─ CalendarContainer.tsx
├─ CalendarPage.tsx
└─ CalendarPage.test.tsx
supabase/migrations/20260826060000_create_calendar_core.sql
supabase/tests/calendar-security.test.sql
```

## 9. Test Plan

### 9.1 Domain

- month grid has 42 days and correct boundary
- week range starts Sunday
- daily/weekly/monthly/yearly recurrence
- recurrence count/until and range clipping
- month-end clamp and duration preservation
- input validation and Seoul datetime conversion

### 9.2 UI/API

- view switching and period navigation
- empty/loading/error states
- create/edit/delete callback flows
- family/private and recurrence badges
- API row mapping and safe errors

### 9.3 DB Security

- RLS enabled and minimum grants
- active same-household member reads family event
- owner reads private event
- member cannot read another private event
- outsider and suspended member read nothing
- owner CRUD
- admin modifies family event but not private event
- member cannot modify another family event
- owner/household identity cannot be reassigned

## 10. Implementation Order

1. migration and RLS test
2. shared types and date/recurrence utility
3. Supabase API mapping
4. page/container and responsive CSS
5. route integration
6. unit/UI/build checks
7. cloud migration apply and authenticated smoke test

## 11. Acceptance Mapping

Plan `CAL-FR-001`–`006`은 RLS·constraints·CRUD API, `007`–`009`는 toolbar와 views, `010`–`011`은 recurrence fields와 expansion, `012`는 detail dialog와 badges로 검증한다.
