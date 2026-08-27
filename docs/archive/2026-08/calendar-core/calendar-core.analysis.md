# Gap Analysis: calendar-core

> Date: 2026-08-26 | Design: `docs/02-design/features/calendar-core.design.md`

## Match Rate: 92%

## Summary

핵심 기능, 데이터 모델, RLS, 반복 일정, 반응형 UI와 앱 라우팅은 설계대로 구현되었다. 전체 코드 검사와 원격 DB 마이그레이션도 통과했다. 로컬 Docker 장애로 pgTAP 보안 테스트를 실제 실행하지 못했고, 인증된 브라우저의 수동 화면 확인은 남아 있어 테스트 계획 일부가 미완료다.

## Implemented Items

- [x] 월간·주간·목록 보기 및 기간 이동
- [x] 일반·종일 일정 CRUD와 상세 화면
- [x] 가족 공유/개인 일정 및 소유자·관리자 RLS
- [x] 매일·매주·매월·매년 반복과 종료일/횟수
- [x] UTC 저장 및 `Asia/Seoul` 입력·표시
- [x] 로딩·오류·빈 상태와 PC·모바일 반응형 UI
- [x] 공용 타입, 입력 검증, Supabase 행 매핑
- [x] 새 migration 추가 및 Supabase 원격 적용
- [x] 날짜·반복 단위 테스트, 전체 lint/typecheck/test/build

## Remaining Verification

- [ ] Docker 복구 후 `supabase/tests/calendar-security.test.sql` 실행
- [ ] 인증된 실제 계정으로 PC·모바일 너비 수동 smoke test

## Iteration Applied

- 야간 새 일정의 종료 시각이 시작 시각과 같아질 수 있던 기본값 계산을 다음 날짜까지 안전하게 처리했다.
- 종일 일정 수정 시 배타적 종료일이 하루씩 늘어나는 문제를 보정했다.
- 서울 시간 기준 월 경계와 날짜 숫자를 사용하도록 수정했다.
- 지원 범위가 제한적인 `Map.groupBy`를 호환 가능한 `Map` 누적 방식으로 교체했다.
- pgTAP 계획 개수를 실제 assertion 수와 일치시켰다.

## Recommendation

기능 설계 일치율이 90% 이상이며 자동 품질 검사가 통과했으므로 완료 보고 단계로 진행한다. Google Calendar 연동과 알림은 별도 PDCA 기능으로 다룬다.
