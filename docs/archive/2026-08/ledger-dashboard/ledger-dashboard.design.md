# Ledger Dashboard Design

## 화면 구조

1. 헤더: 가계부로 돌아가기, 장부 선택, 기간 프리셋, 시작일·종료일
2. KPI: 수입, 지출, 순증감, 저축률, 거래 수, 일평균 지출과 이전 기간 비교
3. 추이: 월별 수입/지출 막대 및 순증감
4. 구성: 카테고리별 지출과 이전 기간 비교
5. 관점: 결제수단, 가족 구성원, 요일별 지출
6. 상세: 일별 지출, 상위 거래처, 반복 지출 후보

## 데이터 흐름

`LedgerDashboardContainer -> createLedgerApi.getDashboard -> public.get_ledger_dashboard -> RLS/권한 검증 -> JSON 집계`

## RPC

`get_ledger_dashboard(p_book_id uuid, p_from date, p_to date) returns jsonb`

- 인증 사용자이며 장부 조회 권한이 있어야 한다.
- 시작일은 종료일 이하여야 하며 최대 조회 범위는 731일이다.
- 날짜 경계는 Asia/Seoul 자정 기준으로 UTC 변환한다.
- 비교 기간은 선택 기간 바로 이전의 동일 일수이다.
- 삭제 거래와 이체를 통계에서 제외한다.
- 모든 금액은 JSON 문자열로 반환한다.

## 응답 모델

- `summary`, `previousSummary`: 수입/지출/순증감/거래수/활성일수
- `monthly`: 월별 수입·지출·순증감
- `categories`: 지출 카테고리별 금액·건수·직전 금액
- `accounts`: 결제수단별 지출 금액·건수
- `members`: 결제자별 지출 금액·건수
- `weekdays`: 요일별 지출 금액·건수
- `daily`: 일별 수입·지출
- `merchants`: 거래처별 지출 합계·건수·평균
- `recurring`: 2개월 이상 등장한 반복 지출 후보

## 컴포넌트

- `LedgerDashboardContainer`: 접근 정보, 필터 상태, RPC 호출 및 상태 관리
- `LedgerDashboardPage`: 접근성 있는 필터와 분석 카드
- CSS/SVG 기반 차트: 외부 차트 라이브러리 없이 번들 크기와 유지보수 비용 최소화

## 테스트

- 공유 유틸리티: 기간 프리셋, BigInt 증감률, 안전한 비율
- UI: KPI·각 분석 섹션·빈 상태·필터 이벤트
- SQL: 가족 구성원 조회 허용, 개인 장부/외부 사용자 차단, 금액 문자열 확인
- 전체 lint/typecheck/unit/build 및 Supabase migration 검증
