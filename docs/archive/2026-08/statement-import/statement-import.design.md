# statement-import - Design Document

> Version: 1.0.0 | Date: 2026-08-28 | Status: Approved
> Level: Dynamic | Plan: [statement-import.plan.md](statement-import.plan.md)

## 1. 아키텍처

```text
LedgerPage
  └─ StatementImportPanel
      ├─ File validation (10MB, csv/xlsx signature)
      ├─ @home/statement-parser
      │   ├─ CSV decoder/parser
      │   ├─ XLSX value reader
      │   ├─ header detection / column mapping
      │   └─ normalization / SHA-256 fingerprint
      └─ ledger-import-api
          ├─ duplicate candidate lookup
          └─ commit_ledger_import RPC

Supabase
  ├─ ledger_import_batches
  ├─ ledger_import_rows
  ├─ ledger_transactions (source=import)
  ├─ validation triggers
  └─ RLS + atomic commit RPC
```

원본 파일은 브라우저 메모리에서만 읽는다. 서버에는 확정에 필요한 정규화 행과 hash만 전송하며 원본 행 JSON, 계좌번호, 파일 binary는 저장하지 않는다.

## 2. Parser 계약

```ts
type StatementMatrix = string[][];
type StatementColumnMapping = {
  occurredOn: number;
  merchant?: number;
  memo?: number;
  amount?: number;
  expense?: number;
  income?: number;
};
type StatementDraftRow = {
  sourceRowNumber: number;
  occurredOn: string;
  type: 'income' | 'expense';
  amount: string;
  merchant: string;
  memo: string;
  fingerprint: string;
  included: boolean;
  errors: StatementParseError[];
};
```

- CSV: `TextDecoder`로 UTF-8을 먼저 검사하고 replacement character가 많으면 `euc-kr`로 재해석한다.
- delimiter: 첫 유효 줄의 쉼표/탭/세미콜론 수를 비교한다.
- quoted CSV는 RFC 4180 스타일 double quote escape와 줄바꿈을 처리한다.
- XLSX: 라이브러리는 workbook을 값으로만 읽고 수식·매크로를 실행하지 않는다.
- Excel serial date는 UTC 기반 달력 날짜로 변환한다.
- fingerprint 입력은 `date|type|amount|normalized merchant|normalized memo`이며 SHA-256 hex를 사용한다.

## 3. 열 자동 매핑

정규화한 header에서 다음 별칭을 찾는다.

| 필드      | 후보                                         |
| --------- | -------------------------------------------- |
| 일자      | 거래일, 이용일, 승인일, 날짜, date           |
| 거래처    | 적요, 내용, 가맹점, 사용처, 거래처, merchant |
| 메모      | 메모, 비고, 거래내용, memo                   |
| 출금      | 출금액, 이용금액, 사용금액, 출금, debit      |
| 입금      | 입금액, 입금, credit                         |
| 단일 금액 | 금액, 거래금액, amount                       |

출금/입금 두 열이 있으면 0이 아닌 열로 방향을 결정한다. 단일 금액은 음수를 지출, 양수를 수입으로 해석하며 사용자가 매핑 단계에서 방향 규칙을 확인한다.

## 4. 데이터 모델

### `ledger_import_batches`

| Column                  | Type        | Rule                                        |
| ----------------------- | ----------- | ------------------------------------------- |
| id                      | uuid        | PK                                          |
| household_id            | uuid        | FK households, not null                     |
| book_id                 | uuid        | FK ledger_books, not null                   |
| account_id              | uuid        | FK ledger_accounts, not null                |
| created_by              | uuid        | auth.uid, immutable                         |
| display_filename        | text        | basename, 최대 180                          |
| file_fingerprint        | char(64)    | SHA-256                                     |
| status                  | text        | committed/failed; draft는 브라우저에만 존재 |
| total_rows              | integer     | 1..10000                                    |
| committed_rows          | integer     | 0..total_rows                               |
| created_at/committed_at | timestamptz | UTC                                         |

동일 사용자의 같은 book/account/file fingerprint는 unique다.

### `ledger_import_rows`

| Column               | Type        | Rule                |
| -------------------- | ----------- | ------------------- |
| id                   | uuid        | PK                  |
| batch_id             | uuid        | FK batch cascade    |
| household_id/book_id | uuid        | batch에서 검증      |
| source_row_number    | integer     | 2 이상              |
| row_fingerprint      | char(64)    | normalized row hash |
| transaction_id       | uuid        | FK transaction      |
| created_at           | timestamptz | UTC                 |

