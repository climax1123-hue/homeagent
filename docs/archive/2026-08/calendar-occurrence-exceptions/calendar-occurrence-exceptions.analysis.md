# Gap Analysis: calendar-occurrence-exceptions

> Date: 2026-08-26 | Design: `docs/02-design/features/calendar-occurrence-exceptions.design.md`

## Match Rate: 96%

## Summary

설계의 데이터 모델, RLS, 회차 확장, UI 분기, 일정별 알림과 발송 처리를 구현했다. 총 25개 세부 항목 중 24개가 설계와 일치한다.

## Implemented Items

- [x] `event_id + original_starts_at` 회차 식별 및 cascade
- [x] 취소·override·복구와 ±7일 이동 제한
- [x] 개인 일정 예외 비공개 및 가족 일정 관리자 권한
- [x] 월·주·목록 범위 확장 후 예외 적용·재필터·정렬
- [x] 이번만/전체 수정·삭제 UI 분기
- [x] 정시·10분·30분·1시간·1일 전 알림 저장·삭제
- [x] 반복 일정 예외를 고려한 Web Push 발송
- [x] 알림과 원본 일정의 household·visibility 범위 DB 검증

## Remaining Difference

- [ ] 실제 iPhone/Android 기기의 OS 알림 노출은 배포된 HTTPS 환경에서 최종 수동 확인이 필요하다.

## Quality and Security

| Check | Result |
|---|---|
| TypeScript/lint/build | 통과, 기존 auth Fast Refresh 경고 6건만 존재 |
| Unit tests | 32/32 통과(빈 테스트 패키지 제외) |
| Calendar RLS | core 13/13, exception 12/12, notification 13/13 통과 |
| Google token isolation | 9/9 통과 |
| Responsive rules | 760px/430px breakpoint 및 주요 터치 영역 44px 확인 |

## Recommendation

현재 기능은 보고·보관 가능하다. HTTPS 배포 후 실제 모바일 홈 화면 설치와 알림 허용을 사용자 인수검사로 수행한다.

