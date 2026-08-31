# common-codes - Design

> Version: 1.0.0 | Date: 2026-08-27 | Status: Approved

## 데이터 모델

기존 `ledger_common_codes`를 `common_codes`로 승격한다. 모든 행은 `household_id`, `group_key`, `code`, `label`, `sort_order`, `is_active`를 가지며 `is_admin_editable`로 확장형과 잠금형을 구분한다.

- `payment_method_type`: 관리자 추가·수정 가능
- 권한/상태/계산 코드: 조회 가능, 변경 불가
- RLS: 활성 구성원 SELECT, 관리자 INSERT/UPDATE
- DB trigger: 잠금 코드의 변경과 확장형 그룹 외 신규 코드 생성을 거부

## UI

관리자 메뉴의 `공통코드 관리`에서 그룹 탭과 코드 목록을 제공한다. 잠금 그룹은 “시스템 보호” 안내만 표시하고, 확장형 그룹에만 추가·활성화 버튼을 제공한다.

## 장부 생성 보완

새 장부 생성 시 현금·은행 계좌·체크카드·신용카드·기타의 기본 결제수단 행을 생성한다. 기존 장부도 같은 기본 행을 중복 없이 보강한다. 장부 전환 영역에는 사용 가능한 가족/개인 장부가 없을 때만이 아니라 언제든 허용 범위 안에서 `장부 추가`를 제공한다.

## 테스트

- 코드 조회/그룹화와 관리자 편집 API
- 잠금 그룹 DB 변경 거부
- 타 가족 공간 및 일반 구성원 쓰기 거부
- 기본 결제수단 backfill과 신규 장부 생성
- 개인 장부 소유자 외 조회 차단 유지
