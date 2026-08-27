# calendar-google-sync - Design Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Approved | Level: Dynamic

## 1. Architecture

```text
React client --JWT--> google-calendar-connect Edge Function
     |                         |
     |                    OAuth state(hash)
     |                         v
     +---- browser ----> Google OAuth ----> google-calendar-callback
                                              |
                                      encrypted refresh token
                                              v
                                      Supabase PostgreSQL

React client --JWT,eventId--> google-calendar-sync --> Google Calendar API
```

Edge Functions만 Google client secret, service role, token encryption key에 접근한다. 프런트는 연결 상태와 sync 결과만 받는다.

## 2. Data Model

### `google_calendar_connections`

- `user_id` PK/FK auth.users
- `household_id` FK households
- `google_account_email`, `google_calendar_id`
- `refresh_token_ciphertext`, `refresh_token_iv` (authenticated에 column grant 없음)
- `scope`, `status`, `connected_at`, `updated_at`

### `google_oauth_states`

- `state_hash` PK, `user_id`, `household_id`, `expires_at`, `consumed_at`
- service role 전용, 공개 grant 없음

### `calendar_google_event_links`

- `(event_id, user_id)` unique
- `google_event_id`, `google_calendar_id`, `sync_status`, `last_synced_at`, `last_error`
- 사용자는 자신의 link만 조회

## 3. Edge Functions

### `google-calendar-connect`

JWT 사용자와 active household membership을 확인하고 256-bit state를 만든다. hash만 저장하고 Google authorization URL을 반환한다.

### `google-calendar-callback`

state를 원자적으로 소비하고 authorization code를 token으로 교환한다. refresh token을 AES-GCM으로 암호화해 연결 정보를 upsert한 후 `/app/calendar?google=connected`로 redirect한다.

### `google-calendar-sync`

JWT 사용자 본인이 소유한 event만 허용한다. refresh token으로 access token을 받고 link가 없으면 `events.insert`, 있으면 `events.update`한다. Google event ID와 결과를 저장한다.

### `google-calendar-disconnect`

가능하면 Google token revoke를 시도한 뒤 로컬 연결과 link를 삭제한다.

## 4. Event Mapping

- title → summary, description → description, location → location
- 일반 일정 → `dateTime` + `Asia/Seoul`
- 종일 일정 → exclusive end `date`
- recurrence → RRULE `FREQ`, `INTERVAL`, `UNTIL` 또는 `COUNT`
- visibility는 Google calendar의 private event로 생성
- deterministic Google event ID 대신 DB link를 canonical mapping으로 사용

## 5. Client UI

- toolbar에 연결 상태 chip과 `Google 연결`/`연결 해제`
- 연결된 사용자는 자신이 만든 일정 상세에서 `Google과 동기화`
- 다른 사용자의 일정은 기존 단건 추가 링크만 제공
- 설정 누락·권한 취소·재인증 필요 오류를 한국어로 안내

## 6. Security

- OAuth refresh token과 client secret은 클라이언트 금지
- state 10분 만료, 1회 소비, raw state 저장 금지
- `calendar.events.owned`를 우선 사용하고 필요 시에만 scope 확대
- Edge Function의 사용자 JWT 검증과 DB 소유권 검증을 모두 수행
- connection token columns는 authenticated에 grant하지 않음

## 7. Test Plan

- migration: RLS, column grants, 다른 사용자/가구 격리
- unit: event→Google resource 및 RRULE 변환
- client: 연결 상태와 버튼 권한
- Edge: state 만료/재사용, 비소유 event 거부, Google 오류 masking
- 자격 증명 설정 후 실제 Google 테스트 계정 smoke test
