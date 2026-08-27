# ledger-core - Design Document

> Version: 1.0.0 | Date: 2026-08-27 | Status: Approved
> Level: Dynamic | Plan: [ledger-core.plan.md](../../01-plan/features/ledger-core.plan.md)

---

## 1. Overview

### 1.1 Purpose

Supabase PostgreSQL을 기준 원장으로 사용해 가족 공동 장부와 개인 장부를 안전하게 분리하고, 수입·지출·이체 거래, 결제수단, 카테고리, 월간 합계와 잔액을 React 웹에 제공한다.

### 1.2 Design Goals

- 금액 계산은 DB `bigint`와 TypeScript `bigint` 또는 정수 문자열만 사용한다.
- `household_id`와 장부 공개범위를 모든 데이터 접근의 보안 경계로 삼는다.
- 개인 장부는 가족 관리자도 조회하지 못한다.
- 가족 공동 거래는 누가 작성했고 누가 실제 결제했는지 구분한다.
- 이체를 단일 원자 거래로 저장해 두 결제수단의 잔액 불일치를 방지한다.
- 명세 가져오기와 자동 분류가 기존 원장을 변경하지 않고 확장할 수 있게 한다.
- 빠른 모바일 입력과 충분한 PC 정보 밀도를 같은 컴포넌트 구조로 지원한다.

## 2. Architecture

### 2.1 System Architecture

```text
React route /app/ledger
  └─ LedgerContainer
      ├─ shared validation/types (@home/shared)
      ├─ ledger-api (Supabase Data API + RPC)
      └─ LedgerPage
          ├─ BookSwitcher / MonthNavigator
          ├─ MonthlySummary
          ├─ LedgerFilters
          ├─ TransactionList
          ├─ TransactionEditor
          └─ LedgerSettings (accounts/categories)

Supabase PostgreSQL
  ├─ ledger_books
  ├─ ledger_accounts
  ├─ ledger_categories
  ├─ ledger_transactions
  ├─ validation/identity triggers
  ├─ RLS policies
  └─ summary/balance RPCs
```

프런트엔드는 사용자의 access token으로만 Data API와 RPC를 호출한다. `service_role`은 사용하지 않는다. 모든 쓰기 권한과 참조 무결성은 UI가 아니라 DB에서 다시 검증한다.

### 2.2 Component Responsibilities

| Component | Responsibility |
|---|---|
| `LedgerContainer` | 접근 컨텍스트, 장부·거래·결제수단·카테고리 로딩과 mutation orchestration |
| `LedgerPage` | 반응형 화면 배치와 dialog/sheet 상태 |
| `BookSwitcher` | 가족 장부와 본인 개인 장부 전환, 공개범위 표시 |
| `MonthNavigator` | Asia/Seoul 기준 월 이동과 현재 월 복귀 |
| `MonthlySummary` | 수입·지출·순수지 정수 문자열 표시 |
| `LedgerFilters` | 유형, 계좌, 카테고리, 결제자, 검색어 필터 |
| `TransactionList` | 날짜별 그룹, 작성자·결제자·금액·카테고리 표시 |
| `TransactionEditor` | 수입·지출·이체 빠른 입력과 상세 입력 |
| `LedgerSettings` | 결제수단·카테고리 추가, 수정, 정렬, 비활성화 |

### 2.3 Data Flow

#### Initial Load

1. `HouseholdRoute`가 active membership을 확인한다.
2. `LedgerContainer`가 접근 가능한 `ledger_books`를 읽는다.
3. 선택 장부가 없으면 가족 장부를 우선하고, 없으면 첫 개인 장부를 선택한다.
4. 선택 장부의 accounts, categories, 월간 transactions를 병렬 조회한다.
5. 월간 summary와 account balances는 DB RPC 결과의 정수 문자열을 사용한다.

#### Transaction Save

1. UI가 금액 문자열에서 쉼표를 제거하고 양의 정수 형식만 허용한다.
2. 공용 validator가 거래 유형별 필드 shape를 확인한다.
3. `crypto.randomUUID()`로 `clientRequestId`를 한 번 생성하고 재시도에도 재사용한다.
4. Data API insert/update를 수행한다.
5. DB trigger가 장부, account, category, payer, household identity를 검증한다.
6. 성공 시 거래 목록·요약·잔액을 다시 로드한다.

