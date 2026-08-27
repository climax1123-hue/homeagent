# calendar-occurrence-exceptions Completion Report

> **Status**: Complete
>
> **Project**: HomeWebSite
> **Author**: Codex
> **Completion Date**: 2026-08-26

## 1. Results

| Item | Result |
|---|---|
| Feature | 반복 일정 회차 예외 및 일정 시작 알림 |
| Completion | 24/25 설계 항목, 96% |
| Database | Supabase cloud 적용 완료 |
| Worker | Web Push dispatcher 및 매분 cron 가동 |

## 2. Completed Requirements

| Requirement | Status |
|---|:---:|
| 이번 회차만 수정·삭제·복구 | 완료 |
| 전체 반복 일정 수정·삭제 | 완료 |
| 예외를 모든 calendar view에 반영 | 완료 |
| 일정 시작 전 알림 선택·저장 | 완료 |
| 반복 예외를 반영한 알림 발송 | 완료 |
| household/RLS/token 권한 경계 | 완료 |
| PC·모바일 반응형 및 44px 터치 기준 | 완료 |

## 3. Verification Summary

- `pnpm check` 전체 통과
- DB pgTAP 47개(calendar 13 + exception 12 + notification 13 + Google 9) 통과
- notification cron 최신 실행 `succeeded`
- Google refresh token 컬럼은 클라이언트 SELECT 불가

## 4. Follow-up

- Google OAuth는 Google Cloud Client ID/Secret 등록 후 실제 계정 연결을 활성화한다.
- HTTPS 배포 후 iOS 16.4+ 홈 화면 Web App과 Android에서 푸시 수신을 확인한다.
- 번들 504KB 경고는 이후 route 단위 code splitting 작업에서 줄인다.

