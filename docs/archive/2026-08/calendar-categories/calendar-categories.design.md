# calendar-categories - Design Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Approved | Level: Dynamic

## 1. Architecture

`CalendarContainer`가 일정과 활성 가구 구성원을 병렬 조회해 `CalendarPage`에 전달한다. 페이지는 선택된 필터로 occurrence를 파생하고, 기존 RLS 결과만 필터링하므로 권한 범위를 확장하지 않는다.

## 2. UI Design

- 상단에 `전체`, `가족 공유`, `내 일정`, `개인 일정`, 각 구성원 버튼을 둔다.
- 활성 필터는 `aria-pressed`와 강조 배경으로 표시한다.
- 구성원은 결정적인 palette index를 가지며 범례 점과 일정 카드 좌측 선에 동일한 색을 쓴다.
- 일정 카드에는 시간, 제목, `등록자 · 가족/개인` 메타 정보를 표시한다.
- 상세 dialog에 등록자와 공개 범위를 표시하고 `Google Calendar에 추가` 링크를 둔다.

## 3. Data & API

- DB 변경 없음.
- `createHouseholdApi(client).listMembers(householdId)` 재사용.
- `HouseholdMember[]` 중 active 구성원을 화면에 전달한다.
- 필터 값: `all | family | mine | private | member:{userId}`.

## 4. Google Event Export

순수 함수 `createGoogleCalendarUrl(occurrence)`가 Google Calendar template URL을 만든다.

- 일반 일정: UTC compact datetime `YYYYMMDDTHHmmssZ`
- 종일 일정: 배타적 종료일을 유지한 `YYYYMMDD/YYYYMMDD`
- title, details, location, dates를 URL 인코딩
- 새 탭에서 열고 OAuth 토큰은 사용하지 않음
- 반복 occurrence는 현재 선택한 회차 1건만 전달

## 5. Files

- `apps/web/src/features/calendar/CalendarContainer.tsx`
- `apps/web/src/features/calendar/CalendarPage.tsx`
- `apps/web/src/features/calendar/calendar-filters.ts`
- `apps/web/src/features/calendar/calendar-filters.test.ts`
- `apps/web/src/features/calendar/calendar.css`

## 6. Test Plan

- 모든 필터 종류의 occurrence 결과
- 알 수 없는 구성원 fallback
- 일반/종일 Google Calendar URL
- 기존 캘린더 날짜·반복 테스트와 전체 `pnpm check`

## 7. Security

- service role 및 Google OAuth token을 클라이언트에 추가하지 않는다.
- 필터는 표현 계층일 뿐 권한 수단으로 사용하지 않는다.
- 구성원 조회는 기존 가구 RLS를 그대로 적용한다.
