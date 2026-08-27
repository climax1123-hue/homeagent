# calendar-notifications - Plan Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Approved | Level: Dynamic

## Purpose

일정 시작 전 알림과 `매일 아침 약 먹기` 같은 독립적인 반복 알림을 Android·iPhone·PC 웹에서 제공한다.

## Goals

- [ ] 사용자가 직접 알림 권한을 켜고 기기별 구독을 관리한다.
- [ ] 일정 시작 N분 전 알림을 설정한다.
- [ ] 매일 또는 선택 요일·시간의 반복 알림을 설정한다.
- [ ] 백그라운드에서도 Web Push를 수신한다.
- [ ] iPhone 설치 요건과 권한 상태를 명확히 안내한다.

## Scope

- PWA manifest, service worker, Push API
- 기기별 push subscription 저장과 폐기
- 일정 연결/독립 반복 reminder rule
- Supabase Cron → Edge Function 분 단위 dispatch
- 중복 발송 방지 delivery log
- 가족/개인 권한과 사용자별 수신 대상

## Non-Goals

- SMS, 카카오톡, 이메일 발송
- 의료 복약 판단 또는 투약량 추천
- 앱스토어 네이티브 앱

## Success Criteria

- Android Chrome 및 데스크톱 지원 브라우저에서 구독·푸시가 동작한다.
- iOS/iPadOS 16.4+ 홈 화면 웹앱 요건을 안내하고 설치 후 구독할 수 있다.
- 같은 알림 회차가 기기당 한 번만 발송된다.
- 비활성/만료 endpoint는 자동 정리된다.
- RLS와 전체 테스트가 통과한다.

## Risks

| Risk | Mitigation |
|---|---|
| iPhone Safari 탭에서는 push 불가 | 홈 화면 추가 안내와 feature detection |
| 과도한 알림 | 명시적 opt-in, 기본 비활성, 개별 on/off |
| endpoint 유출 | 사용자 본인 RLS, 로그·오류 응답에서 endpoint 제외 |
| cron 중복 | unique delivery key와 원자적 claim |
