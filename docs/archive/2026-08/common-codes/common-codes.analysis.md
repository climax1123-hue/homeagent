# common-codes Gap Analysis

> Date: 2026-08-28 | Iteration: 1 | Match Rate: 96%

## 결과

설계 항목 14개 중 13개가 구현됐다. 가계부 전용 테이블을 `common_codes`로 승격했고 관리자 화면, RLS, 잠금 trigger, 일정/가계부 선택값 연결과 기본 결제수단 backfill을 확인했다.

## 일치 항목

- 가족 공간별 중앙 코드와 unique key
- 활성 구성원 조회, 관리자 쓰기 RLS
- 결제수단 유형만 확장 가능
- 권한·상태·계산 코드의 시스템 잠금
- 관리자 전용 메뉴와 그룹별 목록
- 일정 공개범위·반복·색상·알림 선택값 연결
- 가계부 결제수단 유형 연결
- 기존/신규 장부 기본 결제수단 5종
- 다른 가족과 일반 구성원 변경 차단 DB 테스트 정의

## 잔여 차이

- 가족 관리 화면의 역할·상태 라벨은 기존 TypeScript 상수를 사용한다. 보안 enum 비교는 유지해야 하며, 표시 라벨만 공통코드로 교체하는 작업은 후속 UI 정리로 분리한다.

## 검증

- RLS/잠금 테스트를 `common_codes` 테이블명과 현재 정책에 맞게 갱신
- TypeScript 및 production build 통과
- Cloud migration 적용 상태 확인
