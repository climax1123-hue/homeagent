# statement-classification - Do 기록

> Date: 2026-08-31 | Phase: Do

## 구현 내용

- 설명 가능한 거래처·메모 키워드 분류 순수 함수
- contains/exact, merchant/memo/both, 거래 유형과 우선순위 처리
- 장부별 분류 규칙 및 은행 양식 프로필 테이블
- 가족 관리자·개인 장부 소유자 관리 RLS
- 규칙 추가·활성화·우선순위·삭제 UI
- 헤더 signature 기반 저장 양식 자동 적용과 수동 선택
- 현재 열 매핑을 은행 양식으로 저장·삭제
- 명세 행별 추천 카테고리·추천 이유·수동 변경
- 추천 없는 행의 기본 카테고리 fallback

## 주요 파일

- `packages/shared/src/ledger.ts`
- `packages/shared/src/ledger.test.ts`
- `packages/statement-parser/src/index.ts`
- `apps/web/src/features/ledger/classification/ClassificationRulePanel.tsx`
- `apps/web/src/features/ledger/import/StatementImportPanel.tsx`
- `apps/web/src/features/ledger/api/ledger-api.ts`
- `apps/web/src/features/ledger/LedgerContainer.tsx`
- `supabase/migrations/20260831010000_create_statement_classification.sql`
- `supabase/tests/statement-classification-security.test.sql`

## 검증 현황

- shared Vitest 20개 통과
- statement-parser Vitest 9개 통과
- 전체 web Vitest 8개 파일·33개 테스트 통과
- 전체 `pnpm check` 통과: lint 오류 0, TypeScript, 테스트, production build
- Supabase remote migration 적용 완료
- 브라우저 실화면은 현재 세션의 가족 공간 접근 차단으로 미확인