## 3. Domain Model

### 3.1 Enums

```sql
ledger_visibility = 'family' | 'private'
ledger_account_type = 'cash' | 'bank' | 'debit_card' | 'credit_card' | 'other'
ledger_transaction_type = 'income' | 'expense' | 'transfer'
ledger_transaction_source = 'manual' | 'import'
ledger_category_type = 'income' | 'expense'
```

### 3.2 `ledger_books`

장부 공개범위를 정의하는 최상위 엔티티다. 하위 account/category/transaction은 공개범위를 중복 저장하지 않고 book을 통해 판정한다.

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `household_id` | uuid | FK households, not null |
| `owner_user_id` | uuid | FK auth.users, not null |
| `visibility` | enum | family/private |
| `name` | text | trim, 1..60 |
| `currency` | text | MVP는 `KRW` check |
| `is_active` | boolean | default true |
| `created_at` | timestamptz | UTC default now |
| `updated_at` | timestamptz | touch trigger |

Constraints and indexes:

- household당 active family book 하나를 허용하는 partial unique index
- 사용자·household당 active private book 하나를 허용하는 partial unique index
- trigger로 `owner_user_id`, `household_id`, `visibility` 변경 금지

### 3.3 `ledger_accounts`

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `book_id` | uuid | FK ledger_books cascade |
| `household_id` | uuid | book에서 trigger로 복사, RLS/index 용도 |
| `owner_user_id` | uuid | active household member |
| `type` | enum | cash/bank/debit_card/credit_card/other |
| `name` | text | trim, 1..60 |
| `opening_balance` | bigint | 정수, default 0 |
| `sort_order` | integer | 0 이상 |
| `is_active` | boolean | default true |
| `created_at`, `updated_at` | timestamptz | UTC |

가족 장부 account는 해당 가족 구성원을 owner로 지정한다. 개인 장부 account의 owner는 book owner와 같아야 한다. 실제 계좌번호나 카드번호는 저장하지 않는다.

### 3.4 `ledger_categories`

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `book_id` | uuid | FK ledger_books cascade |
| `household_id` | uuid | book에서 복사 |
| `type` | enum | income/expense |
| `name` | text | trim, 1..40 |
| `icon` | text | 허용된 icon name, 1..40 |
| `color` | text | 허용된 design token key |
| `sort_order` | integer | 0 이상 |
| `is_default` | boolean | 시스템 생성 여부 |
| `is_active` | boolean | default true |
| `created_by` | uuid | FK auth.users |
| `created_at`, `updated_at` | timestamptz | UTC |

동일 book/type에서 대소문자를 무시한 category name unique를 적용한다. 거래가 연결된 category는 삭제하지 않고 `is_active=false`로 전환한다. 향후 `parent_id` migration으로 소분류를 확장한다.

### 3.5 `ledger_transactions`

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `book_id` | uuid | FK ledger_books cascade |
| `household_id` | uuid | book에서 복사 |
| `type` | enum | income/expense/transfer |
| `amount` | bigint | `> 0` |
| `occurred_at` | timestamptz | UTC 저장 |
| `account_id` | uuid | 출금 또는 입금 account |
| `transfer_account_id` | uuid nullable | transfer 도착 account |
| `category_id` | uuid nullable | income/expense category |
| `merchant` | text | trim, 최대 120 |
| `memo` | text | 최대 500 |
| `payer_user_id` | uuid | 실제 결제자/수입 귀속자 |
| `created_by` | uuid | 작성자, 불변 |
| `updated_by` | uuid | 최근 수정자 |
| `source` | enum | manual/import, MVP manual |
| `client_request_id` | uuid | 작성자별 unique |
| `deleted_at` | timestamptz nullable | soft delete |
| `created_at`, `updated_at` | timestamptz | UTC |

Shape constraints:

- income/expense: `account_id` 필수, `transfer_account_id` null
- transfer: 두 account 필수, 서로 달라야 함, `category_id` null
- category type은 transaction type과 같아야 함
- 모든 참조 account/category는 같은 book에 속해야 함
- 개인 book에서는 payer/created_by/updated_by가 book owner여야 함
- family book의 payer는 active household member여야 함
- `(created_by, client_request_id)` unique

### 3.6 Relationships

