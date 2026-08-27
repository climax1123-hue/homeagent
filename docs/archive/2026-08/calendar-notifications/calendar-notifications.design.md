# calendar-notifications - Design Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Approved | Level: Dynamic

## 1. Architecture

```text
Browser/PWA -> Service Worker -> PushSubscription -> Supabase DB
                                                       ^
pg_cron (1 minute) -> dispatch-calendar-notifications Edge Function
                                                       |
                                                   Web Push endpoints
```

클라이언트는 사용자 클릭에서만 권한을 요청한다. dispatch 함수는 service role로 due reminder를 claim하고 VAPID Web Push를 기기별로 보낸다.

## 2. Data Model

### `push_subscriptions`

사용자·기기별 endpoint, `p256dh`, `auth`, user agent, 활성 상태와 마지막 성공/실패 시각. endpoint는 unique이며 사용자 본인만 CRUD 가능하다.

### `calendar_reminders`

- `kind`: `event` 또는 `recurring`
- event형: `event_id`, `advance_minutes`
- recurring형: title/body, `local_time`, `weekdays`(0=일요일), `starts_on`, `ends_on`
- `owner_user_id`, `household_id`, enabled

### `notification_deliveries`

`(reminder_id, scheduled_for, subscription_id)` unique로 중복 방지. service role 전용.

## 3. Scheduling

- cron은 1분마다 dispatch 함수를 호출한다.
- 함수는 현재 시각 전후의 due reminder를 계산한다.
- 반복 알림은 `Asia/Seoul` 현지 날짜·요일·시간으로 판정한다.
- 일정 반복 occurrence는 기존 recurrence 규칙을 동일하게 적용한다.
- delivery unique insert에 성공한 건만 발송한다.

## 4. Client

- `/manifest.webmanifest`, `/sw.js` 등록
- 알림 지원/권한/구독 상태 panel
- `알림 켜기`, `이 기기 알림 끄기`
- 일정 form의 시작 전 알림(없음/정시/10분/30분/1시간/1일)
- 독립 반복 알림 CRUD panel(제목, 시간, 요일, 시작/종료)
- iOS standalone이 아니면 홈 화면 추가 안내

## 5. Security

- VAPID private key는 Edge Function secret
- endpoint와 암호화 키는 본인 RLS, UI에 원문 재표시하지 않음
- dispatch는 cron secret header 검증
- 알림 payload에 개인 일정 설명·민감 위치는 넣지 않고 제목과 시간만 포함
- 사용자의 명시적 opt-in과 언제든 구독 해제

## 6. Test Plan

- RLS: 다른 사용자/가구 subscription·reminder 접근 거부
- schedule: 요일, 서울 시간, 시작/종료, 중복 방지
- browser: unsupported/denied/granted/standalone 상태
- service worker push·notificationclick
- expired endpoint(404/410) 비활성화
