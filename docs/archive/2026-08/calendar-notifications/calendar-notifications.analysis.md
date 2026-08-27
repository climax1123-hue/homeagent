# Gap Analysis: calendar-notifications

> Date: 2026-08-26 | Match Rate: 90%

## Implemented

- [x] PWA 및 기기 PushSubscription
- [x] 반복 알림 생성·켜기/끄기·삭제
- [x] RLS와 service-role 전용 delivery log
- [x] VAPID Web Push dispatcher
- [x] 매분 cron과 중복 방지
- [x] iOS 설치 조건 안내
- [x] 만료 endpoint 정리

## Gap

- [ ] 일정 form의 시작 전 알림 선택 UI
- [ ] 실제 Android/iPhone 물리 기기의 수신 smoke test

## Decision

독립 반복 알림과 백그라운드 푸시 인프라는 완성됐다. 핵심 일치율 90%로 Report 후 일정별 사전 알림 UI를 다음 calendar polish 단계에서 보완한다.
