# calendar-occurrence-exceptions - Plan Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Approved | Level: Dynamic

## Purpose

반복 일정에서 선택한 회차만 취소하거나 시간·내용을 변경하고, 일정 등록 시 시작 전 알림을 함께 설정할 수 있게 한다.

## Goals

- [ ] 반복 일정의 `이번 일정만 삭제`와 `전체 반복 일정 삭제`를 구분한다.
- [ ] 선택 회차만 제목·시간·설명·장소를 변경한다.
- [ ] 예외가 월·주·목록 보기에 동일하게 반영된다.
- [ ] 일정 등록·수정 form에서 시작 전 알림을 설정한다.
- [ ] 원본 반복 규칙과 다른 회차 데이터의 권한 경계를 보존한다.

## Scope

- occurrence cancel/override DB 모델과 RLS
- occurrence expansion에 예외 적용
- 상세 dialog의 이번 일정 수정/삭제
- 사전 알림 없음·정시·10분·30분·1시간·1일
- 일정 저장과 reminder rule 저장의 일관된 사용자 흐름

## Success Criteria

- 취소 회차는 다시 조회되지 않고 다른 회차는 유지된다.
- 수정 회차는 새 시간 범위에도 올바르게 보인다.
- 본인 또는 가족 공유 일정 관리자만 예외를 만든다.
- 개인 일정 예외는 다른 구성원에게 노출되지 않는다.
- 반복 회차와 알림 관련 테스트 및 `pnpm check`가 통과한다.

## Risks

| Risk | Mitigation |
|---|---|
| occurrence 식별의 시간 오차 | 원본 UTC 시작 시각을 unique key로 사용 |
| override가 조회 범위 밖으로 이동 | 예외 포함 조회 여유 범위와 override 시각 재필터 |
| 원본 삭제 후 orphan | FK cascade |
| 일정 저장 후 알림 저장 실패 | 일정은 유지하고 명시적 오류·재시도 제공 |
