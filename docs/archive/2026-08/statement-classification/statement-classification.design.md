# statement-classification - Design Document

> Version: 1.0.0 | Date: 2026-08-31 | Status: Approved
> Level: Dynamic | Plan: [statement-classification.plan.md](statement-classification.plan.md)

## 1. 설계 목표

명세 처리 과정을 두 단계로 분리한다.

```text
은행 양식 해석
  파일 → 저장된 양식 프로필 또는 헤더 자동 탐지 → 공통 거래 행

카테고리 분류
  공통 거래 행 → 거래처·메모 규칙 비교 → 설명 가능한 카테고리 추천
```

어떤 단계도 사용자의 최종 확인 없이 원장에 자동 반영하지 않는다.

## 2. 구성

```text
StatementImportPanel
 ├─ @home/statement-parser
 │   ├─ headerSignature
 │   ├─ applyStatementProfile
 │   └─ classifyStatementRows
 ├─ ledger_statement_profiles API
 ├─ ledger_classification_rules API
 └─ 행별 추천 카테고리·추천 이유·수동 변경

LedgerPage
 └─ ClassificationRulePanel
     └─ 규칙 추가·비활성화·삭제
```

## 3. 공유 타입

```ts
type LedgerClassificationRule = {
  id: string;
  householdId: string;
  bookId: string;
  transactionType: 'income' | 'expense';
  targetField: 'merchant' | 'memo' | 'both';
  matchType: 'contains' | 'exact';
  keyword: string;
  categoryId: string;
  priority: number;
  isActive: boolean;
};

type LedgerStatementProfile = {
  id: string;
  householdId: string;
  bookId: string;
  name: string;
  headerSignature: string;
  mapping: StatementColumnMapping;
  encoding: 'utf-8' | 'euc-kr' | 'xlsx';
  sheetName: string;
  isActive: boolean;
};
```

## 4. 분류 알고리즘

1. 거래 유형과 규칙의 `transactionType`이 같은 규칙만 선택한다.
2. 거래처·메모의 제어문자와 연속 공백을 정리하고 소문자로 변환한다.
3. `contains` 또는 `exact` 방식으로 비교한다.
4. `priority ASC`, `keyword length DESC`, `created_at ASC` 순으로 첫 규칙을 사용한다.
5. 결과로 `categoryId`, 규칙 ID, `“거래처에 ‘스타벅스’ 포함”` 형태의 이유를 반환한다.
6. 규칙이 없거나 조회가 실패하면 미분류 상태를 유지한다.

분류 함수는 DB나 React에 의존하지 않는 순수 함수로 구현한다.

## 5. 은행 양식 프로필

- 정규화된 전체 헤더 배열의 SHA-256을 `header_signature`로 사용한다.
- 파일 분석 후 같은 장부에서 signature가 같은 활성 프로필을 먼저 찾는다.
- 저장 프로필이 있으면 열 매핑·인코딩·시트 설정을 적용한다.
- 프로필이 없으면 기존 alias 자동 탐지를 사용하고 사용자가 수정한다.
- 관리 권한이 있는 사용자는 현재 매핑을 이름과 함께 저장할 수 있다.
- 같은 장부·signature에는 활성 프로필 하나만 허용한다.
- 양식 적용 실패 시 자동 탐지 또는 수동 매핑으로 안전하게 되돌아간다.

## 6. 데이터 모델

### `ledger_classification_rules`

- book/household/category FK
- transaction type, target field, match type
- keyword 2~~100자, priority 0~~9999, active 상태
- 생성·수정 사용자와 UTC 시각
- 동일 장부·유형·필드·방식·정규화 키워드 중복 금지

### `ledger_statement_profiles`

- book/household FK
- 표시 이름, SHA-256 header signature
- mapping JSONB, encoding, sheet name
- 생성·수정 사용자와 UTC 시각
- 동일 장부·signature 중복 금지

## 7. DB 검증과 RLS

- SELECT: `private.can_read_ledger_book(book_id)`
- INSERT/UPDATE/DELETE: `private.can_manage_ledger_book(book_id)`
- trigger에서 book의 `household_id`를 강제한다.
- 규칙 category가 같은 book, 같은 transaction type, 활성 상태인지 검사한다.
- book/category/profile identity는 UPDATE로 변경할 수 없다.
- 클라이언트가 보낸 `created_by`, `updated_by`, `household_id`는 신뢰하지 않고 `auth.uid()`와 book 정보로 대체한다.

## 8. API

```text
listClassificationRules(bookId)
createClassificationRule(bookId, householdId, input)
updateClassificationRule(id, priority, isActive)
deleteClassificationRule(id)

listStatementProfiles(bookId)
createStatementProfile(bookId, householdId, input)
deleteStatementProfile(id)
```

## 9. UI

### 분류 규칙 관리

- 가계부 헤더의 `분류 규칙 관리` 버튼
- 관리 권한이 없으면 버튼을 숨기고 추천 결과만 사용
- 유형·대상·방식·키워드·카테고리·우선순위 입력
- 활성/비활성 및 삭제

### 명세 가져오기

- 저장 프로필 적용 여부 표시
- 관리자는 `현재 양식 저장` 가능
- 각 정상 행에 카테고리 select와 추천 이유 표시
- 추천값을 사용자가 변경하거나 미분류로 되돌릴 수 있음
- 기본 카테고리는 추천이 없는 행에만 적용

## 10. 오류 처리

- 규칙 조회 실패: 미분류로 계속 진행하고 안내 표시
- 프로필 적용 실패: 자동 헤더 탐지로 복구
- 권한 오류: 관리 버튼 비활성화 또는 명확한 오류 표시
- category type 불일치: 클라이언트와 DB 양쪽에서 거부

## 11. 테스트

- contains/exact, merchant/memo/both
- transaction type 격리와 우선순위 충돌
- 대소문자·연속 공백 정규화
- header signature 안정성 및 프로필 적용
- 추천값 수정·미분류·기본 카테고리 fallback
- 가족 관리자/구성원/개인 장부 소유자/외부인 RLS
- 교차 book/category 거부
- PC와 390px 규칙 관리·명세 검토
- lint, TypeScript, Vitest, production build

## 12. 구현 순서

1. 공유 타입과 순수 분류 함수
2. DB migration과 RLS 테스트
3. ledger API와 container 상태
4. 규칙 관리 UI
5. 명세 추천·프로필 적용/저장 UI
6. 테스트·클라우드 migration·gap analysis
