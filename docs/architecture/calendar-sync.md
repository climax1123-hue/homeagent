# Google Calendar 동기화 아키텍처

## 목적

Google Calendar와 우리집 일정 사이의 변경을 중복과 누락 없이 동기화하고, 외부 서비스 장애가 로컬 일정 기능을 막지 않게 한다.

## 구성

```text
React Web / PWA
  ├─ local calendar API → Supabase PostgreSQL
  └─ Google 연결 요청 → Edge Function → Google OAuth

Google Calendar
  └─ push notification → HTTPS webhook Edge Function
                              └─ syncToken 증분 동기화
                                  └─ events / sync state 갱신
```

## 주요 엔터티

- `calendar_connections`: 사용자별 Google 계정 연결
- `external_calendars`: 사용자가 선택한 Google Calendar와 동기화 모드
- `calendar_credentials`: 서버 전용 암호화 OAuth token
- `events`: 로컬 일정과 외부 일정 매핑
- `event_recurrence`: 반복 규칙과 예외
- `calendar_sync_states`: sync token, 마지막 성공과 오류
- `calendar_watch_channels`: Google push channel ID, resource ID와 만료 시각
- `calendar_sync_jobs`: 동기화 작업과 재시도 상태

## 식별과 중복 방지

- Google event ID와 Google calendar ID의 조합을 외부 유일키로 사용
- 로컬 일정에는 별도 UUID 사용
- Google `iCalUID`는 호환 정보로 보존하지만 단독 유일키로 사용하지 않음
- 쓰기 요청에는 idempotency 식별자를 사용
- 삭제된 외부 일정은 tombstone으로 처리한 후 정책에 따라 정리

## 동기화 방식

### 최초 동기화

1. 사용자가 캘린더와 동기화 모드를 선택한다.
2. 전체 event collection을 pagination하여 가져온다.
3. 마지막 페이지의 `nextSyncToken`을 저장한다.
4. Google push notification channel을 생성한다.

### 변경분 동기화

1. Google webhook이 calendar 변경 사실을 알린다.
2. webhook body에는 변경 세부내용이 없으므로 동기화 job을 생성한다.
3. worker가 저장한 sync token으로 변경분을 조회한다.
4. 생성, 변경과 삭제를 로컬 DB에 반영한다.
5. 새로운 sync token과 마지막 성공 시각을 저장한다.

Google push channel은 만료될 수 있으므로 만료 전에 갱신하는 예약 작업을 운영한다.

### 복구

- `410 Gone`: 기존 sync token을 폐기하고 전체 재동기화
- `401/403`: 연결을 `reauthorization_required`로 전환
- `404`: 외부 캘린더 삭제 또는 권한 제거 상태로 전환
- `429/5xx`: 지수 백오프와 최대 재시도 적용

## 보안

- OAuth refresh token은 서버 전용 암호화 저장소에 보관
- webhook channel token에 OAuth token이나 개인정보를 넣지 않음
- webhook의 channel ID, resource ID와 token을 검증
- Calendar scope는 선택한 동기화 모드에 필요한 최소 범위 사용
- 구성원 탈퇴 시 해당 사용자의 Google 연결과 watch channel 정리

## 공식 근거

- 증분 동기화: <https://developers.google.com/workspace/calendar/api/guides/sync>
- 변경 Push notification: <https://developers.google.com/workspace/calendar/api/guides/push>
- 반복 일정: <https://developers.google.com/workspace/calendar/api/guides/recurringevents>
