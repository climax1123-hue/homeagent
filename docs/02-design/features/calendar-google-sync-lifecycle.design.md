# Google Calendar 동기화 마무리 설계

## 데이터

- `google_calendar_connections.auto_sync_enabled`: 사용자별 자동 동기화 여부, 기본값 `false`
- `calendar_google_event_links.google_event_id`: 첫 동기화 실패도 상태 행을 남길 수 있도록 nullable
- 기존 `sync_status`, `last_synced_at`, `last_error`를 UI 상태의 기준으로 사용

## 서버 동작

`google-calendar-sync`는 `action`을 받는다.

- `upsert`: link를 `pending`으로 만든 뒤 Google insert/update, 성공 시 `synced`, 실패 시 `error`
- `delete`: 연결된 Google event를 삭제하고 link를 제거한다. Google 404는 성공으로 취급한다.

두 action 모두 JWT 사용자와 일정 소유자를 검증한다.

## 클라이언트 동작

- 자동 동기화가 켜진 사용자는 일정 생성·수정 직후 `upsert` 호출
- Google 실패와 관계없이 로컬 저장은 유지하고 사용자에게 부분 실패를 안내
- 일정 상세에 상태와 마지막 성공 시각 표시
- 실패 상태에서는 `다시 동기화` 제공
- 삭제 시 Google link가 있으면 Google 삭제를 먼저 완료한 뒤 로컬 삭제

## 테스트

- connection/status mapping과 자동 설정 API
- 자동 동기화 옵션 UI
- 완료·실패·재시도 상태 UI
- migration RLS와 column grant
- 전체 lint/typecheck/unit/build