```text
households 1 ── N ledger_books
ledger_books 1 ── N ledger_accounts
ledger_books 1 ── N ledger_categories
ledger_books 1 ── N ledger_transactions
ledger_accounts 1 ── N ledger_transactions.account_id
ledger_accounts 1 ── N ledger_transactions.transfer_account_id
ledger_categories 1 ── N ledger_transactions.category_id
auth.users 1 ── N ledger_transactions.created_by / payer_user_id / updated_by
```

## 4. Balance and Summary Rules

### 4.1 Signed Account Movement

| Transaction | `account_id` | `transfer_account_id` |
|---|---:|---:|
| income | `+amount` | - |
| expense | `-amount` | - |
| transfer | `-amount` | `+amount` |

Account balance is `opening_balance + sum(signed movement)` for non-deleted transactions. Credit card account은 MVP에서 일반 결제수단과 동일하게 지출 시 감소하는 단순 표시 잔액을 사용하고, 청구 예정액 모델은 후속 기능으로 분리한다.

### 4.2 Monthly Summary

- Asia/Seoul 월 시작·다음 월 시작을 DB에서 UTC boundary로 변환한다.
- income 합계, expense 합계, `net = income - expense`를 계산한다.
- transfer와 soft-deleted transaction은 월간 수입·지출에서 제외한다.
- RPC 반환 금액은 `text`로 cast하여 JavaScript number 변환을 금지한다.

### 4.3 RPCs

```sql
get_ledger_month_summary(p_book_id uuid, p_month date)
  returns table(income_total text, expense_total text, net_total text)

get_ledger_account_balances(p_book_id uuid)
  returns table(account_id uuid, balance text)
```

두 RPC는 authenticated caller의 book SELECT 권한을 먼저 확인한다. private book은 owner 외 호출을 거부한다.

## 5. Authorization and RLS

### 5.1 Shared Helper Functions

```text
private.can_read_ledger_book(book_id)
private.can_manage_ledger_book(book_id)
private.can_manage_ledger_transaction(transaction_id)
```

- read family: active household member
- read private: book owner만
- manage family book metadata/category: household admin
- manage private book metadata/category: book owner
- manage family account: account owner 또는 household admin
- manage family transaction: `created_by = auth.uid()` 또는 household admin
- manage private account/transaction: book owner만

### 5.2 Table Policies

| Table | SELECT | INSERT | UPDATE/DELETE |
|---|---|---|---|
| books | `can_read` | family는 admin, private는 본인 active member | `can_manage_book` |
| accounts | parent book `can_read` | family 본인 owner account, private book owner | account owner 또는 book manager |
| categories | parent book `can_read` | book manager | book manager; 사용 중이면 비활성화만 |
| transactions | parent book `can_read` + not deleted | book read 권한 및 identity trigger | 작성자 또는 book manager; private는 owner만 |

soft-deleted 거래는 일반 SELECT 정책에서 제외한다. 삭제 mutation은 `deleted_at=now()` update로 수행하며 직접 DELETE 권한은 부여하지 않는다.

### 5.3 Trigger Validation

`private.validate_ledger_*` security-definer trigger functions가 다음을 강제한다.

- `household_id`를 parent book에서 복사
- 생성 시 `created_by`와 `updated_by`를 `auth.uid()`로 고정
- 수정 시 `created_by`, `book_id`, `household_id`, `source`, `client_request_id` 변경 금지
- account/category/book identity 일치
- payer active membership과 private owner 일치
- 거래 유형별 필드 shape와 category type 일치
- inactive account/category는 신규 거래에 사용 불가, 기존 거래 수정 시 기존 참조는 허용

## 6. API Specification

Supabase client wrapper인 `createLedgerApi(client)`를 사용한다.

### 6.1 Read Operations

```ts
listBooks(): Promise<LedgerBook[]>
listAccounts(bookId: string, includeInactive?: boolean): Promise<LedgerAccount[]>
listCategories(bookId: string, includeInactive?: boolean): Promise<LedgerCategory[]>
listTransactions(query: LedgerTransactionQuery): Promise<LedgerTransaction[]>
getMonthSummary(bookId: string, month: string): Promise<LedgerMonthSummary>
getAccountBalances(bookId: string): Promise<Record<string, MoneyString>>
```

