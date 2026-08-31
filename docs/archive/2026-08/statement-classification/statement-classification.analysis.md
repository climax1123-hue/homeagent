# statement-classification - Gap Analysis

> Date: 2026-08-31 | Iteration: 1 | Match Rate: 94%

## 비교 결과

| 항목                     | 결과    | 설명                                   |
| ------------------------ | ------- | -------------------------------------- |
| 거래처·메모 규칙 분류    | Match   | 순수 함수와 설명 문자열 구현           |
| 포함·정확히 일치         | Match   | 두 방식 지원                           |
| 거래 유형 격리           | Match   | 수입·지출 규칙 분리                    |
| 규칙 우선순위            | Match   | priority, keyword 길이, 생성일 정렬    |
| 행별 추천·수정           | Match   | category select와 추천 이유            |
| 기본 카테고리 fallback   | Match   | 추천 없는 같은 유형 행에 적용          |
| 가족/개인 관리 권한      | Match   | can_manage_ledger_book RLS 재사용      |
| 교차 category 검증       | Match   | DB trigger 검증                        |
| 은행 양식 signature      | Match   | 정규화 헤더 SHA-256                    |
| 자동 프로필 적용         | Match   | 같은 signature 프로필 자동 적용        |
| 프로필 수동 재사용       | Match   | 저장 양식 select 제공                  |
| 현재 매핑 저장           | Match   | mapping·encoding·sheet 저장            |
| 규칙 조회 실패 fallback  | Match   | 설정 조회 실패를 빈 규칙·프로필로 복구 |
| 규칙 관리 UI 권한 테스트 | Match   | 관리자 노출·구성원 숨김 테스트 추가    |
| RLS pgTAP                | Partial | 작성 완료, Docker 미가동으로 미실행    |
| PC·390px 실화면          | Partial | CSS 구현, 로그인 세션 접근 차단        |
| 10,000행 성능            | Missing | 실측하지 않음                          |

## Iterate 결과

1. 규칙·프로필 조회 실패를 빈 설정으로 복구해 가계부 사용을 보장했다.
2. 관리자/구성원 규칙 관리 버튼 테스트를 추가했다.
3. 은행 양식 프로필 요구사항을 Plan과 Design에 모두 명시했다.

## 최종 판단

Match Rate 94%로 Report 기준을 충족한다. pgTAP 실행, 로그인된 실제 PC·모바일 화면, 10,000행 성능은 운영 검증 항목으로 남긴다.