정규화 상세는 이미 `ledger_transactions`에 있으므로 중복 저장하지 않는다.

## 5. 중복 판정

### 확정 중복

- 동일 사용자·장부·결제수단의 `file_fingerprint`가 이미 존재
- 동일 batch 내 같은 `row_fingerprint`

### 후보 중복

- 같은 book/account에서 동일 일자, type, amount, normalized merchant가 기존 transaction과 일치

후보 중복은 자동 제외하되 사용자가 다시 포함할 수 있다. DB unique는 같은 batch 내 row만 강제하고 서로 다른 파일의 유사 거래는 사용자의 판단을 보존한다.

## 6. Commit RPC

```text
commit_ledger_import(
  book_id, account_id, display_filename, file_fingerprint,
  rows jsonb[]
) → batch_id, committed_rows
```

RPC는 다음을 한 transaction에서 수행한다.

1. 로그인 사용자와 book read/write 권한 확인
2. account가 같은 book이고 활성인지 확인
3. 파일 fingerprint 중복 확인
4. 1..10,000행 및 각 필드 형식 검증
5. batch 생성
6. `source=import` transaction 생성
7. batch-row/transaction 관계 생성
8. batch committed 처리

어느 한 행이라도 실패하면 전체를 rollback한다.

## 7. RLS

- batch/row SELECT: parent book을 읽을 수 있는 사용자
- 직접 INSERT/UPDATE/DELETE: authenticated에 부여하지 않음
- 생성은 authenticated가 호출 가능한 commit RPC로만 수행
- family book: active member가 import 가능
- private book: owner만 가능
- 다른 household/book/account/category 참조는 RPC와 transaction trigger가 거부

## 8. UI

### 단계

1. 파일 선택
2. 자동 열 매핑 확인/수정
3. 대상 결제수단과 기본 카테고리 선택
4. 표에서 행 포함/제외 및 값 수정
5. 중복/오류 요약 확인
6. 확정 및 결과 표시

Desktop은 sticky header가 있는 표를 사용하고, 모바일은 행별 카드와 핵심 필드만 표시한다. 파일 input과 모든 버튼의 높이는 44px 이상이다.

## 9. 오류 코드

| 코드                  | 의미                         |
| --------------------- | ---------------------------- |
| FILE_TOO_LARGE        | 10MB 초과                    |
| FILE_TYPE_UNSUPPORTED | CSV/XLSX 아님                |
| HEADER_NOT_FOUND      | header/필수 열 미확인        |
| DATE_INVALID          | 날짜 변환 실패               |
| AMOUNT_INVALID        | 금액이 없거나 정수가 아님    |
| DIRECTION_AMBIGUOUS   | 수입/지출을 결정할 수 없음   |
| FILE_ALREADY_IMPORTED | 같은 파일이 이미 반영됨      |
| IMPORT_ACCESS_DENIED  | 장부 또는 결제수단 권한 없음 |
| IMPORT_ROW_INVALID    | 서버 재검증 실패             |

## 10. 테스트

- CSV quote, delimiter, BOM, 줄바꿈
- UTF-8/CP949 한글
- XLSX 첫 sheet와 선택 sheet
- header 별칭 자동 매핑과 수동 매핑
- 날짜 4종, 쉼표/원화/부호 금액
- 동일 normalized row fingerprint 안정성
- 10MB/10,000행 제한
- family/private/outsider RLS
- cross-book account/category 거부
- 파일 재반영 거부와 RPC 전체 rollback
- 390px/desktop 업로드·검토 흐름

## 11. 파일 구조

```text
packages/statement-parser/src/
  index.ts
  csv.ts
  normalize.ts
  xlsx.ts
  statement-parser.test.ts

apps/web/src/features/ledger/import/
  StatementImportPanel.tsx
  ledger-import-api.ts
  statement-import.css

supabase/migrations/
  <timestamp>_create_statement_import.sql
supabase/tests/
  statement-import-security.test.sql
```

## 12. 구현 판단

- Web Worker는 10,000행 실측 후 필요하면 별도 iterate에서 추가한다.
- 원본 행 JSON과 파일 binary는 저장하지 않는다.
- 은행별 preset은 parser core와 분리 가능한 header alias 설정으로 시작한다.