`LedgerTransactionQuery`:

```ts
type LedgerTransactionQuery = {
  bookId: string;
  rangeStart: string;
  rangeEnd: string;
  type?: LedgerTransactionType;
  accountId?: string;
  categoryId?: string;
  payerUserId?: string;
  search?: string;
};
```

검색은 `merchant`와 `memo`의 escape된 `ilike`를 사용하며 입력 길이를 2..60자로 제한한다.

### 6.2 Write Operations

```ts
createBook(input: LedgerBookInput): Promise<LedgerBook>
updateBook(id: string, patch: LedgerBookPatch): Promise<void>
createAccount(input: LedgerAccountInput): Promise<LedgerAccount>
updateAccount(id: string, patch: LedgerAccountPatch): Promise<void>
createCategory(input: LedgerCategoryInput): Promise<LedgerCategory>
updateCategory(id: string, patch: LedgerCategoryPatch): Promise<void>
createTransaction(input: LedgerTransactionInput): Promise<LedgerTransaction>
updateTransaction(id: string, input: LedgerTransactionInput): Promise<void>
archiveTransaction(id: string): Promise<void>
```

### 6.3 TypeScript Money Contract

```ts
type MoneyString = `${bigint}`;

function parseMoneyInput(value: string): bigint;
function formatMoney(value: MoneyString | bigint): string;
function addMoney(values: readonly MoneyString[]): bigint;
```

- DB bigint 응답은 항상 문자열로 정규화한다.
- 합계와 차감은 `BigInt`로만 수행한다.
- UI 표시 직전에 `Intl.NumberFormat('ko-KR')`에 안전한 문자열 formatter를 사용한다.
- JSON serialization 시 bigint 자체를 전달하지 않고 decimal string으로 변환한다.

## 7. Default Data Strategy

가족 장부를 최초 조회했는데 없으면 관리자에게만 `가족 가계부 만들기`를 표시한다. 생성 transaction 안에서 다음 기본 데이터를 함께 만든다.

- family book `우리집 가계부`
- account `현금`
- expense categories: 식비, 생활, 주거, 교통, 건강, 교육, 문화·여가, 경조사, 기타
- income categories: 급여, 용돈, 금융수입, 기타수입

개인 장부는 사용자가 `개인 장부 만들기`를 선택할 때 생성한다. 자동 생성으로 원하지 않는 개인 금융 공간을 만들지 않는다.

## 8. UI/UX Design

### 8.1 Desktop Layout (>= 1024px)

```text
┌ 장부 선택 ─ 2026년 8월 ‹ 오늘 › ───────────── + 거래 ┐
├ 수입 ───────── 지출 ───────── 순수지 ─────────────┤
├ 필터: 전체 | 수입 | 지출 | 이체  계좌  카테고리  검색 ┤
├──────────────────────────────┬─────────────────────┤
│ 날짜별 거래 목록             │ 결제수단별 잔액      │
│ 08.27 식비  -24,000  홍길동  │ 현금       80,000   │
│ 08.27 급여 +3,000,000        │ 주거래  2,100,000   │
└──────────────────────────────┴─────────────────────┘
```

- 최대 콘텐츠 폭은 App Shell 기준을 재사용한다.
- 거래 행 클릭 시 우측 dialog 또는 중앙 modal로 상세/수정한다.
- 결제수단·카테고리 관리는 상단 보조 메뉴에서 연다.

### 8.2 Mobile Layout (< 760px)

```text
┌ 우리집 가계부 ▾       8월 ‹ › ┐
├ 수입      지출      순수지     ┤
├ 유형 chips / 필터 / 검색       ┤
├ 8월 27일                         ┤
│ 식비              -24,000원     │
│ 신용카드 · 내가 결제            │
├ 8월 26일 ...                     ┤
└─────────────────────────────────┘
                     [ + 거래 ]
```

- `+ 거래`는 44px 이상 floating/sticky button이다.
- 거래 편집기는 bottom sheet처럼 보이되 접근 가능한 dialog semantics를 사용한다.
- 첫 화면에는 유형, 금액, 카테고리, 결제수단, 날짜만 표시한다.
- 결제자, 거래처, 메모는 `추가 정보`에서 펼친다.
- 이체 선택 시 category를 숨기고 출발·도착 결제수단을 표시한다.

