# statement-import - Completion Report

> Date: 2026-08-28 | Final Match Rate: 94% | Iteration: 1

## 1. 요약

은행·카드사 CSV/XLSX 명세를 브라우저에서 안전하게 분석하고, 사용자가 검토한 거래만 가족 또는 개인 장부에 원자적으로 반영하는 기능을 완료했다. 원본 파일은 Supabase Storage나 DB에 보관하지 않는다.

## 2. 완료 기능

- UTF-8/CP949 CSV 및 다중 sheet XLSX 읽기
- 확장자·XLSX signature·10MB·10,000행 검증
- 헤더 자동 인식과 수동 열 매핑
- 날짜, 수입/지출, bigint 금액 정규화
- 오류 행 표시와 행별 포함/제외
- 일자·유형·금액·거래처·메모 수정 및 재검증
- 결제수단과 유형별 기본 카테고리 지정
- 같은 파일 재반영 방지와 기존 원장 중복 후보 표시
- RLS가 적용된 batch/row 메타데이터와 원자적 commit RPC
- PC 표 및 390px 모바일 카드형 검토 UI
- XLSX 지연 로딩으로 초기 번들 분리

## 3. 품질 지표

| 항목                   | 결과                                         |
| ---------------------- | -------------------------------------------- |
| Design match rate      | 94%                                          |
| PDCA iteration         | 1회                                          |
| statement parser tests | 8개 통과                                     |
| ledger UI tests        | 3개 통과                                     |
| shared tests           | 17개 통과                                    |
| ESLint                 | 오류 0, 기존 경고 8                          |
| TypeScript             | 통과                                         |
| Production build       | 통과                                         |
| Supabase migrations    | `20260828020000`, `20260828030000` 적용 완료 |

## 4. 보안과 개인정보

- 파일 binary와 원본 행 JSON을 서버에 저장하지 않는다.
- import metadata는 `household_id`, `book_id`와 RLS로 격리한다.
- 가족 장부는 활성 구성원, 개인 장부는 소유자만 접근한다.
- account/category 교차 장부 참조는 RPC와 transaction trigger에서 거부한다.
- 금액은 JavaScript 부동소수점 대신 bigint 문자열을 사용한다.

## 5. 남은 운영 검증

- Docker Desktop 정상화 후 `statement-import-security.test.sql` pgTAP 실행
- 실제 금융정보를 제거한 은행·카드사별 샘플 호환성 확인
- 10,000행 실측 후 Web Worker/취소 기능 필요성 결정
- 로그인 가능한 가족 공간에서 PC와 실제 iPhone/Android 최종 점검

## 6. 회고

- Keep: 원본 미보관, 클라이언트 정규화, DB 재검증의 이중 방어
- Problem: Windows Vitest 병렬 worker와 Docker 환경이 전체 자동검증을 제한
- Try: CI에서 web test와 Supabase pgTAP을 실행해 로컬 환경 의존성 제거

## 7. 후속 기능

다음 권장 기능은 `statement-classification`이다. 공통코드와 사용자가 수정한 카테고리를 바탕으로 규칙 기반 자동 분류부터 시작하고, 이후 `ledger-dashboard`, `ledger-budget`, `ledger-insights` 순서로 확장한다.
