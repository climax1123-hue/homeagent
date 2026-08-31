# statement-import - Do 기록

> Date: 2026-08-28 | PDCA phase: Do

## 구현 범위

- CSV/XLSX 브라우저 파싱, UTF-8/CP949 해석, 구분자 및 헤더 자동 매핑
- 거래일·수입/지출·금액·거래처·메모 정규화와 SHA-256 중복 식별자
- 최대 10MB, 최대 10,000행 제한 및 행별 오류/포함 여부 미리보기
- 대상 장부의 결제수단 및 기본 카테고리 선택 후 일괄 반영
- 원본 파일을 저장하지 않는 import batch/row 메타데이터
- 장부 접근 권한을 재검증하는 RLS와 `commit_ledger_import` 원자적 RPC
- 가계부 화면의 `명세 가져오기` 진입점과 PC/모바일 반응형 검토 UI

## 구현 파일

- `packages/statement-parser/src/index.ts`
- `packages/statement-parser/src/statement-parser.test.ts`
- `apps/web/src/features/ledger/import/StatementImportPanel.tsx`
- `apps/web/src/features/ledger/import/statement-import.css`
- `apps/web/src/features/ledger/LedgerPage.tsx`
- `apps/web/src/features/ledger/LedgerContainer.tsx`
- `apps/web/src/features/ledger/api/ledger-api.ts`
- `supabase/migrations/20260828020000_create_statement_import.sql`
- `supabase/tests/statement-import-security.test.sql`

## 검증

- parser Vitest: 통과
- web TypeScript: 통과
- web production build: 통과
- Supabase remote migration: 적용 완료
- 전체 workspace lint/typecheck: 통과(기존 경고 8건 유지)
- parser/shared 테스트: 22개 통과
- ledger 화면 단독 테스트: 3개 통과
- 전체 web Vitest 병렬 실행: Windows worker 시작 timeout으로 중단(단독 실행은 통과)
- 브라우저 실화면: 현재 세션에 접근 가능한 가족 공간이 없어 `/app/ledger` 진입 전 차단

## 다음 단계

`$pdca analyze statement-import`에서 설계 대비 구현 차이, 실제 은행 샘플 호환성, 모바일 UI와 RLS 테스트 실행 결과를 점검한다.