### 8.3 Empty, Loading, Error States

- 장부 없음: 관리자 `가족 가계부 만들기`, 모든 사용자 `개인 장부 만들기`
- 결제수단 없음: 거래 등록 전 결제수단 만들기 CTA
- 거래 없음: 현재 월 안내와 첫 거래 등록 CTA
- loading: summary와 list skeleton, 버튼 중복 클릭 방지
- save error: dialog 유지, 사용자가 입력한 값과 `clientRequestId` 유지
- access denied: 상세 이유를 노출하지 않고 목록을 재조회

## 9. File Structure

```text
packages/shared/src/
  ledger.ts
  ledger.test.ts

apps/web/src/features/ledger/
  LedgerContainer.tsx
  LedgerPage.tsx
  ledger.css
  ledger-money.ts
  ledger-money.test.ts
  ledger-dates.ts
  ledger-dates.test.ts
  api/ledger-api.ts

supabase/migrations/
  <timestamp>_create_ledger_core.sql

supabase/tests/
  ledger-security.test.sql
  ledger-balances.test.sql
```

`App.tsx`의 `/app/ledger` ComingSoon route를 `LedgerContainer`로 교체한다.

## 10. Implementation Order

1. shared domain types, money/date validators와 unit tests
2. 새 Supabase migration: enums, tables, indexes, triggers, RLS, RPC
3. remote migration 적용 전 SQL review
4. pgTAP RLS·잔액·월간 합계 테스트
5. ledger API mapper와 CRUD wrapper
6. LedgerContainer loading/mutation orchestration
7. LedgerPage desktop/mobile UI 및 empty/error states
8. App route 연결과 component tests
9. `pnpm check`, cloud migration, PC·390px 회귀검사

## 11. Test Plan

### 11.1 Unit Tests

- 쉼표 포함 금액 입력을 양의 bigint로 변환
- 0, 음수, 소수, 지수 표기, 안전하지 않은 입력 거부
- bigint 합계와 원화 표시
- Asia/Seoul 월 UTC boundary 계산
- income/expense/transfer shape validation
- 동일 account 이체 거부
- 필터와 날짜별 그룹 정렬

### 11.2 Database Tests

- outsider와 다른 household의 모든 ledger row 차단
- family book은 active member만 읽기
- private book은 admin 포함 owner 외 읽기 불가
- member가 family transaction 생성 가능
- member는 다른 작성자의 공동 거래 수정·삭제 불가
- admin은 공동 거래 수정·soft delete 가능
- private transaction에 다른 payer/account/category 연결 거부
- cross-book account/category 참조 거부
- inactive account/category의 신규 사용 거부
- 동일 client request id 중복 insert 거부
- transfer가 두 account 잔액에 반대 방향으로 반영
- transfer가 monthly income/expense에서 제외
- soft-deleted transaction이 목록·잔액·요약에서 제외
- RPC가 금액을 text로 반환

### 11.3 UI and Integration Tests

- 장부 선택에 family/private 표시
- 월 이동 시 query 범위와 summary 갱신
- 거래 유형에 따른 form 필드 전환
- 저장 중 버튼 비활성화와 실패 후 입력 보존
- 작성자와 payer가 다를 때 모두 표시
- 390px에서 horizontal overflow 없이 빠른 입력 완료
- 모든 interactive control 44px 이상 및 keyboard focus 표시

## 12. Migration and Rollback

- 기존 migration은 수정하지 않고 새 migration 하나 이상을 추가한다.
- ledger 테이블은 기존 기능과 독립적이므로 calendar/auth rollback에 영향을 주지 않는다.
- 배포 전 remote `migration list`를 확인한다.
- rollback이 필요하면 신규 route를 ComingSoon으로 되돌리고 ledger table 접근을 중지한다. 이미 입력된 금융 데이터는 자동 삭제하지 않는다.

## 13. Open Decisions Deferred to Later Features

- 명세 파일 형식 우선순위(CSV/XLSX/OFX)와 은행별 parser adapter
- import fingerprint 알고리즘과 수기 거래 후보 매칭 점수
- 자동 분류 규칙의 family 공용/개인 범위
- 월 예산 이월 방식과 카드 결제 예정액
- 월간 비용 제안에 사용할 통계 기간과 설명 가능성 기준

