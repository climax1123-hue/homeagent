# statement-classification - Completion Report

> Date: 2026-08-31 | Final Match Rate: 94% | Iteration: 1

## 1. 요약

은행마다 다른 명세 열 구성을 장부별 양식 프로필로 저장·재사용하고, 공통 형식으로 변환된 거래를 거래처·메모 규칙으로 설명 가능하게 분류하는 기능을 완료했다. 자동화가 실패해도 수동 매핑과 미분류 반영을 계속 사용할 수 있다.

## 2. 완료 기능

- 거래처·메모의 포함/정확히 일치 분류
- 수입·지출 유형 분리와 명시적 우선순위
- 추천 카테고리와 추천 이유 표시
- 행별 추천 수정·미분류·기본 카테고리 fallback
- 가족 관리자·개인 장부 소유자의 규칙 관리
- 헤더 SHA-256 기반 은행 양식 자동 적용
- 인코딩·XLSX 시트·열 매핑 프로필 저장과 수동 재선택
- 규칙·프로필 RLS 및 교차 장부·카테고리 검증
- 규칙·프로필 조회 실패 시 기존 가계부 기능 유지

## 3. 품질 지표

| 항목                   | 결과                                       |
| ---------------------- | ------------------------------------------ |
| Design match rate      | 94%                                        |
| Iteration              | 1회                                        |
| shared tests           | 20개 통과                                  |
| statement parser tests | 9개 통과                                   |
| web tests              | 8개 파일·33개 통과                         |
| ESLint                 | 오류 0, 기존 경고 8                        |
| TypeScript             | 통과                                       |
| Production build       | 통과                                       |
| 전체 `pnpm check`      | 통과                                       |
| Supabase migration     | `20260831010000` 적용, 로컬·원격 15개 일치 |

## 4. 보안·개인정보

- 원본 금융 파일과 거래 행을 프로필에 저장하지 않는다.
- 규칙과 양식은 `household_id`, `book_id`, RLS로 격리한다.
- 가족 장부 설정은 관리자, 개인 장부 설정은 소유자만 변경한다.
- 카테고리 유형과 장부 참조를 DB trigger에서 재검증한다.

## 5. 남은 운영 검증

- Docker 정상화 후 `statement-classification-security.test.sql` pgTAP 실행
- 개인정보를 제거한 실제 은행·카드사 샘플로 프로필 호환성 확인
- 로그인 가능한 가족 공간에서 PC·iPhone·Android 실화면 확인
- 10,000행 실측 후 Web Worker 적용 여부 결정

## 6. 회고

- Keep: 은행 양식 해석과 카테고리 분류를 분리해 확장성을 확보했다.
- Problem: 로컬 Docker와 현재 브라우저 가족 공간 접근 상태가 통합 검증을 제한했다.
- Try: CI에 Supabase pgTAP과 브라우저 반응형 검증을 추가한다.

## 7. 다음 단계

권장 다음 기능은 `ledger-dashboard`이며, 그 전에 실제 은행 샘플 2~3종으로 양식 프로필을 등록해 호환성을 확인한다.
